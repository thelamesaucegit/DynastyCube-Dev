//src/app/actions/wireActions.ts

"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { addDraftPick } from "@/app/actions/draftActions";
import { type CardData } from "@/app/actions/cardActions";
import { type DraftPick } from "@/app/actions/draftActions";
import { getActiveDraftSession } from "./draftSessionActions";

// ============================================
// TYPES
// ============================================

export interface WireBid {
    id: string;
    card_pool_id: string;
    team_id: string;
    season_id: string;
    bid_amount: number;
    placed_at: string;
}

// Extends CardData to include the user's team's specific bid for UI display
export interface WireCard extends CardData {
    currentUserTeamBid?: number;
}


// ============================================
// PUBLIC-FACING ACTIONS (for UI)
// ============================================

/**
 * Fetches all cards on The Wire and includes the current user's team's bid amount.
 */
export async function getWireCards(): Promise<{ cards: WireCard[]; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        let userTeamId: string | null = null;
        let seasonId: string | null = null;

        // Get the active season and the user's team (if they have one)
        const { session: activeSession } = await getActiveDraftSession();
        if (activeSession) {
            seasonId = activeSession.season_id;
        }
        if (user && seasonId) {
            const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
            if (teamMember) {
                userTeamId = teamMember.team_id;
            }
        }
        
        // Fetch all cards currently on The Wire
        const { data: wireCardsData, error: cardsError } = await supabase
            .from('card_pools')
            .select('*')
            .eq('pool_name', 'wire')
            .order('on_wire_since', { ascending: true });

        if (cardsError) {
            return { cards: [], error: "Failed to fetch cards from The Wire." };
        }

        if (!userTeamId || !seasonId) {
            // If no user or season, return the cards without any bid info
            return { cards: wireCardsData };
        }

        // Fetch the current team's bids for this season
        const { data: teamBids } = await supabase
            .from('wire_bids')
            .select('card_pool_id, bid_amount')
            .eq('team_id', userTeamId)
            .eq('season_id', seasonId);
        
        const bidMap = new Map(teamBids?.map(b => [b.card_pool_id, b.bid_amount]) || []);

        // Combine card data with the team's bid
        const cardsWithBids: WireCard[] = wireCardsData.map(card => ({
            ...card,
            currentUserTeamBid: bidMap.get(card.id),
        }));

        return { cards: cardsWithBids };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error in getWireCards:", message);
        return { cards: [], error: message };
    }
}

/**
 * Places or updates a team's bid on a card on The Wire.
 */
export async function placeWireBid(cardPoolId: string, bidAmount: number): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        if (bidAmount < 1) {
            return { success: false, error: "Bid must be at least 1 Cubuck." };
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Authentication required." };
        
        const { session: activeSession } = await getActiveDraftSession();
        if (!activeSession) return { success: false, error: "There is no active season." };
        const seasonId = activeSession.season_id;
        
        const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
        if (!teamMember) return { success: false, error: "You are not a member of any team." };
        const teamId = teamMember.team_id;

        // Check card ownership history
        const { data: card } = await supabase.from('card_pools').select('card_id').eq('id', cardPoolId).single();
        if (!card) return { success: false, error: "Card not found." };
        
        const { data: ownershipRecord, error: historyError } = await supabase
            .from('card_ownership_histor
