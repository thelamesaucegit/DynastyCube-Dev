// src/app/actions/tesseractDraftActions.ts

"use server";

import { createAdminClient } from "@/lib/supabase";
import { getTesseractSessionUser } from "@/app/actions/tesseractAuthActions";

// ============================================================================
// TYPES
// ============================================================================

export interface TesseractParticipantInfo {
    id: string;
    displayName: string;
    draftPosition: number;
}

export interface TesseractDraftStatus {
    sessionId: string;
    status: string;
    format: 'snake' | 'linear';
    currentRound: number;
    totalRounds: number;
    totalPicks: number;
    onTheClock: TesseractParticipantInfo | null;
    onDeck: TesseractParticipantInfo | null;
    pickDeadline: string | null;
    isComplete: boolean;
    participants: TesseractParticipantInfo[];
}

export interface TesseractCard {
    id: string;
    card_name: string;
    card_set: string | null;
    image_url: string | null;
    oracle_text: string | null; 
    cubecobra_elo: number | null; 
    colors: string[];
    cmc: number;
    card_type: string | null;
    is_drafted: boolean;
    drafted_by: string | null;
    drafted_by_name?: string;
    pick_number: number | null;
}

// ============================================================================
// LOGIC HELPERS
// ============================================================================

/**
 * Mathematically determines whose turn it is based on the global pick index and format.
 */
