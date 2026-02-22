// src/app/actions/cardActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { invalidateDraftCache } from '@/lib/draftCache';

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
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export interface CardData {
  id?: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  mana_cost?: string;
  cmc?: number;
  pool_name?: string;
  cubucks_cost?: number;
  created_at?: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
}

export async function getCardPool(
  poolName: string = "default"
): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("card_pools")
      .select("*")
      .eq("pool_name", poolName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching card pool:", error);
      return { cards: [], error: error.message };
    }
    return { cards: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching card pool:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

/**
 * Fetch available cards for drafting (excludes cards already drafted by any team)
 */
export async function getAvailableCardsForDraft(
  poolName: string = "default"
): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = await createClient();

  try {
    // First get all cards in the pool
    const { data: allCards, error: poolError } = await supabase
      .from("card_pools")
      .select("*")
      .eq("pool_name", poolName)
      .order("card_name", { ascending: true });

    if (poolError) {
      console.error("Error fetching card pool:", poolError);
      return { cards: [], error: poolError.message };
    }

    // Get all drafted card IDs (from all teams)
    const { data: draftedPicks, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("card_id");

    if (draftError) {
      console.error("Error fetching drafted cards:", draftError);
      return { cards: [], error: draftError.message };
    }

    // Create a map to count how many times each card_id has been drafted
    const draftedCounts = new Map<string, number>();
    (draftedPicks || []).forEach((pick) => {
      const currentCount = draftedCounts.get(pick.card_id) || 0;
      draftedCounts.set(pick.card_id, currentCount + 1);
    });

    // Create a map to count available copies of each card_id in the pool
    const poolCounts = new Map<string, { count: number; cards: CardData[] }>();
    (allCards || []).forEach((card) => {
      const existing = poolCounts.get(card.card_id);
      if (existing) {
        existing.count++;
        existing.cards.push(card);
      } else {
        poolCounts.set(card.card_id, { count: 1, cards: [card] });
      }
    });

    // Filter to only include cards that still have available copies
    const availableCards: CardData[] = [];
    poolCounts.forEach((poolData, cardId) => {
      const draftedCount = draftedCounts.get(cardId) || 0;
      const availableCopies = poolData.count - draftedCount;

      // Add one card entry for each available copy
      for (let i = 0; i < availableCopies && i < poolData.cards.length; i++) {
        availableCards.push(poolData.cards[i]);
      }
    });

    return { cards: availableCards };
  } catch (error) {
    console.error("Unexpected error fetching available cards:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

/**
 * Add a card to the pool
 */
export async function addCardToPool(
  card: CardData,
  poolName: string = "default"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get user for audit purposes (non-blocking)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("card_pools").insert({
      card_id: card.card_id,
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors || [],
      image_url: card.image_url,
      mana_cost: card.mana_cost,
      cmc: card.cmc || 0,
      pool_name: poolName,
      created_by: user?.id || null, // Optional: for audit trail
    });

    if (error) {
      console.error("Error adding card to pool:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding card:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Add multiple cards to the pool
 */
export async function addCardsToPool(
  cards: CardData[],
  poolName: string = "default"
): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = await createClient();

  try {
    // Get user for audit purposes (non-blocking)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cardsToInsert = cards.map((card) => ({
      card_id: card.card_id,
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors || [],
      image_url: card.image_url,
      mana_cost: card.mana_cost,
      cmc: card.cmc || 0,
      pool_name: poolName,
      created_by: user?.id || null, // Optional: for audit trail
    }));

    const { data, error } = await supabase
      .from("card_pools")
      .insert(cardsToInsert)
      .select();

    if (error) {
      console.error("Error adding cards to pool:", error);
      return { success: false, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error("Unexpected error adding cards:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Bulk import cards by name with cubucks cost.
 * Each line can be "Card Name" or "Card Name, cost" to override the default cost.
 * Looks up each card via Scryfall fuzzy search.
 */
export async function bulkImportCards(
  lines: string[],
  defaultCubucksCost: number = 1,
  poolName: string = "default"
): Promise<{
  success: boolean;
  added: number;
  skipped: number;
  failed: string[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get existing cards in pool to check for duplicates
    const { data: existingCards } = await supabase
      .from("card_pools")
      .select("card_id")
      .eq("pool_name", poolName);

    const existingCardIds = new Set(
      (existingCards || []).map((c) => c.card_id)
    );

    const failed: string[] = [];
    const cardsToInsert: Array<{
      card_id: string;
      card_name: string;
      card_set?: string;
      card_type?: string;
      rarity?: string;
      colors: string[];
      image_url?: string;
      mana_cost?: string;
      cmc: number;
      cubucks_cost: number;
      pool_name: string;
      created_by: string | null;
    }> = [];
    let skipped = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Parse line: "Card Name" or "Card Name, cost"
      let cardName = trimmed;
      let cubucksCost = defaultCubucksCost;

      const lastCommaIndex = trimmed.lastIndexOf(",");
      if (lastCommaIndex !== -1) {
        const possibleCost = trimmed.substring(lastCommaIndex + 1).trim();
        const parsedCost = parseInt(possibleCost);
        if (!isNaN(parsedCost) && parsedCost >= 0) {
          cardName = trimmed.substring(0, lastCommaIndex).trim();
          cubucksCost = parsedCost;
        }
      }

      if (!cardName) continue;

      // Look up card via Scryfall fuzzy search
      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );

        if (!response.ok) {
          failed.push(cardName);
          // Respect Scryfall rate limit
          await new Promise((r) => setTimeout(r, 75));
          continue;
        }

        const card = await response.json();

        // Skip if already in pool
        if (existingCardIds.has(card.id)) {
          skipped++;
          await new Promise((r) => setTimeout(r, 75));
          continue;
        }

        // Mark as existing to avoid duplicates within the same import
        existingCardIds.add(card.id);

        cardsToInsert.push({
          card_id: card.id,
          card_name: card.name,
          card_set: card.set_name,
          card_type: card.type_line,
          rarity: card.rarity,
          colors: card.colors || [],
          image_url: card.image_uris?.normal || card.image_uris?.small || null,
          mana_cost: card.mana_cost,
          cmc: card.cmc || 0,
          cubucks_cost: cubucksCost,
          pool_name: poolName,
          created_by: user?.id || null,
        });

        // Respect Scryfall rate limit (50-100ms between requests)
        await new Promise((r) => setTimeout(r, 75));
      } catch {
        failed.push(cardName);
        await new Promise((r) => setTimeout(r, 75));
      }
    }

    // Batch insert all found cards
    if (cardsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("card_pools")
        .insert(cardsToInsert);

      if (insertError) {
        console.error("Error bulk inserting cards:", insertError);
        return {
          success: false,
          added: 0,
          skipped,
          failed: failed,
          error: insertError.message,
        };
      }
    }

    return {
      success: true,
      added: cardsToInsert.length,
      skipped,
      failed,
    };
  } catch (error) {
    console.error("Unexpected error in bulk import:", error);
    return {
      success: false,
      added: 0,
      skipped: 0,
      failed: [],
      error: String(error),
    };
  }
}

/**
 * Remove a card from the pool
 */
export async function removeCardFromPool(
  cardId: string,
  poolName: string = "default"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("card_pools")
      .delete()
      .eq("card_id", cardId)
      .eq("pool_name", poolName);

    if (error) {
      console.error("Error removing card from pool:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing card:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Clear entire pool
 */
export async function clearCardPool(
  poolName: string = "default"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("card_pools")
      .delete()
      .eq("pool_name", poolName);

    if (error) {
      console.error("Error clearing card pool:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error clearing pool:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove cards from pool by filter: all, undrafted only, or drafted only
 */
export async function removeFilteredCards(
  filter: "all" | "undrafted" | "drafted",
  poolName: string = "default"
): Promise<{ success: boolean; removedCount?: number; error?: string }> {
  const supabase = await createClient();

  try {
    if (filter === "all") {
      // Count before deleting
      const { count } = await supabase
        .from("card_pools")
        .select("*", { count: "exact", head: true })
        .eq("pool_name", poolName);

      const { error } = await supabase
        .from("card_pools")
        .delete()
        .eq("pool_name", poolName);

      if (error) {
        console.error("Error clearing card pool:", error);
        return { success: false, error: error.message };
      }

      return { success: true, removedCount: count || 0 };
    }

    // Get all cards in the pool
    const { data: poolCards, error: poolError } = await supabase
      .from("card_pools")
      .select("id, card_id")
      .eq("pool_name", poolName);

    if (poolError) {
      return { success: false, error: poolError.message };
    }

    if (!poolCards || poolCards.length === 0) {
      return { success: true, removedCount: 0 };
    }

    // Get all drafted card_ids
    const { data: draftPicks, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("card_id");

    if (draftError) {
      return { success: false, error: draftError.message };
    }

    const draftedCardIds = new Set(
      (draftPicks || []).map((p) => p.card_id)
    );

    // Determine which pool card IDs to delete based on filter
    let idsToDelete: string[];

    if (filter === "undrafted") {
      idsToDelete = poolCards
        .filter((c) => !draftedCardIds.has(c.card_id))
        .map((c) => c.id);
    } else {
      // drafted
      idsToDelete = poolCards
        .filter((c) => draftedCardIds.has(c.card_id))
        .map((c) => c.id);
    }

    if (idsToDelete.length === 0) {
      return { success: true, removedCount: 0 };
    }

    const { error: deleteError } = await supabase
      .from("card_pools")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("Error removing filtered cards:", deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true, removedCount: idsToDelete.length };
  } catch (error) {
    console.error("Unexpected error removing filtered cards:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all available pool names
 */
export async function getPoolNames(): Promise<{
  pools: string[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("card_pools")
      .select("pool_name")
      .order("pool_name");

    if (error) {
      console.error("Error fetching pool names:", error);
      return { pools: [], error: error.message };
    }

    // Get unique pool names
    const uniquePools = [
      ...new Set((data || []).map((item) => item.pool_name)),
    ];

    return { pools: uniquePools };
  } catch (error) {
    console.error("Unexpected error fetching pool names:", error);
    return { pools: [], error: "An unexpected error occurred" };
  }
}
