// src/app/actions/deckVoteActions.ts
"use server";

import { type AnySupabaseClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { submitDeckForWeek } from "./deckGenerationActions";
import { logSystemEvent } from "@/lib/systemLogger";
import { getTeamDraftPicks } from "./draftActions";

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

interface PollOptionRow {
    id: string;
    deck_id: string | null;
    option_text: string;
    vote_count: number;
    option_order: number;
}

interface PollWithOptions {
    id: string;
    team_id: string | null;
    poll_options: PollOptionRow[];
}

interface PollOptionSummaryRow {
    id: string;
    deck_id: string | null;
    option_text: string;
    vote_count: number;
}

interface PollSummary {
    id: string;
    title: string;
    ends_at: string;
    poll_options: PollOptionSummaryRow[];
}

interface JoinedDeckCard {
    quantity: number | null;
    team_draft_picks: { cubucks_cost: number } | { cubucks_cost: number }[] | null;
}

interface CuttablePick {
    id: string;
    card_id: string;
    card_name: string;
    cubucks_cost: number;
    cubecobra_elo: number | null;
    is_keeper: boolean;
    scars: string[] | null;
    card_pool_id: string | null;
}

/**
 * Identifies the most prominent basic land type currently in a deck to use as a replacement.
 */
async function getProminentBasicLandType(deckId: string): Promise<string> {
    const supabase = createServiceClient();
    const { data: cards } = await supabase
        .from('deck_cards')
        .select('card_name, quantity')
        .eq('deck_id', deckId)
        .eq('category', 'mainboard');

    const landCounts: Record<string, number> = { Forest: 0, Island: 0, Mountain: 0, Plains: 0, Swamp: 0 };
    (cards || []).forEach(c => {
        if (c.card_name in landCounts) {
            landCounts[c.card_name] += (c.quantity || 1);
        }
    });

    // Sort by count descending, then alphabetically descending on ties
    const sorted = Object.entries(landCounts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]); // Alphabetical tie-breaker
    });

    // If deck has some lands, return the top one
    if (sorted[0][1] > 0) return sorted[0][0];

    // Fallback: Check non-land color pips to find dominant color
    const nonLands = (cards || []).filter(c => !(c.card_name in landCounts));
    const pipCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    
    nonLands.forEach(c => {
        const name = c.card_name.toUpperCase();
        if (name.includes("WHITE")) pipCounts.W++;
        if (name.includes("BLUE")) pipCounts.U++;
        if (name.includes("BLACK")) pipCounts.B++;
        if (name.includes("RED")) pipCounts.R++;
        if (name.includes("GREEN")) pipCounts.G++;
    });

    const topColor = Object.entries(pipCounts).sort((a, b) => b[1] - a[1])[0][0];
    const COLOR_MAP: Record<string, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
    
    return COLOR_MAP[topColor] || 'Plains';
}

/**
 * Create a deck vote poll for a team for a given week.
 * Filters out decks that exceed the season's Cubucks cap!
 */
