// src/app/actions/shandaboxActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { fetchOldestPrintingsByName } from "@/lib/scryfall-client";

function createServiceClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

const COOKIE_NAME = "shandabox_session";

// --- STRICT TYPING ---
export interface ShandaboxUser {
    id: string;
    email: string;
    character_name: string;
    level: number;
}

export interface ShandaboxCard {
    code: string;
    card_name: string;
    image_url: string | null;
}

export interface ShandaboxInventoryItem {
    code: string;
    acquired_at: string;
    card: { card_name: string; image_url: string | null } | null;
}

export interface ShandaboxBoss {
    code: string;
    boss_name: string;
}

export interface ShandaboxDefeatedBoss {
    code: string;
    defeated_at: string;
    boss: { boss_name: string } | null;
}

// --- AUTHENTICATION ---
export async function loginOrRegisterShandabox(email: string, passcode: string, characterName?: string) {
    const supabase = createServiceClient();
    
    const { data: user } = await supabase.from('shandabox_users').select('id, passcode').eq('email', email.toLowerCase()).maybeSingle();
    
    if (user) {
        if (user.passcode !== passcode) return { success: false, error: "Incorrect passcode." };
        if (characterName) {
            await supabase.from('shandabox_users').update({ character_name: characterName }).eq('id', user.id);
        }
        (await cookies()).set(COOKIE_NAME, user.id, { secure: true, httpOnly: true, path: '/' });
        return { success: true };
    } else {
        if (!characterName) return { success: false, error: "Character name required for new registration." };
        
        // Ensure character name is unique
        const { data: existingName } = await supabase.from('shandabox_users').select('id').ilike('character_name', characterName).maybeSingle();
        if (existingName) return { success: false, error: "Character name is already taken." };

        const { data: newUser, error } = await supabase.from('shandabox_users').insert({
            email: email.toLowerCase(),
            passcode,
            character_name: characterName,
            level: 1
        }).select('id').single();
        
        if (error || !newUser) return { success: false, error: "Failed to register." };
        (await cookies()).set(COOKIE_NAME, newUser.id, { secure: true, httpOnly: true, path: '/' });
        return { success: true };
    }
}

export async function logoutShandabox() {
    (await cookies()).delete(COOKIE_NAME);
}

export async function getShandaboxUser(): Promise<ShandaboxUser | null> {
    const userId = (await cookies()).get(COOKIE_NAME)?.value;
    if (!userId) return null;
    const supabase = await createServerClient();
    const { data } = await supabase.from('shandabox_users').select('id, email, character_name, level').eq('id', userId).maybeSingle();
    return data as ShandaboxUser | null;
}

// --- PLAYER INVENTORY & CARDS ---
export async function getUserInventory(userId: string): Promise<ShandaboxInventoryItem[]> {
    const supabase = await createServerClient();
    const { data } = await supabase
        .from('shandabox_inventory')
        .select(`
            code, acquired_at,
            card:shandabox_cards ( card_name, image_url )
        `)
        .eq('user_id', userId)
        .order('acquired_at', { ascending: false });
    
    // Clean up Supabase's nested join typing
    return (data || []).map(row => ({
        code: row.code,
        acquired_at: row.acquired_at,
        card: Array.isArray(row.card) ? row.card[0] : row.card
    })) as ShandaboxInventoryItem[];
}

export async function checkCodeStatus(code: string) {
    const supabase = await createServerClient();
    
    const { data: card } = await supabase.from('shandabox_cards').select('card_name').eq('code', code).maybeSingle();
    if (!card) return { valid: false, error: `Code ${code} is not a valid Shandabox card.` };

    const { data: owner } = await supabase
        .from('shandabox_inventory')
        .select('user_id, user:shandabox_users(character_name)')
        .eq('code', code)
        .maybeSingle();

    if (owner) {
        // Safe extraction, ensuring no 'any' is used
        const u = Array.isArray(owner.user) ? owner.user[0] : owner.user;
        return { 
            valid: true, 
            cardName: card.card_name, 
            isOwned: true, 
            ownerId: owner.user_id,
            ownerName: u?.character_name || 'Unknown Player' // THE FIX: Only returning character name
        };
    }

    return { valid: true, cardName: card.card_name, isOwned: false };
}

