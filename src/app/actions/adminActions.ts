// src/app/actions/adminActions.ts

"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards } from "@/lib/scryfall-client";
import { GameState } from "@/app/types";
import { invalidateDraftCache } from "@/lib/draftCache";
import { createDeckVotePoll } from "@/app/actions/deckVoteActions";


interface Team {
  id: string;
  name: string;
  emoji: string;
}

interface AiProfile {
  id: string;
  profile_name: string;
}

export interface CardData {
  id?: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  color_identity?: string[];
  image_url?: string | null;
  oldest_image_url?: string | null;
  oracle_id?: string | null;
  hidden?: boolean;
  mana_cost?: string;
  cmc?: number;
  pool_name?: string;
  cubucks_cost?: number;
  created_at?: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
}


interface MatchReplayData {
  gameStates: GameState[] | null;
  team1: Team | null;
  team2: Team | null;
}

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Ignore */ }
        },
      },
    }
  );
}
/**
 * Manual override to generate deck vote polls for a specific week.
 * Use this to recover if the cron job or chaining logic fails.
 */
export async function manuallyTriggerDeckVotesForWeek(
    seasonId: string,
    weekNumber: number
): Promise<{ success: boolean; createdCount: number; error?: string }> {
    const supabase = createServiceRoleClient();
    
    try {
        // 1. Find the target week to get its ID and exact deadline
        const { data: targetWeek, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('id, deck_submission_deadline, is_playoff_week')
            .eq('season_id', seasonId)
            .eq('week_number', weekNumber)
            .single();

        if (weekError || !targetWeek) {
            return { success: false, createdCount: 0, error: `Could not find Week ${weekNumber} for the season.` };
        }

        if (targetWeek.is_playoff_week) {
             return { success: false, createdCount: 0, error: `Cannot generate polls for playoff weeks.` };
        }

        // 2. Find all active teams in the season
        // We use draft_order as a proxy for "teams in this season" 
        const { data: teams, error: teamsError } = await supabase
            .from("draft_order")
            .select("team_id")
            .eq("season_id", seasonId);

        if (teamsError || !teams || teams.length === 0) {
            return { success: false, createdCount: 0, error: "No teams found for the season." };
        }

        // 3. Create the polls using the EXACT deadline stored on the schedule_weeks row
        let createdCount = 0;
        const pollEndsAt = targetWeek.deck_submission_deadline;

        for (const team of teams) {
            const result = await createDeckVotePoll(team.team_id, targetWeek.id, pollEndsAt);
            if (result.success) {
                createdCount++;
            } else {
                console.error(`Failed to create deck vote for team ${team.team_id}: ${result.error}`);
            }
        }

        return { 
            success: true, 
            createdCount 
        };

    } catch (e) {
        return { 
            success: false, 
            createdCount: 0, 
            error: e instanceof Error ? e.message : 'Unexpected error' 
        };
    }
}
export async function manuallyInitiateFirstDeckVotes(): Promise<{ success: boolean; message: string }> {
    const supabase = await createServiceRoleClient();

    try {
        // 1. Find the active season
        const { data: activeSeason, error: seasonError } = await supabase
            .from("seasons")
            .select("id")
            .eq("is_active", true)
            .single();

        if (seasonError || !activeSeason) {
            return { success: false, message: "No active season found." };
        }

        // 2. Find Week 1 of that season
         const { data: firstWeek, error: weekError } = await supabase
            .from("schedule_weeks") 
            .select("id, start_date") 
            .eq("season_id", activeSeason.id)
            .eq("week_number", 1) 
            .single();

        if (weekError || !firstWeek) {
            return { success: false, message: "Could not find Week 1 for the active season." };
        }

        // 3. Calculate the poll's end date (Wednesday before Week 1 starts)
        const week1StartDate = new Date(firstWeek.start_date);
        const dayOfWeek = week1StartDate.getUTCDay(); // Sunday = 0, Thursday = 4

        // Find the most recent Wednesday. If start day is Thurs (4), Wednesday is 1 day before.
        // If start day is Wed (3), it's the same day.
        const daysToSubtract = (dayOfWeek + 7 - 3) % 7;
        const pollEndDate = new Date(week1StartDate);
        pollEndDate.setUTCDate(pollEndDate.getUTCDate() - daysToSubtract);
        
        // Set time to 10 PM Central Time, which is 3 AM UTC the next day during Daylight Time
        // This is a simplification; a library like `date-fns-tz` would be more robust.
        pollEndDate.setUTCHours(27, 0, 0, 0); // Corresponds to 10 PM CDT the day before

        let pollEndsAtISO = pollEndDate.toISOString();
if (pollEndDate < new Date()) {
            console.warn(`Calculated poll end date (${pollEndsAtISO}) is in the past. Defaulting to 24 hours from now.`);
            const fallbackDate = new Date();
            fallbackDate.setHours(fallbackDate.getHours() + 24);
            pollEndsAtISO = fallbackDate.toISOString();
        }
        // 4. Get all teams for the season
        const { data: teams, error: teamsError } = await supabase
            .from("draft_order")
            .select("team_id")
            .eq("season_id", activeSeason.id);

        if (teamsError || !teams || teams.length === 0) {
            return { success: false, message: "No teams found for the active season." };
        }

        // 5. Initiate a vote for each team
        let successCount = 0;
        let errorCount = 0;
        for (const team of teams) {
            const result = await createDeckVotePoll(team.team_id, firstWeek.id, pollEndsAtISO);
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                console.error(`Failed to create deck vote for team ${team.team_id}: ${result.error}`);
            }
        }

        if (errorCount > 0) {
            return { 
                success: false, 
                message: `Processed all teams. Succeeded for ${successCount}, but failed for ${errorCount}. Check server logs for details.`
            };
        }

        return { success: true, message: `Successfully initiated Week 1 deck votes for all ${successCount} teams.` };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error in manuallyInitiateFirstDeckVotes:", message);
        return { success: false, message };
    }
}
// --- NEW FUNCTION TO FETCH TEST DECKLISTS ---
export async function getTestDecklists(): Promise<{ p1_deck: string, p2_deck: string }> {
    const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    try {
        const { data, error } = await supabase.from('test_decklists').select('player_slot, decklist');
        if (error) throw error;
        
        const p1 = data.find(d => d.player_slot === 1)?.decklist || '';
        const p2 = data.find(d => d.player_slot === 2)?.decklist || '';
        
        return { p1_deck: p1, p2_deck: p2 };
    } catch (err) {
        console.error("Failed to fetch test decklists:", err);
        return { p1_deck: '', p2_deck: '' };
    }
}


