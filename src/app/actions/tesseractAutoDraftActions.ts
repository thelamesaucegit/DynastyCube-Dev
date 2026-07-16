// /src/app/actions/tesseractAutoDraftActions.ts

"use server";

import { createAdminClient } from "@/lib/supabase";
import { getTesseractDraftStatus } from "@/app/actions/tesseractDraftActions";
import { getTesseractSessionUser } from "@/app/actions/tesseractAuthActions";

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
 */
async function computeTesseractPick(participantId: string, sessionId: string, excludedIds: string[] = []): Promise<TesseractCardForAlgo | null> {
    const supabase = createAdminClient();

    // 1. Get participant's current draft picks to establish color profile
    const { data: picks, error: picksErr } = await supabase
        .from('tesseract_card_pools')
        .select('colors, card_type')
        .eq('draft_session_id', sessionId)
        .eq('drafted_by', participantId)
        .eq('is_drafted', true);

    if (picksErr) { console.error(picksErr); return null; }

    // 2. Fetch available cards
    const { data: available, error: availableErr } = await supabase
        .from('tesseract_card_pools')
        .select('id, card_name, colors, card_type, cubecobra_elo')
        .eq('draft_session_id', sessionId)
        .eq('is_drafted', false)
        .not('id', 'in', `(${excludedIds.join(',')})`)
        .not('cubecobra_elo', 'is', null)
        .limit(500); // Analyze a sufficiently large batch

    if (availableErr) { console.error(availableErr); return null; }
    if (!available || available.length === 0) return null;

    // 3. Simple Color Affinity Calculation (no budget, no history)
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    (picks || []).forEach(p => (p.colors || []).forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; }));

    const sorted = available.map(card => {
        let elo = card.cubecobra_elo || 1000;
        let affinity = 1.0;
        if (card.colors && card.colors.length > 0) {
            affinity = 1 + card.colors.reduce((sum, color) => sum + (colorCounts[color] || 0), 0) * 0.05;
        }
        return { ...card, effective_elo: elo * affinity };
    }).sort((a, b) => b.effective_elo - a.effective_elo);
    
    return sorted[0] as TesseractCardForAlgo;
}


// Functions to manage the queue
export async function getTesseractDraftQueue(participantId: string): Promise<{ queue: TesseractQueueEntry[] }> {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('tesseract_draft_queues')
        .select('card_pool_id, position, tesseract_card_pools(card_name)')
        .eq('participant_id', participantId)
        .order('position', { ascending: true });

    return { queue: (data || []).map(q => ({ cardPoolId: q.card_pool_id, position: q.position, cardName: q.tesseract_card_pools?.card_name || 'Unknown' })) };
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
            // Found a valid pick in the queue
            return { success: true, card: { id: entry.cardPoolId, card_name: entry.cardName, colors: [], card_type: '', cubecobra_elo: 0 } };
        }
    }

    // 2. Fallback to algorithm
    const card = await computeTesseractPick(participantId, sessionId, excludedIds);
    if (!card) return { success: false };

    return { success: true, card };
}
