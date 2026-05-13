//src/app/actions/wireActions.ts

"use server";

import { createServerClient, createAdminClient, type AnySupabaseClient } from "@/lib/supabase";
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
 * Fetches all non-hidden cards on The Wire and includes the current user's team's bid amount.
 */
export async function getWireCards(): Promise<{ cards: WireCard[]; error?: string }> {
    const supabase = await createServerClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        let userTeamId: string | null = null;
        let seasonId: string | null = null;

        const { data: activeSeason } = await supabase.from('seasons').select('id').eq('is_active', true).single();
        if (activeSeason) seasonId = activeSeason.id;

        if (user && seasonId) {
            const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
            if (teamMember) userTeamId = teamMember.team_id;
        }
        
        // Fetch ALL non-hidden cards currently on the wire
        const { data: wireCardsData, error: cardsError } = await supabase
            .from('card_pools')
            .select('*')
            .eq('pool_name', 'wire')
            .not('hidden', 'eq', true)
            .order('on_wire_since', { ascending: true });

        if (cardsError) {
            return { cards: [], error: "Failed to fetch cards from The Wire." };
        }

        if (!userTeamId || !seasonId || !wireCardsData || wireCardsData.length === 0) {
            return { cards: wireCardsData || [] };
        }

        // Fetch the current team's bids for this season
        const cardIds = wireCardsData.map(c => c.id);
        const { data: teamBids } = await supabase
            .from('wire_bids')
            .select('card_pool_id, bid_amount')
            .eq('team_id', userTeamId)
            .eq('season_id', seasonId)
            .in('card_pool_id', cardIds);
        
        const bidMap = new Map(teamBids?.map(b => [b.card_pool_id, b.bid_amount]) || []);

        const cardsWithBids: WireCard[] = wireCardsData.map(card => ({
            ...card,
            currentUserTeamBid: bidMap.get(card.id),
        }));

        return { cards: cardsWithBids };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
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
        
          const { data: activeSeason } = await supabase
            .from('seasons')
            .select('id')
            .eq('is_active', true)
            .single();
            
        if (!activeSeason) return { success: false, error: "There is no active season." };
        const seasonId = activeSeason.id;
        
        const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
        if (!teamMember) return { success: false, error: "You are not a member of any team." };
        const teamId = teamMember.team_id;

        // Check card ownership history
        const { data: card } = await supabase.from('card_pools').select('card_id').eq('id', cardPoolId).single();
        if (!card) return { success: false, error: "Card not found." };
        
        const { data: ownershipRecord, error: historyError } = await supabase
            .from('card_ownership_history')
            .select('id')
            .eq('card_id', card.card_id)
            .eq('team_id', teamId)
            .eq('season_id', seasonId)
            .maybeSingle();
            
        if (historyError) {
             console.error("Error checking ownership history:", historyError);
             return { success: false, error: "Could not verify card ownership history." };
        }

        if (ownershipRecord) {
            return { success: false, error: "Your team has previously cut this card this season and cannot place a bid on it." };
        }

        // Upsert the bid
        const { error: bidError } = await supabase.from('wire_bids').upsert({
            card_pool_id: cardPoolId,
            team_id: teamId,
            season_id: seasonId,
            bid_amount: bidAmount,
            placed_at: new Date().toISOString(),
        }, { onConflict: 'card_pool_id,team_id,season_id' });

        if (bidError) {
            console.error("Error placing bid:", bidError);
            return { success: false, error: "Failed to place bid." };
        }

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error in placeWireBid:", message);
        return { success: false, error: message };
    }
}


// ============================================
// CRON JOB ACTION (for automated processing)
// ============================================

/**
 * Processes all outstanding wire bids. Intended to be called by a scheduled cron job.
 */
/**
 * Processes all outstanding wire bids. Intended to be called by a scheduled cron job.
 */
