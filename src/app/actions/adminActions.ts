// src/app/actions/adminActions.ts

"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards } from "@/lib/scryfall-client";

// This function creates a client authenticated as the CURRENT USER.
async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}

/**
 * Fetches the replay data (an array of game states) for a single match.
 * @param matchId The UUID of the match.
 * @returns A promise that resolves to an array of GameState objects or null.
 */
export async function getMatchReplay(matchId: string): Promise<any[] | null> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  if (!matchId) {
    console.error("getMatchReplay called with invalid matchId");
    return null;
  }

  const { data, error } = await supabase
    .from('sim_matches')
    .select('game_states')
    .eq('id', matchId)
    .single();

  if (error) {
    console.error(`Error fetching replay for match ${matchId}:`, error);
    return null;
  }

  return data?.game_states || null;
}

/**
 * Validates a list of card names against the database, case-insensitively,
 * while also whitelisting basic lands.
 * @param cardNames - An array of card names entered by the user.
 * @returns An object containing a map of valid names (lowercase -> canonical) and an array of invalid names.
 */
export async function validateAndCanonicalizeDeck(cardNames: string[]): Promise<{
  valid: Map<string, string>;
  invalid: string[];
}> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const BASIC_LANDS = new Map<string, string>([
    ["mountain", "Mountain"],
    ["forest", "Forest"],
    ["island", "Island"],
    ["plains", "Plains"],
    ["swamp", "Swamp"],
  ]);

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

    dbData.forEach((item: { canonical_name: string }) => {
      validCanonicalMap.set(item.canonical_name.toLowerCase(), item.canonical_name);
    });
  }

  const invalidNames = lowerCaseNames.filter(name => !validCanonicalMap.has(name));
  
  return { valid: validCanonicalMap, invalid: invalidNames };
}

