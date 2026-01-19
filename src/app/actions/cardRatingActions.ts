// src/app/actions/cardRatingActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import {
  searchCardByName,
  fetchAllCards,
  extractRatingData,
  type ScryfallCard,
} from "@/lib/scryfall-client";

interface CardRatingResult {
  success: boolean;
  updatedCount?: number;
  notFoundCount?: number;
  errorCount?: number;
  message?: string;
  errors?: string[];
}

/**
 * Update ratings for cards in card_pools table
 */
export async function updatePoolCardRatings(): Promise<CardRatingResult> {
  try {
    const supabase = await createServerClient();

    // Check admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    // Fetch all cards from pool
    const { data: cards, error: fetchError } = await supabase
      .from("card_pools")
      .select("id, card_name, card_id");

    if (fetchError) {
      console.error("Error fetching cards from pool:", fetchError);
      return {
        success: false,
        message: `Database error: ${fetchError.message}`,
      };
    }

    if (!cards || cards.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: "No cards found in pool",
      };
    }

    console.log(`Fetching ratings for ${cards.length} cards from Scryfall...`);

    // Fetch card data from Scryfall
    const cardNames = cards.map(c => c.card_name);
    const { cards: scryfallCards, notFound, errors } = await fetchAllCards(cardNames);

    console.log(
      `Scryfall results: ${scryfallCards.length} found, ${notFound.length} not found, ${errors.length} errors`
    );

    // Update cards with rating data
    let updatedCount = 0;
    const updateErrors: string[] = [...errors];

    for (const scryfallCard of scryfallCards) {
      const poolCard = cards.find(c => c.card_name === scryfallCard.name);
      if (!poolCard) continue;

      const ratingData = extractRatingData(scryfallCard);

      const { error: updateError } = await supabase
        .from("card_pools")
        .update({
          edhrec_rank: ratingData.edhrecRank,
          scryfall_id: ratingData.scryfallId,
          rating_updated_at: ratingData.updatedAt,
        })
        .eq("id", poolCard.id);

      if (updateError) {
        updateErrors.push(`Failed to update ${scryfallCard.name}: ${updateError.message}`);
        console.error(`Error updating card ${scryfallCard.name}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      notFoundCount: notFound.length,
      errorCount: updateErrors.length,
      message: `Updated ${updatedCount} cards. Not found: ${notFound.length}. Errors: ${updateErrors.length}`,
      errors: updateErrors.length > 0 ? updateErrors : undefined,
    };
  } catch (error) {
    console.error("Unexpected error updating pool card ratings:", error);
    return {
      success: false,
      message: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Update ratings for cards in team_draft_picks table
 */
export async function updateDraftPickRatings(): Promise<CardRatingResult> {
  try {
    const supabase = await createServerClient();

    // Check admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    // Fetch all draft picks
    const { data: picks, error: fetchError } = await supabase
      .from("team_draft_picks")
      .select("id, card_name, card_id");

    if (fetchError) {
      console.error("Error fetching draft picks:", fetchError);
      return {
        success: false,
        message: `Database error: ${fetchError.message}`,
      };
    }

    if (!picks || picks.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: "No draft picks found",
      };
    }

    console.log(`Fetching ratings for ${picks.length} draft picks from Scryfall...`);

    // Fetch card data from Scryfall
    const cardNames = picks.map(p => p.card_name);
    const { cards: scryfallCards, notFound, errors } = await fetchAllCards(cardNames);

    console.log(
      `Scryfall results: ${scryfallCards.length} found, ${notFound.length} not found, ${errors.length} errors`
    );

    // Update cards with rating data
    let updatedCount = 0;
    const updateErrors: string[] = [...errors];

    for (const scryfallCard of scryfallCards) {
      const pick = picks.find(p => p.card_name === scryfallCard.name);
      if (!pick) continue;

      const ratingData = extractRatingData(scryfallCard);

      const { error: updateError } = await supabase
        .from("team_draft_picks")
        .update({
          edhrec_rank: ratingData.edhrecRank,
          scryfall_id: ratingData.scryfallId,
          rating_updated_at: ratingData.updatedAt,
        })
        .eq("id", pick.id);

      if (updateError) {
        updateErrors.push(`Failed to update ${scryfallCard.name}: ${updateError.message}`);
        console.error(`Error updating pick ${scryfallCard.name}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      notFoundCount: notFound.length,
      errorCount: updateErrors.length,
      message: `Updated ${updatedCount} draft picks. Not found: ${notFound.length}. Errors: ${updateErrors.length}`,
      errors: updateErrors.length > 0 ? updateErrors : undefined,
    };
  } catch (error) {
    console.error("Unexpected error updating draft pick ratings:", error);
    return {
      success: false,
      message: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Update ratings for all cards (both pools and draft picks)
 */
export async function updateAllCardRatings(): Promise<{
  success: boolean;
  poolResult?: CardRatingResult;
  draftResult?: CardRatingResult;
  message?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    console.log("Starting full card rating update...");

    const poolResult = await updatePoolCardRatings();
    const draftResult = await updateDraftPickRatings();

    const totalUpdated = (poolResult.updatedCount || 0) + (draftResult.updatedCount || 0);
    const totalNotFound = (poolResult.notFoundCount || 0) + (draftResult.notFoundCount || 0);
    const totalErrors = (poolResult.errorCount || 0) + (draftResult.errorCount || 0);

    return {
      success: poolResult.success && draftResult.success,
      poolResult,
      draftResult,
      message: `Total: ${totalUpdated} updated, ${totalNotFound} not found, ${totalErrors} errors`,
    };
  } catch (error) {
    console.error("Unexpected error in updateAllCardRatings:", error);
    return {
      success: false,
      message: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Get single card rating by name (for testing)
 */
export async function getCardRating(
  cardName: string
): Promise<{
  success: boolean;
  card?: ScryfallCard;
  message?: string;
}> {
  try {
    const card = await searchCardByName(cardName);

    if (!card) {
      return {
        success: false,
        message: `Card "${cardName}" not found on Scryfall`,
      };
    }

    return {
      success: true,
      card,
      message: `Found ${card.name} with EDHREC rank: ${card.edhrec_rank || "N/A"}`,
    };
  } catch (error) {
    console.error("Error getting card rating:", error);
    return {
      success: false,
      message: `Error: ${error}`,
    };
  }
}
