// src/app/actions/wireActions.ts

"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase";
import { type CardData } from "@/app/actions/cardActions";

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

export interface WireCard extends CardData {
    currentUserTeamBid?: number;
}

// ============================================
// PUBLIC-FACING ACTIONS (for UI)
// ============================================

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
            return { cards: (wireCardsData as WireCard[]) || [] };
        }

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
        })) as WireCard[];

        return { cards: cardsWithBids };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error in getWireCards:", message);
        return { cards: [], error: message };
    }
}

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

        // =========================================================================
        //  Pre-Season Exclusive Access Gatekeeper
        // =========================================================================
        const PRE_SEASON_5_ID = '4b1d9936-bf5e-4ee5-bd56-741a7c12307e';
        const EXCLUSIVE_ACCESS_TEAMS = [
            '2bfc34c2-045b-4ac7-872b-05aeebd4c53b', // Changelings/Mimics
            '624e3ecc-672d-4ee4-8a4a-7be8c61d39e9'  // Tarkir Dragons
        ];

        if (seasonId === PRE_SEASON_5_ID && !EXCLUSIVE_ACCESS_TEAMS.includes(teamId)) {
            return { success: false, error: "Access to The Wire is temporarily restricted to expansion teams." };
        }
        // =========================================================================

        
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error in placeWireBid:", message);
        return { success: false, error: message };
    }
}

// ============================================
// CRON JOB ACTION (for automated processing)
// ============================================
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

        // THE FIX: Do not use .in() with a massive array. 
        // Fetch all active bids for the season instead. Safe, small, and fast!
        const { data: allBidsData, error: bidsError } = await supabase
            .from('wire_bids')
            .select('*')
            .eq('season_id', seasonId);

        if (bidsError) throw new Error(`Failed to fetch bids: ${bidsError.message}`);

        const allBids = (allBidsData as WireBid[]) || [];

        const { data: draftOrder, error: orderError } = await supabase.from('draft_order').select('team_id, lottery_number').eq('season_id', seasonId);
        if (orderError) throw new Error(`Failed to fetch draft order for tie-breakers: ${orderError.message}`);
        const tieBreakerMap = new Map(draftOrder?.map(o => [o.team_id, o.lottery_number]) || []);

        const { data: teamsData } = await supabase.from('teams').select('id, name, emoji');
        const teamMap = new Map(teamsData?.map(t => [t.id, t]) || []);

        const { data: teamMembers } = await supabase.from('team_members').select('team_id, user_id');
        const teamMembersMap = new Map<string, string[]>();
        teamMembers?.forEach(tm => {
            if (!teamMembersMap.has(tm.team_id)) teamMembersMap.set(tm.team_id, []);
            teamMembersMap.get(tm.team_id)!.push(tm.user_id);
        });

        const notificationsToInsert: { user_id: string; notification_type: string; message: string; }[] = [];
        const successfulCardIds: string[] = [];

        // 3. Loop through each card and process its bids
        for (const card of processableCards) {
            const bidsForCard = allBids.filter(b => b.card_pool_id === card.id);

            // Case A: No bids on the card
            if (bidsForCard.length === 0) {
                await supabase.from('card_pools').update({ pool_name: 'free', on_wire_since: null }).eq('id', card.id);
                movedToFreeAgency++;
                successfulCardIds.push(card.id); 
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
                successfulCardIds.push(card.id); 

                // Notifications Logic
                const winnerUsers = teamMembersMap.get(winner.team_id) || [];
                winnerUsers.forEach(userId => {
                    notificationsToInsert.push({
                        user_id: userId,
                        notification_type: 'wire_bid_won',
                        message: `You won ${card.card_name} off The Wire for ${winner.bid_amount} Cubucks!`
                    });
                });

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
        
        // 5. Clean up ONLY successfully processed bids
        if (successfulCardIds.length > 0) {
            // Because there could be hundreds of successful card IDs, we can batch delete bids 
            // by just deleting any bid where the season_id matches AND the pool_name is now "draft" or "free",
            // but the array delete is usually fine unless there are thousands of *bids*.
            // To be perfectly safe, we delete bids in batches of 100.
            for (let i = 0; i < successfulCardIds.length; i += 100) {
                const batch = successfulCardIds.slice(i, i + 100);
                await supabase.from('wire_bids').delete().in('card_pool_id', batch);
            }
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
