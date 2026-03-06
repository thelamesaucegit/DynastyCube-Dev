// src/app/actions/adminActions.ts

"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards } from "@/lib/scryfall-client";
import { GameState } from "@/app/types";

interface Team {
  id: string;
  name: string;
  emoji: string;
}

interface AiProfile {
  id: string;
  profile_name: string;
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

// --- THIS IS THE ONLY MODIFIED FUNCTION IN THIS FILE ---
export async function getMatchReplay(matchId: string): Promise<{ gameStates: GameState[] | null; team1: Team | null; team2: Team | null; } | null> {
    const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    if (!matchId) {
        console.error("getMatchReplay called with invalid matchId");
        return null;
    }

    // The select statement is correct, but we must handle the fact that Supabase
    // can return a to-one relationship as an array with one element.
    const { data, error } = await supabase
        .from('sim_matches')
        .select(`
            game_states,
            team1:team1_id ( id, name, emoji ),
            team2:team2_id ( id, name, emoji )
        `)
        .eq('id', matchId)
        .single();

    if (error) {
        console.error(`Error fetching replay for match ${matchId}:`, error);
        return null;
    }
    if (!data) {
        return null;
    }

    // --- FIX: Safely handle the array-like response to prevent type errors ---
    // First, cast to 'unknown', then to the expected array type `Team[]`.
    // Then, use optional chaining `?.[0]` to safely get the first element, or null if it's not an array.
    const team1Data = (data.team1 as unknown as Team[] | null)?.[0] || null;
    const team2Data = (data.team2 as unknown as Team[] | null)?.[0] || null;

    return {
        gameStates: data.game_states || null,
        team1: team1Data,
        team2: team2Data
    };
}


export async function validateAndCanonicalizeDeck(cardNames: string[]): Promise<{ valid: Map<string, string>; invalid: string[]; }> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
    const { data, error } = await supabase.from('ai_profiles').select('id, profile_name').order('profile_name', { ascending: true });
    if (error) {
        console.error('Error fetching AI profiles:', error);
        return [];
    }
    return data || [];
}