export async function backfillColorIdentity(): Promise<{
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createClient();
  let updatedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  try {
    const { data: cards, error: fetchError } = await supabase
      .from("card_pools")
      .select("id, card_name")
      .is("color_identity", null);
    if (fetchError) {
      return { success: false, updated: 0, failed: 0, errors: [`Failed to fetch cards: ${fetchError.message}`] };
    }
    if (!cards || cards.length === 0) {
      return { success: true, updated: 0, failed: 0, errors: ["No cards found missing color identity."] };
    }
    console.log(`Found ${cards.length} cards missing color identity.`);
    
    const cardNames = [...new Set(cards.map((c) => c.card_name))];
    console.log(`Fetching color identity data for ${cardNames.length} unique cards from Scryfall...`);
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
    const identityMap = new Map<string, string[]>();
    scryfallCards.forEach((card) => {
      if (card.color_identity) {
        identityMap.set(card.name, card.color_identity);
      }
    });
    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall.`);
    if (notFound.length > 0) {
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }
    for (const card of cards) {
      const identity = identityMap.get(card.card_name);
      if (identity !== undefined) {
        const { error: updateError } = await supabase
          .from("card_pools")
          .update({ color_identity: identity })
          .eq("id", card.id);
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
    console.log(`Color identity backfill complete: ${updatedCount} updated, ${failedCount} failed.`);
    return { success: true, updated: updatedCount, failed: failedCount, errors };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error during color identity backfill:", error);
    return { success: false, updated: updatedCount, failed: failedCount, errors: [`Unexpected error: ${errorMessage}`] };
  }
}

export async function backfillCMCForDraftPicks(): Promise<{
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createClient();
  let updatedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  try {
    const { data: picks, error: fetchError } = await supabase
      .from("team_draft_picks")
      .select("id, card_name, cmc")
      .or("cmc.is.null,cmc.eq.0");
    if (fetchError) {
      return {
        success: false,
        updated: 0,
        failed: 0,
        errors: [`Failed to fetch draft picks: ${fetchError.message}`],
      };
    }
    if (!picks || picks.length === 0) {
      return {
        success: true,
        updated: 0,
        failed: 0,
        errors: ["No draft picks found missing CMC data"],
      };
    }
    console.log(`Found ${picks.length} draft picks missing CMC data`);
    const cardNames = [...new Set(picks.map((p) => p.card_name))];
    console.log(`Fetching CMC data for ${cardNames.length} unique cards from Scryfall...`);
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
    const cmcMap = new Map<string, number>();
    scryfallCards.forEach((card) => {
      cmcMap.set(card.name, card.cmc);
    });
    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall`);
    if (notFound.length > 0) {
      console.warn(`Could not find ${notFound.length} cards:`, notFound);
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }
    for (const pick of picks) {
      const cmc = cmcMap.get(pick.card_name);
      if (cmc !== undefined) {
        const { error: updateError } = await supabase
          .from("team_draft_picks")
          .update({ cmc })
          .eq("id", pick.id);
        if (updateError) {
          console.error(`Failed to update ${pick.card_name}:`, updateError);
          errors.push(`Failed to update ${pick.card_name}: ${updateError.message}`);
          failedCount++;
        } else {
          updatedCount++;
        }
      } else {
        console.warn(`No CMC data found for ${pick.card_name}`);
        failedCount++;
      }
    }
    console.log(`CMC backfill complete: ${updatedCount} updated, ${failedCount} failed`);
    return {
      success: true,
      updated: updatedCount,
      failed: failedCount,
      errors,
    };
  } catch (error) {
    console.error("Unexpected error during CMC backfill:", error);
    return {
      success: false,
      updated: updatedCount,
      failed: failedCount,
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function backfillCMCForCardPools(): Promise<{
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createClient();
  let updatedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  try {
    const { data: cards, error: fetchError } = await supabase
      .from("card_pools")
      .select("id, card_name, cmc")
      .or("cmc.is.null,cmc.eq.0");
    if (fetchError) {
      return {
        success: false,
        updated: 0,
        failed: 0,
        errors: [`Failed to fetch card pools: ${fetchError.message}`],
      };
    }
    if (!cards || cards.length === 0) {
      return {
        success: true,
        updated: 0,
        failed: 0,
        errors: ["No card pool entries found missing CMC data"],
      };
    }
    console.log(`Found ${cards.length} card pool entries missing CMC data`);
    const cardNames = [...new Set(cards.map((c) => c.card_name))];
    console.log(`Fetching CMC data for ${cardNames.length} unique cards from Scryfall...`);
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);
    
    const cmcMap = new Map<string, number>();
    scryfallCards.forEach((card) => {
      cmcMap.set(card.name, card.cmc);
    });
    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall`);
    if (notFound.length > 0) {
      console.warn(`Could not find ${notFound.length} cards:`, notFound);
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }
    for (const card of cards) {
      const cmc = cmcMap.get(card.card_name);
      if (cmc !== undefined) {
        const { error: updateError } = await supabase
          .from("card_pools")
          .update({ cmc })
          .eq("id", card.id);
        if (updateError) {
          console.error(`Failed to update ${card.card_name}:`, updateError);
          errors.push(`Failed to update ${card.card_name}: ${updateError.message}`);
          failedCount++;
        } else {
          updatedCount++;
        }
      } else {
        console.warn(`No CMC data found for ${card.card_name}`);
        failedCount++;
      }
    }
    console.log(`CMC backfill complete: ${updatedCount} updated, ${failedCount} failed`);
    return {
      success: true,
      updated: updatedCount,
      failed: failedCount,
      errors,
    };
  } catch (error) {
    console.error("Unexpected error during CMC backfill:", error);
    return {
      success: false,
      updated: updatedCount,
      failed: failedCount,
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function backfillAllCMCData(): Promise<{
  success: boolean;
  draftPicksUpdated: number;
  cardPoolsUpdated: number;
  totalFailed: number;
  errors: string[];
}> {
  console.log("Starting comprehensive CMC backfill...");
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

export async function getAiProfiles(): Promise<any[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_profiles')
    .select('*')
    .order('profile_name', { ascending: true });

  if (error) {
    console.error('Error fetching AI profiles:', error);
    return [];
  }
  return data || [];
}