export async function processWireBids(): Promise<{ success: boolean; processedBids: number; movedToFreeAgency: number; error?: string }> {
    console.log("Starting Wire bid processing...");
    const supabase = createAdminClient(); 
    let processedBids = 0;
    let movedToFreeAgency = 0;

    try {
        const { data: activeSeason, error: seasonError } = await supabase
            .from('seasons')
            .select('id')
            .eq('is_active', true)
            .single();

        if (seasonError || !activeSeason) {
            return { success: true, processedBids: 0, movedToFreeAgency: 0, error: "No active season found." };
        }

        const seasonId = activeSeason.id;

        // 1. Get all cards on the wire for more than 48 hours (Added card_name for notifications)
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: processableCards, error: cardError } = await supabase
            .from('card_pools')
            .select('id, on_wire_since, card_name')
            .eq('pool_name', 'wire')
            .lte('on_wire_since', twoDaysAgo);
        
        if (cardError) throw new Error(`Failed to fetch processable cards: ${cardError.message}`);
        if (!processableCards || processableCards.length === 0) {
            console.log("No cards on The Wire are ready for processing.");
            return { success: true, processedBids: 0, movedToFreeAgency: 0 };
        }
        
        console.log(`Found ${processableCards.length} cards to process.`);
        const cardIds = processableCards.map(c => c.id);

        // 2. Fetch required context for processing and notifications
        const { data: allBids, error: bidsError } = await supabase.from('wire_bids').select('*').in('card_pool_id', cardIds);
        if (bidsError) throw new Error(`Failed to fetch bids: ${bidsError.message}`);

        const { data: draftOrder, error: orderError } = await supabase.from('draft_order').select('team_id, lottery_number').eq('season_id', seasonId);
        if (orderError) throw new Error(`Failed to fetch draft order for tie-breakers: ${orderError.message}`);
        const tieBreakerMap = new Map(draftOrder?.map(o => [o.team_id, o.lottery_number]) || []);

        // Pre-fetch teams and members for notifications
        const { data: teamsData } = await supabase.from('teams').select('id, name, emoji');
        const teamMap = new Map(teamsData?.map(t => [t.id, t]) || []);

        const { data: teamMembers } = await supabase.from('team_members').select('team_id, user_id');
        const teamMembersMap = new Map<string, string[]>();
        teamMembers?.forEach(tm => {
            if (!teamMembersMap.has(tm.team_id)) teamMembersMap.set(tm.team_id, []);
            teamMembersMap.get(tm.team_id)!.push(tm.user_id);
        });
        
        // Array to collect all notifications for bulk insertion
        const notificationsToInsert: any[] = [];

        // 3. Loop through each card and process its bids
        for (const card of processableCards) {
            const bidsForCard = allBids?.filter(b => b.card_pool_id === card.id) || [];

            // Case A: No bids on the card
            if (bidsForCard.length === 0) {
                await supabase.from('card_pools').update({ pool_name: 'free', on_wire_since: null }).eq('id', card.id);
                movedToFreeAgency++;
                console.log(`Card ${card.id} moved to Free Agency.`);
                continue;
            }

            // Case B: Bids exist, find the winner
            let highestBid = 0;
            bidsForCard.forEach(b => { if (b.bid_amount > highestBid) highestBid = b.bid_amount; });
            
            const topBidders = bidsForCard.filter(b => b.bid_amount === highestBid);
            
            let winner: WireBid;
            if (topBidders.length === 1) {
                winner = topBidders[0];
            } else {
                winner = topBidders.reduce((best, current) => {
                    const bestRank = tieBreakerMap.get(best.team_id) ?? 999;
                    const currentRank = tieBreakerMap.get(current.team_id) ?? 999;
                    return currentRank < bestRank ? current : best;
                });
            }
            console.log(`Card ${card.id}: Team ${winner.team_id} won with a bid of ${winner.bid_amount}.`);
            
            // 4. Process the winning transaction
            const { error: rpcError } = await supabase.rpc('process_wire_win', {
                p_team_id: winner.team_id,
                p_card_pool_id: card.id,
                p_winning_bid: winner.bid_amount,
                p_season_id: seasonId 
            });
            
            if (rpcError) {
                console.error(`Error processing wire win for card ${card.id} and team ${winner.team_id}:`, rpcError);
            } else {
                processedBids++;

                // Queue Winner Notifications
                const winnerUsers = teamMembersMap.get(winner.team_id) || [];
                winnerUsers.forEach(userId => {
                    notificationsToInsert.push({
                        user_id: userId,
                        notification_type: 'wire_bid_won',
                        message: `You won ${card.card_name} off The Wire for ${winner.bid_amount} Cubucks!`
                    });
                });

                // Queue Loser Notifications
                const losingBids = bidsForCard.filter(b => b.team_id !== winner.team_id);
                const losingTeams = [...new Set(losingBids.map(b => b.team_id))];
                const winnerTeamInfo = teamMap.get(winner.team_id);
                const winnerName = winnerTeamInfo ? `${winnerTeamInfo.emoji} ${winnerTeamInfo.name}` : 'Another team';

                losingTeams.forEach(teamId => {
                    const loserUsers = teamMembersMap.get(teamId) || [];
                    loserUsers.forEach(userId => {
                        notificationsToInsert.push({
                            user_id: userId,
                            notification_type: 'wire_bid_lost',
                            message: `You were outbid on ${card.card_name}. ${winnerName} won it for ${winner.bid_amount} Cubucks.`
                        });
                    });
                });
            }
        }
        
        // 5. Clean up processed bids and dispatch notifications
        if (cardIds.length > 0) {
            await supabase.from('wire_bids').delete().in('card_pool_id', cardIds);
        }

        if (notificationsToInsert.length > 0) {
            await supabase.from('notifications').insert(notificationsToInsert);
        }

        console.log(`Wire processing complete. Processed Bids: ${processedBids}, Moved to Free Agency: ${movedToFreeAgency}.`);
        return { success: true, processedBids, movedToFreeAgency };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Fatal error in processWireBids:", message);
        return { success: false, processedBids, movedToFreeAgency, error: message };
    }
}

