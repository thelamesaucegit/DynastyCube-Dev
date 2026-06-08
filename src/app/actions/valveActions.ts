// src/app/actions/valveActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

export interface ValveNomination {
    id: string;
    card_name: string;
    vote_count: number;
    has_voted: boolean;
}

/**
 * Searches the card_pools table for autocomplete (case-insensitive).
 */
export async function searchValveCards(query: string): Promise<{ success: boolean; cards: string[]; error?: string }> {
    if (!query || query.trim().length < 2) return { success: true, cards: [] };
    
    const supabase = await createServerClient();
    
    // Search active card pools (ignoring the chamber/wire if you only want draftable cards)
    const { data, error } = await supabase
        .from('card_pools')
        .select('card_name')
        .ilike('card_name', `%${query}%`)
        .limit(10);
        
    if (error) return { success: false, error: error.message, cards: [] };
    
    // THE FIX: Filter out nulls/undefined and ensure it's strictly a string[] before throwing into the Set
    const validNames = (data || [])
        .map(c => c.card_name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);

    const uniqueNames = Array.from(new Set(validNames));
    
    return { success: true, cards: uniqueNames };
}

/**
 * Fetches all nominations and calculates the current user's vote status.
 */
export async function getValveNominations(): Promise<{ success: boolean; nominations: ValveNomination[]; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: noms, error } = await supabase
        .from('valve_nominations')
        .select(`
            id, 
            card_name,
            valve_votes ( user_id )
        `);
        
    if (error) return { success: false, error: error.message, nominations: [] };

    const formatted: ValveNomination[] = (noms || []).map(nom => {
        const votes = nom.valve_votes as { user_id: string }[];
        return {
            id: nom.id,
            card_name: nom.card_name,
            vote_count: votes.length,
            has_voted: user ? votes.some(v => v.user_id === user.id) : false
        };
    });

    // Sort by highest votes, then alphabetically
    formatted.sort((a, b) => b.vote_count - a.vote_count || a.card_name.localeCompare(b.card_name));

    return { success: true, nominations: formatted };
}

/**
 * Nominates a card. Automatically casts a vote for the nominator.
 */
export async function nominateCardForValve(cardName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { success: false, error: "Not authenticated" };

    const cleanName = cardName.trim();

    // 1. Verify it exists in the active card pool
    const { data: poolCard } = await supabase.from('card_pools').select('id').ilike('card_name', cleanName).limit(1).maybeSingle();
    if (!poolCard) return { success: false, error: "That card does not exist in the active league pools." };

    // 2. Check if already nominated
    const { data: existingNom } = await supabase.from('valve_nominations').select('id').ilike('card_name', cleanName).maybeSingle();
    
    let nominationId = existingNom?.id;

    if (!nominationId) {
        // Create new nomination
        const { data: newNom, error: insertErr } = await supabase
            .from('valve_nominations')
            .insert({ card_name: cleanName, nominated_by: user.id })
            .select('id')
            .single();
            
        if (insertErr) return { success: false, error: "Failed to create nomination." };
        nominationId = newNom.id;
        await logSystemEvent("TheValve", "info", `User ${user.id} nominated ${cleanName} for The Valve.`);
    }

    // 3. Add the user's vote
    const { error: voteErr } = await supabase
        .from('valve_votes')
        .upsert({ nomination_id: nominationId, user_id: user.id }, { onConflict: 'nomination_id,user_id' });

    if (voteErr) return { success: false, error: "Nominated, but failed to cast initial vote." };

    return { success: true, message: `Successfully turned the valve against ${cleanName}.` };
}

/**
 * Toggles a user's vote on an existing nomination.
 */
export async function toggleValveVote(nominationId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { success: false, error: "Not authenticated" };

    // Check if vote exists
    const { data: existingVote } = await supabase
        .from('valve_votes')
        .select('*')
        .eq('nomination_id', nominationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingVote) {
        // Remove vote
        await supabase.from('valve_votes').delete().eq('nomination_id', nominationId).eq('user_id', user.id);
    } else {
        // Add vote
        await supabase.from('valve_votes').insert({ nomination_id: nominationId, user_id: user.id });
    }

    return { success: true };
}