function getParticipantForPick(
    globalPickIndex: number, 
    totalParticipants: number, 
    format: 'snake' | 'linear', 
    participants: TesseractParticipantInfo[]
): TesseractParticipantInfo | null {
    if (totalParticipants === 0) return null;
    
    const roundIndex = Math.floor(globalPickIndex / totalParticipants); // 0-indexed
    const pickInRound = globalPickIndex % totalParticipants; // 0 to N-1
    
    let positionTarget = pickInRound + 1; // 1-indexed draft position (1, 2, 3...)
    
    // Reverse the order on odd rounds (0-indexed, so round 1, 3, 5...) if Snake format
    if (format === 'snake' && roundIndex % 2 !== 0) {
        positionTarget = totalParticipants - pickInRound;
    }
    
    return participants.find(p => p.draftPosition === positionTarget) || null;
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

export async function getTesseractDraftStatus(sessionId: string): Promise<{
    status: TesseractDraftStatus | null;
    error?: string;
}> {
    const adminSupabase = createAdminClient();

    try {
        // 1. Fetch Session Info
        const { data: session, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (sessionErr || !session) return { status: null, error: "Session not found." };

        // 2. Fetch Participants
        const { data: participantsData, error: partErr } = await adminSupabase
            .from('tesseract_participants')
            .select('id, display_name, draft_position')
            .eq('draft_session_id', sessionId)
            .order('draft_position', { ascending: true });

        if (partErr) return { status: null, error: "Failed to fetch participants." };
        
        const participants: TesseractParticipantInfo[] = (participantsData || []).map(p => ({
            id: p.id,
            displayName: p.display_name,
            draftPosition: p.draft_position
        }));

        const totalParticipants = participants.length;

        // 3. Get total drafted cards to determine current pick index
        const { count, error: countErr } = await adminSupabase
            .from('tesseract_card_pools')
            .select('id', { count: 'exact', head: true })
            .eq('draft_session_id', sessionId)
            .eq('is_drafted', true);

        if (countErr) return { status: null, error: "Failed to fetch pick count." };

        const totalPicks = count || 0;
        const currentRound = Math.floor(totalPicks / (totalParticipants || 1)) + 1;
        const isComplete = session.status === 'completed' || currentRound > session.total_rounds;

        const onTheClock = isComplete ? null : getParticipantForPick(totalPicks, totalParticipants, session.draft_format as 'snake' | 'linear', participants);
        const onDeck = isComplete ? null : getParticipantForPick(totalPicks + 1, totalParticipants, session.draft_format as 'snake' | 'linear', participants);

        return {
            status: {
                sessionId: session.id,
                status: session.status,
                format: session.draft_format as 'snake' | 'linear',
                currentRound,
                totalRounds: session.total_rounds,
                totalPicks,
                onTheClock,
                onDeck,
                pickDeadline: session.current_pick_deadline,
                isComplete,
                participants
            }
        };

    } catch (e: unknown) {
        return { status: null, error: e instanceof Error ? e.message : "Unknown error." };
    }
}

export async function getTesseractCards(sessionId: string): Promise<{
    available: TesseractCard[];
    drafted: TesseractCard[];
    error?: string;
}> {
    const adminSupabase = createAdminClient();

    try {
        const { data, error } = await adminSupabase
            .from('tesseract_card_pools')
            .select(`
                *,
                tesseract_participants(display_name)
            `)
            .eq('draft_session_id', sessionId)
            .order('drafted_at', { ascending: false });

        if (error) throw error;

        const allCards: TesseractCard[] = (data || []).map(row => {
            const participantData = Array.isArray(row.tesseract_participants) 
                ? row.tesseract_participants[0] 
                : row.tesseract_participants;

            return {
                id: row.id,
                card_name: row.card_name,
                card_set: row.card_set,
                image_url: row.image_url,
                colors: row.colors || [],
                cmc: row.cmc,
                card_type: row.card_type,
                is_drafted: row.is_drafted,
                drafted_by: row.drafted_by,
                drafted_by_name: participantData?.display_name,
                pick_number: row.pick_number
            };
        });

        const available = allCards.filter(c => !c.is_drafted).sort((a, b) => a.card_name.localeCompare(b.card_name));
        const drafted = allCards.filter(c => c.is_drafted).sort((a, b) => (b.pick_number || 0) - (a.pick_number || 0));

        return { available, drafted };
    } catch (e: unknown) {
        return { available: [], drafted: [], error: e instanceof Error ? e.message : "Unknown error." };
    }
}

export async function makeTesseractPick(sessionId: string, cardPoolId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const adminSupabase = createAdminClient();

    try {
        // 1. Verify User Session Securely
        const userRes = await getTesseractSessionUser(sessionId);
        if (!userRes.participant) {
            return { success: false, error: "Authentication failed. You must join the lobby." };
        }
        const participantId = userRes.participant.id;

        // 2. Fetch Draft Status & Verify Turn
        const statusRes = await getTesseractDraftStatus(sessionId);
        if (!statusRes.status) return { success: false, error: statusRes.error };

        const { status } = statusRes;
        if (status.status !== 'active') return { success: false, error: "Draft is not currently active." };
        if (status.isComplete) return { success: false, error: "Draft is already complete." };
        if (status.onTheClock?.id !== participantId) return { success: false, error: "It is not your turn to pick." };

        // 3. Fetch Session data for timer
        const { data: sessionData, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select('hours_per_pick, total_rounds')
            .eq('id', sessionId)
            .single();

        if (sessionErr || !sessionData) return { success: false, error: "Failed to fetch session settings." };

        // 4. Verify Card Availability
        const { data: cardCheck, error: cardErr } = await adminSupabase
            .from('tesseract_card_pools')
            .select('is_drafted')
            .eq('id', cardPoolId)
            .single();

        if (cardErr) return { success: false, error: "Database error checking card." };
        if (cardCheck.is_drafted) return { success: false, error: "This card has already been drafted." };

        // 5. Execute Pick (Update Card Pool)
        const pickNumber = status.totalPicks + 1;
        const { error: updateErr } = await adminSupabase
            .from('tesseract_card_pools')
            .update({
                is_drafted: true,
                drafted_by: participantId,
                drafted_at: new Date().toISOString(),
                pick_number: pickNumber,
                pick_source: 'manual'
            })
            .eq('id', cardPoolId);

        if (updateErr) throw updateErr;

        // 6. Advance Draft / Update Session
        const isNowComplete = Math.floor(pickNumber / status.participants.length) + 1 > sessionData.total_rounds;
        
        if (isNowComplete) {
            await adminSupabase.from('tesseract_draft_sessions').update({
                status: 'completed',
                current_pick_deadline: null,
                current_on_clock_participant_id: null
            }).eq('id', sessionId);
        } else {
            // Next person is up
            const nextParticipant = getParticipantForPick(pickNumber, status.participants.length, status.format, status.participants);
            const newDeadline = new Date(Date.now() + (sessionData.hours_per_pick * 60 * 60 * 1000)).toISOString();

            await adminSupabase.from('tesseract_draft_sessions').update({
                current_pick_deadline: newDeadline,
                current_on_clock_participant_id: nextParticipant?.id,
                consecutive_skipped_picks: 0
            }).eq('id', sessionId);
        }

        return { success: true };

    } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error processing pick." };
    }
}
