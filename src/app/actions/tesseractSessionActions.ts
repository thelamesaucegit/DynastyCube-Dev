// src/app/actions/tesseractSessionActions.ts

"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";
import { fetchAllCards } from "@/lib/scryfall-client";
import { fetchEloMapFromS3 } from "@/app/actions/cardRatingActions"; 

export interface CreateTesseractParams {
    name: string;
    passcode?: string;
    draftFormat: 'snake' | 'linear';
    totalRounds: number;
    hoursPerPick: number;
    maxPlayers: number;
    startTime: string; 
    csvData: string;
}

export interface ParsedCubeCard {
    card_name: string;
    card_set: string | null;
    image_url: string | null;
    oracle_text: string | null; 
    cubecobra_elo: number | null; 
    colors: string[];
    cmc: number;
    card_type: string | null;
}

export interface TesseractLobby {
    id: string;
    name: string;
    draft_format: string;
    status: string;
    participant_count: number;
    max_players: number;
    has_passcode: boolean;
}

function parseCubeCobraCSV(csvText: string): Omit<ParsedCubeCard, 'cubecobra_elo'>[] {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) throw new Error("CSV is empty or invalid.");

    const parseRow = (row: string): string[] => {
        const result: string[] = [];
        let inQuotes = false;
        let current = "";
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result.map(s => s.replace(/^"|"$/g, '').trim());
    };
    
    const headers = parseRow(lines[0]).map(h => h.toLowerCase());
    
    const nameIdx = headers.indexOf('name');
    const setIdx = headers.indexOf('set');
    const imgIdx = headers.indexOf('image url');
    const oracleIdx = headers.indexOf('oracle text');
    const colorIdx = headers.indexOf('color');
    const cmcIdx = headers.indexOf('cmc');
    const typeIdx = headers.indexOf('type');

    if (nameIdx === -1) {
        throw new Error("Invalid CSV format: Missing 'Name' column.");
    }

    const cards: Omit<ParsedCubeCard, 'cubecobra_elo'>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        if (!row[nameIdx]) continue;

        let colorsArray: string[] = [];
        if (colorIdx !== -1 && row[colorIdx]) {
            colorsArray = row[colorIdx].toUpperCase().replace(/[^WUBRG]/g, '').split('');
        }

        cards.push({
            card_name: row[nameIdx],
            card_set: setIdx !== -1 ? row[setIdx] : null,
            image_url: imgIdx !== -1 ? row[imgIdx] : null,
            oracle_text: oracleIdx !== -1 ? row[oracleIdx] : null,
            colors: colorsArray,
            cmc: cmcIdx !== -1 ? parseInt(row[cmcIdx], 10) || 0 : 0,
            card_type: typeIdx !== -1 ? row[typeIdx] : null,
        });
    }
    return cards;
}

export async function getTesseractLobbies(): Promise<{ lobbies: TesseractLobby[]; error?: string }> {
    const adminSupabase = createAdminClient();
    try {
        const { data, error } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select(`
                id, 
                name, 
                draft_format, 
                status, 
                max_players, 
                passcode,
                tesseract_participants (id)
            `)
            .neq('status', 'completed')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const lobbies: TesseractLobby[] = (data || []).map(row => ({
            id: row.id,
            name: row.name,
            draft_format: row.draft_format,
            status: row.status,
            max_players: row.max_players,
            participant_count: Array.isArray(row.tesseract_participants) ? row.tesseract_participants.length : 0,
            has_passcode: !!row.passcode
        }));

        return { lobbies };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "An unexpected error occurred.";
        return { lobbies: [], error: message };
    }
}

