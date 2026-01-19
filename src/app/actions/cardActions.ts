// src/app/actions/cardActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
            // This can be ignored if you have middleware refreshing
            // user sessions.
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
}

/**
 * Fetch all cards from a pool
 */
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