export async function createDeckVotePoll(
    teamId: string,
    weekId: string,
    pollEndsAt: string,
    adminClient?: AnySupabaseClient
): Promise<{ success: boolean; pollId?: string; error?: string }> {
    const supabase = adminClient ?? createServiceClient();

    try {
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        if (teamError || !team) return { success: false, error: 'Team not found' };

        const { data: activeSeason } = await supabase
            .from('seasons')
            .select('cubucks_allocation')
            .eq('is_active', true)
            .single();
            
        const seasonCap = activeSeason?.cubucks_allocation || 40;

        const { data: decks, error: decksError } = await supabase
            .from('team_decks')
            .select('id, deck_name')
            .eq('team_id', teamId)
            .order('updated_at', { ascending: false });

        if (decksError) return { success: false, error: decksError.message };
        if (!decks || decks.length === 0) {
            return { success: false, error: 'Team has no decks to vote on. Generate a placeholder deck first.' };
        }

        // Check if a deck vote poll already exists for this team + week
        const { data: existingPoll } = await supabase
            .from('polls')
            .select('id')
            .eq('team_id', teamId)
            .eq('week_id', weekId)
            .eq('vote_type', 'team')
            .maybeSingle();

        if (existingPoll) {
            return { success: false, error: 'A deck vote poll already exists for this team and week.' };
        }

        // FILTER DECKS: Ensure the deck's combined value does not exceed the season cap
        const validDecks = [];
        for (const deck of decks) {
            const { data: deckCards } = await supabase
                .from('deck_cards')
                .select(`quantity, team_draft_picks(cubucks_cost)`)
                .eq('deck_id', deck.id)
                .eq('category', 'mainboard')
                .not('draft_pick_id', 'is', null);
            
            let deckValue = 0;
            const safeDeckCards = (deckCards || []) as unknown as JoinedDeckCard[];
            
            safeDeckCards.forEach(dc => {
                let cost = 1;
                if (dc.team_draft_picks) {
                    cost = Array.isArray(dc.team_draft_picks) ? dc.team_draft_picks[0]?.cubucks_cost : dc.team_draft_picks.cubucks_cost;
                }
                deckValue += cost * (dc.quantity || 1);
            });
            
            if (deckValue <= seasonCap) {
                validDecks.push(deck);
            }
        }

        if (validDecks.length === 0) {
            return { success: false, error: `Team has no decks under the season cap of ${seasonCap} Cubucks. Please adjust your decks before a vote can be initiated.` };
        }

        const { data: poll, error: pollError } = await supabase
            .from('polls')
            .insert({
                title: `${team.name} — Deck Vote`,
                description: `Vote for the deck ${team.name} will use this week.`,
                team_id: teamId,
                week_id: weekId,
                vote_type: 'team',
                ends_at: pollEndsAt,
                allow_multiple_votes: false,
                show_results_before_end: true,
                is_active: true,
            })
            .select('id')
            .single();

        if (pollError || !poll) {
            return { success: false, error: pollError?.message || 'Failed to create poll' };
        }

        const optionRows = validDecks.map((deck, index) => ({
            poll_id: poll.id,
            option_text: deck.deck_name,
            option_order: index,
            deck_id: deck.id,
        }));

        const { error: optionsError } = await supabase
            .from('poll_options')
            .insert(optionRows);

        if (optionsError) {
            await supabase.from('polls').delete().eq('id', poll.id);
            return { success: false, error: `Failed to create poll options: ${optionsError.message}` };
        }

        return { success: true, pollId: poll.id };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}

/**
 * Adds an existing deck as a new option to the team's currently active deck vote.
 */
export async function addDeckToActivePoll(
    teamId: string,
    deckId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    const supabase = createServiceClient(); 
    
    try {
        const { data: activeSeason } = await supabase
            .from('seasons')
            .select('cubucks_allocation')
            .eq('is_active', true)
            .single();
            
        const seasonCap = activeSeason?.cubucks_allocation || 40;

        // 1. Get the currently active team deck vote poll
        const { data: poll, error: pollError } = await supabase
            .from('polls')
            .select('id')
            .eq('team_id', teamId)
            .eq('vote_type', 'team')
            .eq('is_active', true)
            .single();
            
        if (pollError || !poll) {
            return { success: false, error: "There is no active deck vote going on right now." };
        }

        // 2. Check if this deck is already an option in this poll
        const { data: existingOption } = await supabase
            .from('poll_options')
            .select('id')
            .eq('poll_id', poll.id)
            .eq('deck_id', deckId)
            .maybeSingle();
            
        if (existingOption) {
            return { success: false, error: "This deck is already an option in the active vote." };
        }

        // 3. VALIDATE DECK CAP
        const { data: deckCards } = await supabase
            .from('deck_cards')
            .select(`quantity, team_draft_picks(cubucks_cost)`)
            .eq('deck_id', deckId)
            .eq('category', 'mainboard')
            .not('draft_pick_id', 'is', null);
            
        let deckValue = 0;
        const safeDeckCards = (deckCards || []) as unknown as JoinedDeckCard[];
        safeDeckCards.forEach(dc => {
            let cost = 1;
            if (dc.team_draft_picks) {
                cost = Array.isArray(dc.team_draft_picks) ? dc.team_draft_picks[0]?.cubucks_cost : dc.team_draft_picks.cubucks_cost;
            }
            deckValue += cost * (dc.quantity || 1);
        });

        if (deckValue > seasonCap) {
            return { success: false, error: `This deck's value (Ç${deckValue}) exceeds the season cap of Ç${seasonCap}. It cannot be submitted to the vote.` };
        }

        // 4. Get the deck's name to use as the option text
        const { data: deck, error: deckError } = await supabase
            .from('team_decks')
            .select('deck_name')
            .eq('id', deckId)
            .single();
            
        if (deckError || !deck) {
            return { success: false, error: "Deck not found." };
        }

        // 5. Get current max option_order so we append it to the end
        const { data: maxOrderData } = await supabase
            .from('poll_options')
            .select('option_order')
            .eq('poll_id', poll.id)
            .order('option_order', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        const nextOrder = (maxOrderData?.option_order ?? -1) + 1;

        // 6. Insert the new option
        const { error: insertError } = await supabase
            .from('poll_options')
            .insert({
                poll_id: poll.id,
                option_text: deck.deck_name,
                option_order: nextOrder,
                deck_id: deckId,
                vote_count: 0
            });

        if (insertError) {
            return { success: false, error: `Failed to add option: ${insertError.message}` };
        }

        return { success: true, message: "Deck successfully added to the active vote!" };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}

/**
 * Resolve a deck vote poll — determine winner and create deck_submissions entry.
 * Includes automated ownership sweeps, basic land substitutions, and automatic roster over-cap cuts.
 */
export async function resolveDeckVotePoll(
    pollId: string,
    weekId: string
): Promise<{ success: boolean; winningDeckId?: string; submissionId?: string; error?: string }> {
    const supabase = createServiceClient();

    try {
        const { data: activeSeason } = await supabase
            .from('seasons')
            .select('id, cubucks_allocation')
            .eq('is_active', true)
            .single();
        const seasonCap = activeSeason?.cubucks_allocation || 40;

        // 1. Fetch poll with options and vote counts
        const { data: rawPoll, error: pollError } = await supabase
            .from('polls')
            .select(`
                id,
                team_id,
                poll_options (
                    id,
                    deck_id,
                    option_text,
                    vote_count,
                    option_order
                )
            `)
            .eq('id', pollId)
            .single();

        const poll = rawPoll as unknown as PollWithOptions;

        if (pollError || !poll) return { success: false, error: 'Poll not found' };
        if (!poll.team_id) return { success: false, error: 'Poll is not associated with a team' };

        const options: PollOptionRow[] = poll.poll_options;

        if (!options || options.length === 0) {
            return { success: false, error: 'Poll has no options' };
        }

        // 2. Find winner — highest vote count
        const sorted = [...options].sort((a, b) => {
            if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
            if (a.option_order !== b.option_order) return a.option_order - b.option_order;
            return a.option_text.localeCompare(b.option_text);
        });

        const winner = sorted[0];

        if (!winner.deck_id) return { success: false, error: 'Winning option has no associated deck' };

        // =====================================================================
        // AUTO-BACKFILL SUB-PIPELINE: Ownership & Deck legality sweep
        // =====================================================================
        const { picks: teamPicks } = await getTeamDraftPicks(poll.team_id, undefined, supabase);
        const ownedPickIds = new Set(teamPicks.map(p => p.id).filter(Boolean));

        const { data: deckCards } = await supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', winner.deck_id)
            .eq('category', 'mainboard');

        const unownedCards = (deckCards || []).filter(dc => dc.draft_pick_id && !ownedPickIds.has(dc.draft_pick_id));
        
        if (unownedCards.length > 0) {
            console.log(`[DeckVoteResolve] Detected ${unownedCards.length} unowned cards in winning deck. Backfilling with prominent basic land...`);
            
            const prominentLand = await getProminentBasicLandType(winner.deck_id);
            const deleteIds = unownedCards.map(c => c.id);

            await supabase.from('deck_cards').delete().in('id', deleteIds);

            const existingLand = (deckCards || []).find(dc => dc.card_name === prominentLand);
            if (existingLand) {
                await supabase
                    .from('deck_cards')
                    .update({ quantity: (existingLand.quantity || 1) + unownedCards.length })
                    .eq('id', existingLand.id);
            } else {
                await supabase
                    .from('deck_cards')
                    .insert({
                        deck_id: winner.deck_id,
                        draft_pick_id: null,
                        card_id: `basic-${prominentLand.toLowerCase()}`,
                        card_name: prominentLand,
                        quantity: unownedCards.length,
                        is_commander: false,
                        category: 'mainboard'
                    });
            }

            await logSystemEvent("DeckResolveAutoCorrect", "info", `Automatically backfilled winning deck ${winner.deck_id} with ${unownedCards.length} copies of ${prominentLand} due to ownership changes.`);
        }

        // =====================================================================
        // NEW AUTO-CUT ENGINE: Resolves over-cap limits securely
        // =====================================================================
        const { data: rawTeamPicks } = await supabase
            .from('team_draft_picks')
            .select('id, card_id, card_name, cubucks_cost, cubecobra_elo, is_keeper, scars, card_pool_id')
            .eq('team_id', poll.team_id)
            .neq('card_id', 'skipped-pick');

        const currentTeamPicks = (rawTeamPicks || []) as unknown as CuttablePick[];
        const currentTotalValue = currentTeamPicks.reduce((sum, p) => sum + (p.cubucks_cost || 1), 0);

        if (currentTotalValue > seasonCap) {
            console.log(`[DeckVoteResolve] Team ${poll.team_id} is over cap (${currentTotalValue} > ${seasonCap}). Initiating auto-cuts...`);
            
            const { data: winningDeckCards } = await supabase
                .from('deck_cards')
                .select('draft_pick_id')
                .eq('deck_id', winner.deck_id)
                .not('draft_pick_id', 'is', null);
                
            const winningPickIds = new Set(winningDeckCards?.map(dc => dc.draft_pick_id));
            
            const cuttableOutside: CuttablePick[] = [];
            const cuttableInside: CuttablePick[] = [];
            
            for (const p of currentTeamPicks) {
                if (p.is_keeper || (p.scars && p.scars.includes('eternal'))) continue;
                if (winningPickIds.has(p.id)) {
                    cuttableInside.push(p);
                } else {
                    cuttableOutside.push(p);
                }
            }
            
            // Tiebreaker: Cut lowest ELO first
            const sortByElo = (a: CuttablePick, b: CuttablePick) => (a.cubecobra_elo || 0) - (b.cubecobra_elo || 0);
            cuttableOutside.sort(sortByElo);
            cuttableInside.sort(sortByElo);
            
            const cutQueue = [...cuttableOutside, ...cuttableInside];
            let excessValue = currentTotalValue - seasonCap;
            const cutsMade = [];
            
            for (const pickToCut of cutQueue) {
                if (excessValue <= 0) break;
                
                const refundAmount = pickToCut.cubucks_cost || 1;
                
                // Refund Balance
                const { data: teamRec } = await supabase.from('teams').select('cubucks_balance, cubucks_total_spent').eq('id', poll.team_id).single();
                if (teamRec) {
                    const newBal = teamRec.cubucks_balance + refundAmount;
                    const newSpent = Math.max(0, teamRec.cubucks_total_spent - refundAmount);
                    await supabase.from('teams').update({ cubucks_balance: newBal, cubucks_total_spent: newSpent }).eq('id', poll.team_id);
                    
                    await supabase.from('cubucks_transactions').insert({
                        team_id: poll.team_id,
                        season_id: activeSeason?.id,
                        transaction_type: 'refund',
                        amount: refundAmount,
                        balance_after: newBal,
                        card_id: pickToCut.card_id,
                        card_name: pickToCut.card_name,
                        draft_pick_id: pickToCut.id,
                        description: `System Auto-Refund for over-cap cut: ${pickToCut.card_name}`
                    });
                }
                
                // Track Ownership History
                await supabase.from('card_ownership_history').upsert({
                    card_id: pickToCut.card_id, team_id: poll.team_id, season_id: activeSeason?.id
                }, { onConflict: 'card_id,team_id,season_id' });
                
                // Purge & Send to Wire
                await supabase.from('team_draft_picks').delete().eq('id', pickToCut.id);
                if (pickToCut.card_pool_id) {
                    await supabase.from('card_pools').update({ pool_name: 'wire', on_wire_since: new Date().toISOString() }).eq('id', pickToCut.card_pool_id);
                }
                
                excessValue -= refundAmount;
                cutsMade.push(pickToCut.card_name);
            }
            
            if (cutsMade.length > 0) {
                await logSystemEvent("DeckVoteAutoCut", "info", `Automatically cut ${cutsMade.length} cards from team ${poll.team_id} to drop under the ${seasonCap} cap: ${cutsMade.join(', ')}`);
            }
        }

        // =====================================================================

        // 3. Mark poll as inactive
        await supabase.from('polls').update({ is_active: false }).eq('id', pollId);

        // 4. Record result in poll_team_results
        await supabase
            .from('poll_team_results')
            .upsert({
                poll_id: pollId,
                team_id: poll.team_id,
                winning_option_id: winner.id,
                total_weighted_votes: options.reduce((sum, o) => sum + o.vote_count, 0),
            }, { onConflict: 'poll_id,team_id' });

        // 5. Generate deck_submissions entry from winning deck
        const { success, submissionId, error } = await submitDeckForWeek(
            winner.deck_id,
            poll.team_id,
            weekId,
            supabase
        );

        if (!success) {
            await logSystemEvent('resolveDeckVotePoll', 'error', 'Poll resolved but deck submission failed', { error, pollId });
            return { success: false, error: `Poll resolved but deck submission failed: ${error}` };
        }

        // 6. Auto-generate next week's poll
        const { data: currentWeekData, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('season_id, week_number, end_date')
            .eq('id', weekId)
            .single();

        if (weekError || !currentWeekData) {
            await logSystemEvent('resolveDeckVotePoll', 'error', 'Could not find current week data to chain next vote', { weekId, error: weekError });
        } else {
            const { data: nextWeek, error: nextWeekError } = await supabase
                .from('schedule_weeks')
                .select('id, deck_submission_deadline, is_playoff_week, is_championship_week')
                .eq('season_id', currentWeekData.season_id)
                .eq('week_number', currentWeekData.week_number + 1)
                .single();

            if (nextWeekError || !nextWeek) {
                await logSystemEvent('resolveDeckVotePoll', 'info', 'No upcoming week found. End of season.', { currentWeek: currentWeekData.week_number });
            } else {
                const nextPollEndsAt = nextWeek.deck_submission_deadline; 
                const result = await createDeckVotePoll(poll.team_id, nextWeek.id, nextPollEndsAt);
                
                if (!result.success) {
                    await logSystemEvent('resolveDeckVotePoll', 'error', 'Failed to auto-create next poll', { teamId: poll.team_id, nextWeekId: nextWeek.id, error: result.error });
                } else {
                    await logSystemEvent('resolveDeckVotePoll', 'info', 'Successfully queued next poll', { teamId: poll.team_id, nextWeekId: nextWeek.id, newPollId: result.pollId });
                }
            }
        }

        return { success: true, winningDeckId: winner.deck_id, submissionId };

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
        await logSystemEvent('resolveDeckVotePoll', 'error', 'Fatal error during poll resolution', { error: errorMsg, pollId });
        return { success: false, error: errorMsg };
    }
}

/**
 * Get the active deck vote poll for a team, if one exists.
 */
export async function getTeamActiveDeckVotePoll(
    teamId: string,
    weekId?: string
): Promise<{
    poll: {
        id: string;
        title: string;
        ends_at: string;
        options: Array<{
            id: string;
            deck_id: string | null;
            option_text: string;
            vote_count: number;
        }>;
    } | null;
    error?: string;
}> {
    const supabase = createServiceClient();

    try {
        let query = supabase
            .from('polls')
            .select(`
                id,
                title,
                ends_at,
                poll_options (
                    id,
                    deck_id,
                    option_text,
                    vote_count
                )
            `)
            .eq('team_id', teamId)
            .eq('vote_type', 'team')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (weekId) {
            query = query.eq('week_id', weekId);
        }

       const { data: rawData, error } = await query.maybeSingle();

        const data = rawData as unknown as PollSummary | null;

        if (error) return { poll: null, error: error.message };
        if (!data) return { poll: null };

        return {
            poll: {
                id: data.id,
                title: data.title,
                ends_at: data.ends_at,
                options: data.poll_options,
            }
        };

    } catch (e) {
        return { poll: null, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}