export async function getMatchReplay(matchId: string): Promise<MatchReplayData | null> {
    const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    if (!matchId) {
        console.error("getMatchReplay called with invalid matchId");
        return null;
    }

    const { data: matchData, error: matchError } = await supabase
        .from('sim_matches')
        .select('game_states, team1_id, team2_id')
        .eq('id', matchId)
        .single();

    if (matchError || !matchData) {
        console.error(`Error fetching match data for ${matchId}:`, matchError?.message);
        return null;
    }

    const { game_states, team1_id, team2_id } = matchData;

    if (!team1_id || !team2_id) {
        console.error(`Match ${matchId} is missing team IDs.`);
        return { gameStates: game_states || null, team1: null, team2: null };
    }

    const { data: team1Data, error: team1Error } = await supabase
        .from('teams')
        .select('id, name, emoji')
        .eq('id', team1_id)
        .single();

    const { data: team2Data, error: team2Error } = await supabase
        .from('teams')
        .select('id, name, emoji')
        .eq('id', team2_id)
        .single();

    if (team1Error) console.error(`Error fetching team1 data for id ${team1_id}:`, team1Error.message);
    if (team2Error) console.error(`Error fetching team2 data for id ${team2_id}:`, team2Error.message);

    return {
        gameStates: game_states || null,
        team1: team1Data || null,
        team2: team2Data || null,
    };
}