export async function createTesseractDraft(params: CreateTesseractParams): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const authClient = await createServerClient();
    const adminSupabase = createAdminClient(); 

    try {
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) return { success: false, error: "You must be signed in to create a Tesseract draft." };

        const { data: userProfile } = await adminSupabase.from('users').select('display_name').eq('id', user.id).single();
        const creatorDisplayName = userProfile?.display_name || "Draft Creator";
        
        // Step 1: Parse only the card names from the CSV
        const cardNames = parseCardNamesFromCSV(params.csvData);
        if (cardNames.length === 0) throw new Error("No valid card names found in the uploaded CSV.");

        // Step 2: Enrich card data with Scryfall and CubeCobra ELO
        const [scryfallData, eloMap] = await Promise.all([
            fetchAllCards(cardNames),
            fetchEloMapFromS3()
        ]);
        
        if (scryfallData.errors.length > 0) {
            console.warn("Scryfall fetch encountered errors:", scryfallData.errors);
        }

        const finalCards = scryfallData.cards.map(card => ({
            card_name: card.name,
            card_set: card.set_name,
            image_url: card.image_uris?.normal || card.image_uris?.small || null,
            oracle_text: card.oracle_text || (card.card_faces && card.card_faces[0]?.oracle_text) || null,
            cubecobra_elo: eloMap.get(card.name.toLowerCase()) || null,
            colors: card.colors || [],
            cmc: card.cmc || 0,
            card_type: card.type_line,
        }));

        if (finalCards.length === 0) {
            return { success: false, error: "Could not find any valid card data for the names provided in the list." };
        }

        // 3. Enforce Overlap & Duration Rules (No changes needed here)
        const newStart = new Date(params.startTime).getTime();
        const maxDurationMs = 7 * 24 * 60 * 60 * 1000;
        const newEnd = newStart + maxDurationMs;
        const newEndISO = new Date(newEnd).toISOString();

        const { data: existingSessions } = await adminSupabase.from('tesseract_draft_sessions').select('start_time, end_time').neq('status', 'completed');
        let overlapCount = 0;
        existingSessions?.forEach(s => {
            const estStart = new Date(s.start_time).getTime();
            const estEnd = s.end_time ? new Date(s.end_time).getTime() : estStart + maxDurationMs;
            if (newStart < estEnd && newEnd > estStart) overlapCount++;
        });
        if (overlapCount >= 2) return { success: false, error: "Cannot schedule draft: A maximum of 2 overlapping Tesseract drafts are allowed." };
        
        // 4. Create Draft Session
        const { data: session, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .insert({
                created_by: user.id, name: params.name, passcode: params.passcode || null,
                draft_format: params.draftFormat, total_rounds: params.totalRounds,
                hours_per_pick: params.hoursPerPick, max_players: params.maxPlayers, 
                start_time: params.startTime, end_time: newEndISO,
                expires_at: new Date(newEnd + (3 * 24 * 60 * 60 * 1000)).toISOString()
            }).select('id').single();

        if (sessionErr) throw new Error(`Failed to create session: ${sessionErr.message}`);

        // 5. Bulk Insert Fully Enriched Card Data
        const cardPayload = finalCards.map(card => ({
            draft_session_id: session.id,
            ...card
        }));

        for (let i = 0; i < cardPayload.length; i += 500) {
            const batch = cardPayload.slice(i, i + 500);
            const { error: insertErr } = await adminSupabase.from('tesseract_card_pools').insert(batch);
            if (insertErr) {
                await adminSupabase.from('tesseract_draft_sessions').delete().eq('id', session.id);
                throw new Error(`Failed to insert cards: ${insertErr.message}`);
            }
        }
        
        // 6. Auto-Join Creator and set cookie
        const sessionToken = crypto.randomBytes(32).toString('hex');
        await adminSupabase.from('tesseract_participants').insert({
            draft_session_id: session.id, user_id: user.id, display_name: creatorDisplayName,
            session_token: sessionToken, draft_position: 1
        });

           const cookieStore = await cookies();
        cookieStore.set(`tesseract_token_${session.id}`, sessionToken, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', maxAge: 60 * 60 * 24 * 14, path: '/'
        });

        return { success: true, sessionId: session.id };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error creating Tesseract draft:", message);
        return { success: false, error: message };
    }
}

function parseCardNamesFromCSV(csvText: string): string[] {
    const lines = csvText.split(/\r?\n/).slice(1); // Skip header
    return lines.map(line => {
        // This simple split is okay if we only need the first column.
        const name = line.split(',')[0].trim().replace(/"/g, '');
        return name;
    }).filter(Boolean);
}

export async function getTesseractLobbyInfo(sessionId: string): Promise<{
    success: boolean;
    name?: string;
    requiresPasscode?: boolean;
    status?: string;
    error?: string;
}> {
    const adminSupabase = createAdminClient(); 
    try {
        const { data, error } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select('name, passcode, status')
            .eq('id', sessionId)
            .single();
            
        if (error || !data) return { success: false, error: "Lobby not found." };
        
        return {
            success: true,
            name: data.name,
            requiresPasscode: !!data.passcode,
            status: data.status
        };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "An unexpected error occurred.";
        return { success: false, error: message };
    }
}

/**
 * Checks if the current authenticated user is the creator of the Tesseract Draft.
 */
async function verifyTesseractCreator(sessionId: string): Promise<boolean> {
    const authClient = await createServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return false;

    const adminSupabase = createAdminClient();
    const { data } = await adminSupabase
        .from('tesseract_draft_sessions')
        .select('created_by')
        .eq('id', sessionId)
        .single();

    return data?.created_by === user.id;
}

export async function startTesseractDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const isCreator = await verifyTesseractCreator(sessionId);
    if (!isCreator) return { success: false, error: "Only the creator can start the draft." };

    const adminSupabase = createAdminClient();
    try {
        const { data: session } = await adminSupabase.from('tesseract_draft_sessions').select('*').eq('id', sessionId).single();
        if (!session) return { success: false, error: "Session not found." };
        if (session.status === 'completed') return { success: false, error: "Draft is already completed." };

        const { count } = await adminSupabase.from('tesseract_card_pools').select('id', { count: 'exact', head: true }).eq('draft_session_id', sessionId).eq('is_drafted', true);
        const nextPickGlobalIndex = count || 0;
        
        const newDeadline = new Date(Date.now() + (session.hours_per_pick * 60 * 60 * 1000)).toISOString();

        await adminSupabase.from('tesseract_draft_sessions').update({
            status: 'active',
            current_pick_deadline: newDeadline
        }).eq('id', sessionId);

        return { success: true };
    } catch (e: unknown) {
        return { success: false, error: String(e) };
    }
}

export async function pauseTesseractDraft(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const isCreator = await verifyTesseractCreator(sessionId);
    if (!isCreator) return { success: false, error: "Only the creator can pause the draft." };

    const adminSupabase = createAdminClient();
    try {
        await adminSupabase.from('tesseract_draft_sessions').update({ status: 'paused' }).eq('id', sessionId);
        return { success: true };
    } catch (e: unknown) {
        return { success: false, error: String(e) };
    }
}

export async function updateTesseractSettings(sessionId: string, maxPlayers: number): Promise<{ success: boolean; error?: string }> {
    const isCreator = await verifyTesseractCreator(sessionId);
    if (!isCreator) return { success: false, error: "Only the creator can edit settings." };

    const adminSupabase = createAdminClient();
    try {
        await adminSupabase.from('tesseract_draft_sessions').update({ max_players: maxPlayers }).eq('id', sessionId);
        return { success: true };
    } catch (e: unknown) {
        return { success: false, error: String(e) };
    }
}
