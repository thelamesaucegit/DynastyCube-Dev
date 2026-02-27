// src/app/actions/adminActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards } from "@/lib/scryfall-client";

// Create a Supabase client with cookies support
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
 * Backfill Color Identity data for all cards in card_pools that are missing it.
 */
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
    // 1. Fetch all card pool entries that have a null color_identity
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
    
    // 2. Get unique card names to fetch from Scryfall
    const cardNames = [...new Set(cards.map((c) => c.card_name))];
    console.log(`Fetching color identity data for ${cardNames.length} unique cards from Scryfall...`);

    // 3. Fetch all cards from Scryfall in batches
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);

    // 4. Create a map of card name to its color_identity
    const identityMap = new Map<string, string[]>();
    scryfallCards.forEach((card) => {
      // Scryfall provides the 'color_identity' field directly
      if (card.color_identity) {
        identityMap.set(card.name, card.color_identity);
      }
    });

    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall.`);
    if (notFound.length > 0) {
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }

    // 5. Update each card pool entry with its color_identity
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
        // This can happen if the card was not found in Scryfall
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

/**
 * Backfill CMC data for all draft picks that are missing it
 */
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
    // Fetch all draft picks that have null or 0 CMC
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

    // Get unique card names to fetch from Scryfall
    const cardNames = [...new Set(picks.map((p) => p.card_name))];
    console.log(`Fetching CMC data for ${cardNames.length} unique cards from Scryfall...`);

    // Fetch all cards from Scryfall in batches
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);

    // Create a map of card name to CMC
    const cmcMap = new Map<string, number>();
    scryfallCards.forEach((card) => {
      cmcMap.set(card.name, card.cmc);
    });

    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall`);
    if (notFound.length > 0) {
      console.warn(`Could not find ${notFound.length} cards:`, notFound);
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }

    // Update each draft pick with the CMC data
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

/**
 * Backfill CMC data for card pools that are missing it
 */
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
    // Fetch all card pool entries that have null or 0 CMC
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

    // Get unique card names to fetch from Scryfall
    const cardNames = [...new Set(cards.map((c) => c.card_name))];
    console.log(`Fetching CMC data for ${cardNames.length} unique cards from Scryfall...`);

    // Fetch all cards from Scryfall in batches
    const { cards: scryfallCards, notFound } = await fetchAllCards(cardNames);

    // Create a map of card name to CMC
    const cmcMap = new Map<string, number>();
    scryfallCards.forEach((card) => {
      cmcMap.set(card.name, card.cmc);
    });

    console.log(`Successfully fetched ${scryfallCards.length} cards from Scryfall`);
    if (notFound.length > 0) {
      console.warn(`Could not find ${notFound.length} cards:`, notFound);
      errors.push(`Cards not found in Scryfall: ${notFound.join(", ")}`);
    }

    // Update each card pool entry with the CMC data
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

/**
 * Backfill both draft picks and card pools in one operation
 */
export async function backfillAllCMCData(): Promise<{
  success: boolean;
  draftPicksUpdated: number;
  cardPoolsUpdated: number;
  totalFailed: number;
  errors: string[];
}> {
  console.log("Starting comprehensive CMC backfill...");

  // First, backfill card pools (source data)
  const poolsResult = await backfillCMCForCardPools();

  // Then, backfill draft picks
  const picksResult = await backfillCMCForDraftPicks();

  return {
    success: poolsResult.success && picksResult.success,
    cardPoolsUpdated: poolsResult.updated,
    draftPicksUpdated: picksResult.updated,
    totalFailed: poolsResult.failed + picksResult.failed,
    errors: [...poolsResult.errors, ...picksResult.errors],
  };
}

/**
 * Fetches all available AI profiles from the database.
 * @returns A promise that resolves to an array of AI profiles.
 */
export async function getAiProfiles(): Promise<AiProfile[]> {
  const supabase = await createClient(); // Uses the existing createClient function in this file
  const { data, error } = await supabase
    .from('ai_profiles')
    .select('*')
    .order('profile_name', { ascending: true });

  if (error) {
    console.error('Error fetching AI profiles:', error);
    // In a real app, you might want more robust error handling
    return [];
  }

  return data || [];
}

// You need to define the AiProfile type here as well since it's used
// by the getAiProfiles function. It's good practice to have shared types
// in a central file, but for now, we can define it here.
export interface AiProfile {
  id: string;
  created_at: string;
  profile_name: string;
  description: string | null;
}