export async function claimCode(userId: string, code: string, forceTransferFromUserId?: string) {
    const supabase = createServiceClient();
    
    if (forceTransferFromUserId) {
        await supabase.from('shandabox_inventory').delete().eq('code', code).eq('user_id', forceTransferFromUserId);
    }
    
    const { error } = await supabase.from('shandabox_inventory').insert({ user_id: userId, code });
    if (error) return { success: false, error: "Failed to claim card. It may have already been snatched!" };

    await supabase.from('shandabox_transactions').insert({
        code,
        from_user_id: forceTransferFromUserId || null,
        to_user_id: userId
    });

    return { success: true };
}

export async function dropCode(userId: string, code: string) {
    const supabase = await createServerClient();
    await supabase.from('shandabox_inventory').delete().eq('user_id', userId).eq('code', code);
    await supabase.from('shandabox_transactions').insert({ code, from_user_id: userId, to_user_id: null });
    return { success: true };
}

// --- BOSS LOGIC ---
export async function getUserBosses(userId: string): Promise<ShandaboxDefeatedBoss[]> {
    const supabase = await createServerClient();
    const { data } = await supabase
        .from('shandabox_defeated_bosses')
        .select(`
            code, defeated_at,
            boss:shandabox_bosses ( boss_name )
        `)
        .eq('user_id', userId)
        .order('defeated_at', { ascending: false });
        
    return (data || []).map(row => ({
        code: row.code,
        defeated_at: row.defeated_at,
        boss: Array.isArray(row.boss) ? row.boss[0] : row.boss
    })) as ShandaboxDefeatedBoss[];
}

export async function claimBossCode(userId: string, code: string) {
    const supabase = createServiceClient();
    
    // Check if valid boss code
    const { data: boss } = await supabase.from('shandabox_bosses').select('boss_name').eq('code', code).maybeSingle();
    if (!boss) return { success: false, error: `Code ${code} is not a recognized Boss.` };

    // Claim it
    const { error } = await supabase.from('shandabox_defeated_bosses').insert({ user_id: userId, code });
    if (error) {
        // If it's a unique constraint violation, it means it's already claimed by someone
        return { success: false, error: "This specific Boss token has already been claimed!" };
    }

    return { success: true, bossName: boss.boss_name };
}


// --- PUBLIC PROFILES ---
export async function getPublicShandaboxProfile(characterName: string) {
    const supabase = await createServerClient();
    
    const { data: user, error } = await supabase
        .from('shandabox_users')
        .select('id, character_name, level')
        .ilike('character_name', characterName)
        .maybeSingle();

    if (error || !user) return { success: false };

    const inventory = await getUserInventory(user.id);
    const bosses = await getUserBosses(user.id);

    return { success: true, user, inventory, bosses };
}

// --- ADMIN ACTIONS ---
export async function verifyShandaboxAdmin() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('shandabox_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    return !!data;
}

export async function bulkImportCards(csvData: string) {
    const isAdmin = await verifyShandaboxAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const supabase = createServiceClient();
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedCards = lines.map(line => {
        const parts = line.split(',');
        return { code: parts[0].trim(), name: parts.slice(1).join(',').trim() };
    }).filter(c => c.code && c.name);

    if (parsedCards.length === 0) return { success: false, error: "No valid data parsed." };

    const uniqueNames = [...new Set(parsedCards.map(c => c.name))];
    const scryfallMap = await fetchOldestPrintingsByName(uniqueNames);

    const inserts = parsedCards.map(c => {
        const scryData = scryfallMap.get(c.name.toLowerCase());
        return { code: c.code, card_name: c.name, image_url: scryData?.image_url || null };
    });

    const { error } = await supabase.from('shandabox_cards').upsert(inserts, { onConflict: 'code' });
    if (error) return { success: false, error: error.message };
    return { success: true, count: inserts.length };
}

export async function bulkImportBosses(csvData: string) {
    const isAdmin = await verifyShandaboxAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const supabase = createServiceClient();
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const inserts = lines.map(line => {
        const parts = line.split(',');
        return { code: parts[0].trim(), boss_name: parts.slice(1).join(',').trim() };
    }).filter(c => c.code && c.boss_name);

    if (inserts.length === 0) return { success: false, error: "No valid data parsed." };

    const { error } = await supabase.from('shandabox_bosses').upsert(inserts, { onConflict: 'code' });
    if (error) return { success: false, error: error.message };
    return { success: true, count: inserts.length };
}
