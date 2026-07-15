// src/app/actions/tesseractSessionActions.ts

"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase";

export interface CreateTesseractParams {
    name: string;
    passcode?: string;
    draftFormat: 'snake' | 'linear';
    totalRounds: number;
    hoursPerPick: number;
    startTime: string; // ISO format
    csvData: string;
}

export interface ParsedCubeCard {
    card_name: string;
    card_set: string | null;
    image_url: string | null;
    colors: string[];
    cmc: number;
    card_type: string | null;
}

/**
 * Robust CSV parser tailored for Cube Cobra exports.
 * Properly handles commas inside quoted strings (e.g., "Jace, the Mind Sculptor").
 */
function parseCubeCobraCSV(csvText: string): ParsedCubeCard[] {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) throw new Error("CSV appears to be empty or missing data.");

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
        // Strip wrapping quotes
        return result.map(s => s.replace(/^"|"$/g, '').trim());
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase());
    
    // Standard Cube Cobra Headers
    const nameIdx = headers.indexOf('name');
    const setIdx = headers.indexOf('set');
    const imgIdx = headers.indexOf('image url');
    const colorIdx = headers.indexOf('color');
    const cmcIdx = headers.indexOf('cmc');
    const typeIdx = headers.indexOf('type');

    if (nameIdx === -1) {
        throw new Error("Invalid CSV format: Missing 'Name' column.");
    }

    const cards: ParsedCubeCard[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        if (!row[nameIdx]) continue; // Skip empty rows

        let colorsArray: string[] = [];
        if (colorIdx !== -1 && row[colorIdx]) {
            // CubeCobra formats colors like "WUB" or "W, U, B". 
            // We strip non-WUBRG characters and split into a clean array.
            const rawColor = row[colorIdx].toUpperCase().replace(/[^WUBRG]/g, '');
            colorsArray = rawColor.split('').filter(Boolean);
        }

        cards.push({
            card_name: row[nameIdx],
            card_set: setIdx !== -1 ? row[setIdx] : null,
            image_url: imgIdx !== -1 ? row[imgIdx] : null,
            colors: colorsArray,
            cmc: cmcIdx !== -1 ? parseInt(row[cmcIdx], 10) || 0 : 0,
            card_type: typeIdx !== -1 ? row[typeIdx] : null,
        });
    }

    return cards;
}

/**
 * Creates a new Tesseract Draft Session, ensuring overlap rules and inserting the parsed CSV.
 */
export async function createTesseractDraft(params: CreateTesseractParams): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const authClient = await createServerClient();
    const adminSupabase = createAdminClient(); 

    try {
        // 1. Authenticate Creator
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) {
            return { success: false, error: "You must be signed in to create a Tesseract draft." };
        }

        // 2. Parse CSV (Fail early if invalid)
        let parsedCards: ParsedCubeCard[] = [];
        try {
            parsedCards = parseCubeCobraCSV(params.csvData);
            if (parsedCards.length === 0) throw new Error("No valid cards found in CSV.");
        } catch (csvErr) {
            return { success: false, error: csvErr instanceof Error ? csvErr.message : "Failed to parse CSV." };
        }

        // 3. Enforce Overlap & Duration Rules
        const newStart = new Date(params.startTime).getTime();
        const maxDurationMs = 7 * 24 * 60 * 60 * 1000; // 1 week
        const newEnd = newStart + maxDurationMs;
        const newEndISO = new Date(newEnd).toISOString();

        // Fetch all non-completed sessions to check for overlaps
        const { data: existingSessions, error: fetchErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select('start_time, end_time')
            .neq('status', 'completed');

        if (fetchErr) throw fetchErr;

        let overlapCount = 0;
        existingSessions?.forEach(session => {
            const estStart = new Date(session.start_time).getTime();
            // If an end_time isn't explicitly set, assume the 1-week maximum
            const estEnd = session.end_time ? new Date(session.end_time).getTime() : estStart + maxDurationMs;
            
            // Overlap logic: (StartA < EndB) AND (EndA > StartB)
            if (newStart < estEnd && newEnd > estStart) {
                overlapCount++;
            }
        });

        if (overlapCount >= 2) {
            return { success: false, error: "Cannot schedule draft: A maximum of 2 overlapping Tesseract drafts are allowed at any given time." };
        }

        // 4. Create Draft Session
        const { data: session, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .insert({
                created_by: user.id,
                name: params.name,
                passcode: params.passcode || null,
                draft_format: params.draftFormat,
                total_rounds: params.totalRounds,
                hours_per_pick: params.hoursPerPick,
                start_time: params.startTime,
                end_time: newEndISO, 
                expires_at: new Date(newEnd + (3 * 24 * 60 * 60 * 1000)).toISOString() // Expires 3 days after max end time for cleanup
            })
            .select('id')
            .single();

        if (sessionErr || !session) {
            throw new Error(`Failed to create session: ${sessionErr?.message}`);
        }

        // 5. Bulk Insert Cards into Isolated Pool
        // Map the parsed cards to include the generated session_id
        const cardPayload = parsedCards.map(card => ({
            draft_session_id: session.id,
            card_name: card.card_name,
            card_set: card.card_set,
            image_url: card.image_url,
            colors: card.colors,
            cmc: card.cmc,
            card_type: card.card_type,
            is_drafted: false
        }));

        // Insert in batches of 500 to ensure we don't hit payload limits on massive cubes
        for (let i = 0; i < cardPayload.length; i += 500) {
            const batch = cardPayload.slice(i, i + 500);
            const { error: insertErr } = await adminSupabase.from('tesseract_card_pools').insert(batch);
            if (insertErr) {
                // If a batch fails, attempt to rollback the session to avoid orphan data
                await adminSupabase.from('tesseract_draft_sessions').delete().eq('id', session.id);
                throw new Error(`Failed to insert cards into the pool: ${insertErr.message}`);
            }
        }

        return { success: true, sessionId: session.id };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error creating Tesseract draft:", message);
        return { success: false, error: message };
    }
}
