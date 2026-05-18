//src/app/actions/deckVoteActions.ts

"use server";

import { createClient } from "@supabase/supabase-js";
import { submitDeckForWeek } from "./deckGenerationActions";
import { logSystemEvent } from "@/lib/systemLogger";


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
/**
 * Create a deck vote poll for a team for a given week.
 * Poll options are the team's current decks.
 * Called automatically when a week begins, or manually by admin.
 */
export async function createDeckVotePoll(
    teamId: string,
    weekId: string,
    pollEndsAt: string
): Promise<{ success: boolean; pollId?: string; error?: string }> {
    const supabase = createServiceClient();

    try {
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        if (teamError || !team) return { success: false, error: 'Team not found' };

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

        const optionRows = decks.map((deck, index) => ({
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

        // 3. Get the deck's name to use as the option text
        const { data: deck, error: deckError } = await supabase
            .from('team_decks')
            .select('deck_name')
            .eq('id', deckId)
            .single();
            
        if (deckError || !deck) {
            return { success: false, error: "Deck not found." };
        }

        // 4. Get current max option_order so we append it to the end
        const { data: maxOrderData } = await supabase
            .from('poll_options')
            .select('option_order')
            .eq('poll_id', poll.id)
            .order('option_order', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        const nextOrder = (maxOrderData?.option_order ?? -1) + 1;

        // 5. Insert the new option
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
 * 
 * Winner is determined by total vote_count on poll_options.
 * On tie: the auto-generated deck wins, then alphabetical by deck name.
 * 
 * Call this when a poll's ends_at time passes (via cron or admin action).
 */
export async function resolveDeckVotePoll(
    pollId: string,
    weekId: string
): Promise<{ success: boolean; winningDeckId?: string; submissionId?: string; error?: string }> {
    const supabase = createServiceClient();
    try {
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

        if (pollError || !poll) {
            return { success: false, error: 'Poll not found' };
        }

        if (!poll.team_id) {
            return { success: false, error: 'Poll is not associated with a team' };
        }

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
        if (!winner.deck_id) {
            return { success: false, error: 'Winning option has no associated deck' };
        }

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
            weekId
        );

        if (!success) {
            await logSystemEvent('resolveDeckVotePoll', 'error', 'Poll resolved but deck submission failed', { error, pollId });
            return { success: false, error: `Poll resolved but deck submission failed: ${error}` };
        }

        // 6. Auto-generate next week's poll (FIXED: Now properly awaited)
        const { data: currentWeekData, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('season_id, week_number, end_date')
            .eq('id', weekId)
            .single();

        if (weekError || !currentWeekData) {
            await logSystemEvent('resolveDeckVotePoll', 'error', 'Could not find current week data to chain next vote', { weekId, error: weekError });
        } else {
            // Find the next chronological week
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
                
                // FIXED: AWAIT the creation so the serverless function doesn't kill it!
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

        // Filter to specific week if provided
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
