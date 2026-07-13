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

const CARDS_PER_PAGE = 50;

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

// THE NEW PAGINATED & FILTERED SERVER ACTION
export async function getPaginatedWireCards(params: {
    currentPage: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    searchTerm?: string;
    filterColors?: string[];
    matchAllColors?: boolean;
    excludeUnselected?: boolean;
    filterType?: string;
    filterRarity?: string;
    filterCmc?: string;
    filterCubucks?: string;
}): Promise<{ cards: WireCard[]; totalCount: number; error?: string }> {
    // THE FIX: Added 'await' to properly resolve the Supabase Client promise!
    const supabase = await createServerClient();
    
    const {
        currentPage, sortBy, sortOrder, searchTerm, filterColors, matchAllColors,
        excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks
    } = params;

    try {
        let query = supabase.from('card_pools').select('*', { count: 'exact' }).eq('pool_name', 'wire').not('hidden', 'eq', true);

        // SEARCH TERM FILTER
        if (searchTerm) {
            query = query.or(`card_name.ilike.%${searchTerm}%,oracle_text.ilike.%${searchTerm}%`);
        }

        // COLOR FILTER
        if (filterColors && filterColors.length > 0) {
            const wantColorless = filterColors.includes('colorless');
            const standardColors = filterColors.filter(c => c !== 'colorless');

            if (matchAllColors && standardColors.length > 0) {
                query = query.contains('colors', standardColors);
            } else if (standardColors.length > 0) {
                const colorFilterStr = standardColors.map(c => `colors.cs.{${c}}`).join(',');
                if (wantColorless) {
                    query = query.or(`colors.is.null,${colorFilterStr}`);
                } else {
                    query = query.or(colorFilterStr);
                }
            } else if (wantColorless) {
                query = query.is('colors', null);
            }

            if (excludeUnselected && standardColors.length > 0) {
                query = query.containedBy('colors', standardColors);
            }
        }

        // TYPE FILTER
        if (filterType && filterType !== 'all') {
            query = query.ilike('card_type', `%${filterType}%`);
        }

        // RARITY FILTER
        if (filterRarity && filterRarity !== 'all') {
            query = query.eq('rarity', filterRarity);
        }
        
        // CMC FILTER
        if (filterCmc && filterCmc !== 'all') {
            if (filterCmc === "0-1") query = query.lte('cmc', 1);
            else if (filterCmc === "2-3") query = query.gte('cmc', 2).lte('cmc', 3);
            else if (filterCmc === "4-5") query = query.gte('cmc', 4).lte('cmc', 5);
            else if (filterCmc === "6+") query = query.gte('cmc', 6);
        }

        // CUBUCKS FILTER
        if (filterCubucks && filterCubucks !== 'all') {
            if (filterCubucks === "0-1") query = query.lte('cubucks_cost', 1);
            else if (filterCubucks === "2-3") query = query.gte('cubucks_cost', 2).lte('cubucks_cost', 3);
            else if (filterCubucks === "4-6") query = query.gte('cubucks_cost', 4).lte('cubucks_cost', 6);
            else if (filterCubucks === "7+") query = query.gte('cubucks_cost', 7);
        }

        // SORTING (Non-color)
        if (sortBy !== 'color') {
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        // PAGINATION
        const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
        query = query.range(startIndex, startIndex + CARDS_PER_PAGE - 1);

        const { data, error, count } = await query;

        if (error) throw error;
        
        let finalCards = data as WireCard[] || [];
        
        // POST-FETCH SORTING FOR COLOR (Requires JS evaluation)
        if (sortBy === 'color') {
            const getColorSortValue = (colors?: string[] | null) => {
                if (!colors || colors.length === 0) return 7;
                if (colors.length > 1) return 6;
                const c = colors[0];
                if (c === 'W') return 1; if (c === 'U') return 2; if (c === 'B') return 3; if (c === 'R') return 4; if (c === 'G') return 5;
                return 8;
            };
            finalCards.sort((a, b) => {
                const valA = getColorSortValue(a.colors);
                const valB = getColorSortValue(b.colors);
                if (valA === valB) return a.card_name.localeCompare(b.card_name);
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            });
        }

        // FETCH CURRENT USER BIDS TO APPEND TO CARDS
        const { data: { user } } = await supabase.auth.getUser();
        if (user && finalCards.length > 0) {
            const { data: activeSeason } = await supabase.from('seasons').select('id').eq('is_active', true).single();
            const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
            
            if (activeSeason && teamMember) {
                const cardIds = finalCards.map(c => c.id);
                const { data: teamBids } = await supabase
                    .from('wire_bids')
                    .select('card_pool_id, bid_amount')
                    .eq('team_id', teamMember.team_id)
                    .eq('season_id', activeSeason.id)
                    .in('card_pool_id', cardIds);
                
                if (teamBids && teamBids.length > 0) {
                    const bidMap = new Map(teamBids.map(b => [b.card_pool_id, b.bid_amount]));
                    finalCards = finalCards.map(card => ({
                        ...card,
                        currentUserTeamBid: bidMap.get(card.id),
                    }));
                }
            }
        }
        
        return { cards: finalCards, totalCount: count || 0 };

    } catch (error) {
        console.error("Error in getPaginatedWireCards:", error);
        return { cards: [], totalCount: 0, error: 'Failed to fetch cards from The Wire.' };
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
        console.error("Fatal error in processWir
