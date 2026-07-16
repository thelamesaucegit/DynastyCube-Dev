// src/app/actions/tesseractSessionActions.ts

"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";
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
    oracle_text: string | null; // <-- ADDED
    cubecobra_elo: number | null; // <-- ADDED
    colors: string[];
    cmc: number;
    card_type: string | null;
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


export async function createTesseractDraft(params: CreateTesseractParams): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const authClient = await createServerClient();
    const adminSupabase = createAdminClient(); 

    try {
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) return { success: false, error: "You must be signed in." };

        const { data: userProfile } = await adminSupabase.from('users').select('display_name').eq('id', user.id).single();
        const creatorDisplayName = userProfile?.display_name || "Draft Creator";
        
        const parsedCards = parseCubeCobraCSV(params.csvData);
        if (parsedCards.length === 0) throw new Error("No valid cards found in CSV.");

        const eloMap = await fetchEloMapFromS3();

        const finalCardsWithElo: ParsedCubeCard[] = parsedCards.map(card => ({
            ...card,
            cubecobra_elo: eloMap.get(card.card_name.toLowerCase()) || null
        }));

        const newStart = new Date(params.startTime).getTime();
        const maxDurationMs = 7 * 24 * 60 * 60 * 1000;
        const newEnd = newStart + maxDurationMs;
        const newEndISO = new Date(newEnd).toISOString();

        const { data: existingSessions, error: fetchErr } = await adminSupabase.from('tesseract_draft_sessions').select('start_time, end_time').neq('status', 'completed');
        if (fetchErr) throw fetchErr;

        let overlapCount = 0;
        existingSessions?.forEach(session => {
            const estStart = new Date(session.start_time).getTime();
            const estEnd = session.end_time ? new Date(session.end_time).getTime() : estStart + maxDurationMs;
            if (newStart < estEnd && newEnd > estStart) overlapCount++;
        });

        if (overlapCount >= 2) {
            return { success: false, error: "Cannot schedule draft: A maximum of 2 overlapping Tesseract drafts are allowed at any given time." };
        }

        const { data: session, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .insert({
                created_by: user.id, name: params.name, passcode: params.passcode || null,
                draft_format: params.draftFormat, total_rounds: params.totalRounds,
                hours_per_pick: params.hoursPerPick, max_players: params.maxPlayers,
                start_time: params.startTime, end_time: newEndISO,
                expires_at: new Date(newEnd + (3 * 24 * 60 * 60 * 1000)).toISOString()
            }).select('id').single();

        if (sessionErr || !session) throw new Error(`Failed to create session: ${sessionErr?.message}`);

        // Iterate over 'finalCardsWithElo' not 'parsedCards'
        const cardPayload = finalCardsWithElo.map(card => ({
            draft_session_id: session.id,
            card_name: card.card_name,
            card_set: card.card_set,
            image_url: card.image_url,
            oracle_text: card.oracle_text,
            cubecobra_elo: card.cubecobra_elo,
            colors: card.colors,
            cmc: card.cmc,
            card_type: card.card_type,
            is_drafted: false
        }));

        for (let i = 0; i < cardPayload.length; i += 500) {
            const batch = cardPayload.slice(i, i + 500);
            const { error: insertErr } = await adminSupabase.from('tesseract_card_pools').insert(batch);
            if (insertErr) {
                await adminSupabase.from('tesseract_draft_sessions').delete().eq('id', session.id);
                throw new Error(`Failed to insert cards into the pool: ${insertErr.message}`);
            }
        }
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        await adminSupabase.from('tesseract_participants').insert({
            draft_session_id: session.id, user_id: user.id, display_name: creatorDisplayName,
            session_token: sessionToken, draft_position: 1
        });

        const cookieStore = cookies();
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

        // Identify who is picking next (to start the clock)
        const { count } = await adminSupabase.from('tesseract_card_pools').select('id', { count: 'exact', head: true }).eq('draft_session_id', sessionId).eq('is_drafted', true);
        const nextPickGlobalIndex = count || 0;
        
        // We will finalize the specific participant turn logic when we rebuild the Draft Engine!
        
        const newDeadline = new Date(Date.now() + (session.hours_per_pick * 60 * 60 * 1000)).toISOString();

        await adminSupabase.from('tesseract_draft_sessions').update({
            status: 'active',
            current_pick_deadline: newDeadline
            // current_on_clock_participant_id will be set by the draft engine
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