export async function backfillOracleData(): Promise<{ success: boolean; updated: number; failed: number; errors: string[] }> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const errors: string[] = [];
  let updatedCount = 0;
  let failedCount = 0;
  try {
    const { data: cardsMissingOracleId, error: fetchError1 } = await supabase.from('card_pools').select('id, card_id').is('oracle_id', null);
    if (fetchError1) throw new Error(`Failed to fetch cards missing oracle_id: ${fetchError1.message}`);
    for (const card of cardsMissingOracleId) {
      try {
        await new Promise(r => setTimeout(r, 100));
        const response = await fetch(`https://api.scryfall.com/cards/${card.card_id}`);
        if (!response.ok) throw new Error(`Scryfall API error for card ${card.card_id}: ${response.statusText}`);
        const scryfallData = await response.json();
        if (scryfallData.oracle_id) {
          const { error: updateError } = await supabase.from('card_pools').update({ oracle_id: scryfallData.oracle_id }).eq('id', card.id);
          if (updateError) throw new Error(`DB update error for card ${card.id}: ${updateError.message}`);
        } else {
            failedCount++;
            errors.push(`No oracle_id found for card_id ${card.card_id}`);
        }
      } catch (e) {
        failedCount++;
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    const { data: distinctOracleIds, error: fetchError2 } = await supabase.from('card_pools').select('oracle_id').is('oldest_image_url', null).not('oracle_id', 'is', null);
    if (fetchError2) throw new Error(`Failed to fetch distinct oracle_ids: ${fetchError2.message}`);
    const uniqueOracleIds = [...new Set(distinctOracleIds.map(o => o.oracle_id))];
    for (const oracleId of uniqueOracleIds) {
         try {
            await new Promise(r => setTimeout(r, 100));
            const response = await fetch(`https://api.scryfall.com/cards/search?q=oracleid%3A${oracleId}&order=released&dir=asc&unique=prints`);
            if (!response.ok) throw new Error(`Scryfall search error for oracle_id ${oracleId}: ${response.statusText}`);
            const scryfallData = await response.json();
            const oldestImage = scryfallData?.data?.[0]?.image_uris?.normal;
            if (oldestImage) {
                const { data: updatedData, error: updateError } = await supabase.from('card_pools').update({ oldest_image_url: oldestImage }).eq('oracle_id', oracleId).select('id');
                if (updateError) throw new Error(`DB update error for oracle_id ${oracleId}: ${updateError.message}`);
                updatedCount += updatedData?.length || 0;
            } else {
                failedCount++;
                errors.push(`No image found for oracle_id ${oracleId}`);
            }
         } catch(e) {
            failedCount++;
            errors.push(e instanceof Error ? e.message : String(e));
         }
    }
    return { success: true, updated: updatedCount, failed: failedCount, errors };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    errors.push(message);
    return { success: false, updated: updatedCount, failed: failedCount, errors };
  }
}

export async function validateAndCanonicalizeDeck(cardNames: string[]): Promise<{ valid: Map<string, string>; invalid: string[]; }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const BASIC_LANDS = new Map<string, string>([["mountain", "Mountain"],["forest", "Forest"],["island", "Island"],["plains", "Plains"],["swamp", "Swamp"],]);
  const lowerCaseNames = [...new Set(cardNames.map(name => name.trim().toLowerCase()).filter(Boolean))];
  const validCanonicalMap = new Map<string, string>();
  const namesForDbCheck: string[] = [];
  for (const name of lowerCaseNames) {
    if (BASIC_LANDS.has(name)) {
      validCanonicalMap.set(name, BASIC_LANDS.get(name)!);
    } else {
      namesForDbCheck.push(name);
    }
  }
  if (namesForDbCheck.length > 0) {
    const { data: dbData, error: dbError } = await supabase.rpc('get_canonical_card_names', { names_to_check: namesForDbCheck });
    if (dbError) {
      console.error("Database error during card validation:", dbError);
      const invalidNames = lowerCaseNames.filter(name => !validCanonicalMap.has(name));
      return { valid: validCanonicalMap, invalid: invalidNames };
    }
    (dbData as { canonical_name: string }[]).forEach(item => {
      validCanonicalMap.set(item.canonical_name.toLowerCase(), item.canonical_name);
    });
  }
  const invalidNames = lowerCaseNames.filter(name => !validCanonicalMap.has(name));
  return { valid: validCanonicalMap, invalid: invalidNames };
}

export async function backfillColorIdentity(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> {
    const supabase = await createClient();
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    try {
        const { data: cards, error: fetchError } = await supabase.from("card_pools").select("id, card_name").is("color_identity", null);
        if (fetchError) return { success: false, updated: 0, failed: 0, errors: [`Failed to fetch cards: ${fetchError.message}`] };
        if (!cards || cards.length === 0) return { success: true, updated: 0, failed: 0, errors: ["No cards found missing color identity."] };
        const cardNames = [...new Set(cards.map((c) => c.card_name))];
        const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
        const identityMap = new Map<string, string[]>();
        scryfallCards.forEach((card) => {
            if (card.color_identity) identityMap.set(card.name, card.color_identity);
        });
        if (notFound.length > 0) errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
        for (const card of cards) {
            const identity = identityMap.get(card.card_name);
            if (identity !== undefined) {
                const { error: updateError } = await supabase.from("card_pools").update({ color_identity: identity }).eq("id", card.id);
                if (updateError) {
                    errors.push(`Failed to update ${card.card_name}: ${updateError.message}`);
                    failedCount++;
                } else {
                    updatedCount++;
                }
            } else {
                failedCount++;
            }
        }
        return { success: true, updated: updatedCount, failed: failedCount, errors };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, updated: updatedCount, failed: failedCount, errors: [`Unexpected error: ${errorMessage}`] };
    }
}

