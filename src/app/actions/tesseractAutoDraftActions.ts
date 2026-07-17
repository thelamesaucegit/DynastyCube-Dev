// /src/app/actions/tesseractAutoDraftActions.ts

"use server";

import { createAdminClient } from "@/lib/supabase";

// Simplified interfaces for Tesseract
export interface TesseractQueueEntry {
    cardPoolId: string;
    cardName: string;
    position: number;
}

export interface TesseractCardForAlgo {
    id: string;
    card_name: string;
    colors: string[];
    card_type: string | null;
    cubecobra_elo: number | null;
}

/**
 * Stripped-down ELO and color affinity calculator for public drafts.
 * This version is simplified to only use ELO and basic color affinity.
 */
async function computeTesseractPick(participantId: string, sessionId: string, excludedIds: string[] = []): Promise<TesseractCardForAlgo | null> {
    const supabase = createAdminClient();

    // 1. Get participant's current draft picks to establish a color profile
    const { data: picks, error: picksErr } = await supabase
        .from('tesseract_card_pools')
        .select('colors')
        .eq('draft_session_id', sessionId)
        .eq('drafted_by', participantId);

    if (picksErr) {
        console.error("Error fetching participant's picks for color profile:", picksErr);
        return null;
    }

    // 2. Fetch all available cards that have an ELO score
    const { data: available, error: availableErr } = await supabase
        .from('tesseract_card_pools')
        .select('id, card_name, colors, card_type, cubecobra_elo')
        .eq('draft_session_id', sessionId)
        .eq('is_drafted', false)
        .not('id', 'in', `(${excludedIds.length > 0 ? excludedIds.join(',') : ''})`)
        .not('cubecobra_elo', 'is', null)
        .limit(50); // Analyze a sufficiently large batch

    if (availableErr) {
        console.error("Error fetching available cards for auto-draft:", availableErr);
        return null;
    }
    if (!available || available.length === 0) return null;

    // 3. Simple Color Affinity Calculation
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    (picks || []).forEach((p: { colors?: string[] | null }) => {
        (p.colors || []).forEach((c: string) => {
            if (colorCounts[c] !== undefined) {
                colorCounts[c]++;
            }
        });
    });

    const sorted = available.map(card => {
        const elo = card.cubecobra_elo || 1000;
        let affinity = 1.0;
        if (card.colors && card.colors.length > 0) {
            // Add a small bonus for each drafted card of the same color
            affinity = 1 + card.colors.reduce((sum: number, color: string) => sum + (colorCounts[color] || 0), 0) * 0.05;
        }
        return { ...card, effective_elo: elo * affinity };
    }).sort((a, b) => b.effective_elo - a.effective_elo);
    
    return sorted[0] as TesseractCardForAlgo;
}


// Functions to manage the queue
export async function getTesseractDraftQueue(participantId: string): Promise<{ queue: TesseractQueueEntry[] }> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('tesseract_draft_queues')
        .select('card_pool_id, position, tesseract_card_pools(card_name)')
        .eq('participant_id', participantId)
        .order('position', { ascending: true });

    if (error) {
        console.error("Error fetching tesseract draft queue:", error);
        return { queue: [] };
    }

    const mappedQueue = (data || []).map(q => {
        const cardPool = Array.isArray(q.tesseract_card_pools) ? q.tesseract_card_pools[0] : q.tesseract_card_pools;
        return {
            cardPoolId: q.card_pool_id,
            position: q.position,
            cardName: cardPool?.card_name || 'Unknown'
        };
    });

    return { queue: mappedQueue };
}

export async function setTesseractDraftQueue(participantId: string, entries: { cardPoolId: string, position: number }[]): Promise<{ success: boolean }> {
    const supabase = createAdminClient();
    await supabase.from('tesseract_draft_queues').delete().eq('participant_id', participantId);
    if (entries.length > 0) {
        const rows = entries.map(e => ({ participant_id: participantId, card_pool_id: e.cardPoolId, position: e.position }));
        await supabase.from('tesseract_draft_queues').insert(rows);
    }
    return { success: true };
}

// Main auto-draft execution logic
export async function executeTesseractAutoDraft(sessionId: string, participantId: string, excludedIds: string[] = []): Promise<{ success: boolean; card?: TesseractCardForAlgo }> {
    const supabase = createAdminClient();
    
    // 1. Check the manual queue first
    const { queue } = await getTesseractDraftQueue(participantId);
    const { data: cards } = await supabase.from('tesseract_card_pools').select('id').eq('draft_session_id', sessionId).eq('is_drafted', false);
    const availableIds = new Set((cards || []).map(c => c.id));

    for (const entry of queue) {
        if (availableIds.has(entry.cardPoolId) && !excludedIds.includes(entry.cardPoolId)) {
            // Found a valid pick in the queue, return it
            return { success: true, card: { id: entry.cardPoolId, card_name: entry.cardName, colors: [], card_type: '', cubecobra_elo: 0 } };
        }
    }

    // 2. Fallback to algorithm if the queue is empty or all queued cards are taken
    const card = await computeTesseractPick(participantId, sessionId, excludedIds);
    if (!card) return { success: false };

    return { success: true, card };
}