export async function backfillCMCForDraftPicks(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> {
    const supabase = await createServiceRoleClient();
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    try {
        const { data: picks, error: fetchError } = await supabase.from("team_draft_picks").select("id, card_name, cmc").or("cmc.is.null,cmc.eq.0");
        if (fetchError) return { success: false, updated: 0, failed: 0, errors: [`Failed to fetch draft picks: ${fetchError.message}`] };
        if (!picks || picks.length === 0) return { success: true, updated: 0, failed: 0, errors: ["No draft picks found missing CMC data"] };
        const cardNames = [...new Set(picks.map((p) => p.card_name))];
        const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
        const cmcMap = new Map<string, number>();
        scryfallCards.forEach((card) => { cmcMap.set(card.name, card.cmc); });
        if (notFound.length > 0) errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
        for (const pick of picks) {
            const cmc = cmcMap.get(pick.card_name);
            if (cmc !== undefined) {
                const { error: updateError } = await supabase.from("team_draft_picks").update({ cmc }).eq("id", pick.id);
                if (updateError) {
                    errors.push(`Failed to update ${pick.card_name}: ${updateError.message}`);
                    failedCount++;
                } else {
                    updatedCount++;
                }
            } else {
                failedCount++;
            }
        }
        return { success: true, updated: updatedCount, failed: failedCount, errors };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, updated: updatedCount, failed: failedCount, errors: [`Unexpected error: ${errorMessage}`] };
    }
}

export async function backfillCMCForCardPools(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> {
    const supabase = await createServiceRoleClient();
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    try {
        const { data: cards, error: fetchError } = await supabase.from("card_pools").select("id, card_name, cmc").or("cmc.is.null,cmc.eq.0");
        if (fetchError) return { success: false, updated: 0, failed: 0, errors: [`Failed to fetch card pools: ${fetchError.message}`] };
        if (!cards || cards.length === 0) return { success: true, updated: 0, failed: 0, errors: ["No card pool entries found missing CMC data"] };
        const cardNames = [...new Set(cards.map((c) => c.card_name))];
        const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
        const cmcMap = new Map<string, number>();
        scryfallCards.forEach((card) => { cmcMap.set(card.name, card.cmc); });
        if (notFound.length > 0) errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
        for (const card of cards) {
            const cmc = cmcMap.get(card.card_name);
            if (cmc !== undefined) {
                const { error: updateError } = await supabase.from("card_pools").update({ cmc }).eq("id", card.id);
                if (updateError) {
                    errors.push(`Failed to update ${card.card_name}: ${updateError.message}`);
                    failedCount++;
                } else {
                    updatedCount++;
                }
            } else {
                failedCount++;
            }
        }
        return { success: true, updated: updatedCount, failed: failedCount, errors };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, updated: updatedCount, failed: failedCount, errors: [`Unexpected error: ${errorMessage}`] };
    }
}

export async function backfillAllCMCData(): Promise<{ success: boolean; draftPicksUpdated: number; cardPoolsUpdated: number; totalFailed: number; errors: string[]; }> {
    const poolsResult = await backfillCMCForCardPools();
    const picksResult = await backfillCMCForDraftPicks();

    return {
        success: poolsResult.success && picksResult.success,
        cardPoolsUpdated: poolsResult.updated,
        draftPicksUpdated: picksResult.updated,
        totalFailed: poolsResult.failed + picksResult.failed,
        errors: [...poolsResult.errors, ...picksResult.errors],
    };
}

export async function getAiProfiles(): Promise<AiProfile[]> {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase.from('ai_profiles').select('id, profile_name').order('profile_name', { ascending: true });
    if (error) {
        console.error('Error fetching AI profiles:', error);
        return [];
    }
    return data || [];
}
