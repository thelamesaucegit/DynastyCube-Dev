// src/app/actions/seasonActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export interface CardCostChange {
  card_id: string;
  card_name: string;
  old_cost: number;
  new_cost: number;
  was_drafted: boolean;
}

/**
 * Rollover card costs to a new season
 * - Drafted cards: cost +1
 * - Undrafted cards: cost -1 (min 1)
 */
export async function rolloverSeasonCosts(
  newSeasonId: string,
  previousSeasonId?: string
): Promise<{
  success: boolean;
  changes?: CardCostChange[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the rollover function
    const { data, error } = await supabase.rpc("rollover_card_costs_for_new_season", {
      p_new_season_id: newSeasonId,
      p_previous_season_id: previousSeasonId || null,
    });

    if (error) {
      console.error("Error rolling over costs:", error);
      return { success: false, error: error.message };
    }

    return { success: true, changes: data || [] };
  } catch (error) {
    console.error("Unexpected error rolling over costs:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Initialize card costs for current season (all cards at 1 Cubuck)
 */
export async function initializeSeasonCosts(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the initialization function
    const { error } = await supabase.rpc("initialize_season_card_costs");

    if (error) {
      console.error("Error initializing costs:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error initializing costs:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get card pricing history across seasons
 */
export async function getCardPricingHistory(
  cardPoolId?: string
): Promise<{
  history: Array<{
    card_pool_id: string;
    card_name: string;
    card_set: string;
    rarity: string;
    season_number: number;
    season_name: string;
    cost: number;
    was_drafted: boolean;
    times_drafted: number;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    let query = supabase.from("card_pricing_history").select("*");

    if (cardPoolId) {
      query = query.eq("card_pool_id", cardPoolId);
    }

    const { data, error } = await query.order("card_name").order("season_number");

    if (error) {
      console.error("Error fetching pricing history:", error);
      return { history: [], error: error.message };
    }

    return { history: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching pricing history:", error);
    return { history: [], error: String(error) };
  }
}

/**
 * Get cost changes summary for last season
 */
export async function getSeasonCostSummary(
  seasonId: string
): Promise<{
  summary: {
    total_cards: number;
    drafted_cards: number;
    undrafted_cards: number;
    avg_cost: number;
    max_cost: number;
    min_cost: number;
  } | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("card_season_costs")
      .select("cost, was_drafted, times_drafted")
      .eq("season_id", seasonId);

    if (error) {
      console.error("Error fetching season summary:", error);
      return { summary: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        summary: {
          total_cards: 0,
          drafted_cards: 0,
          undrafted_cards: 0,
          avg_cost: 0,
          max_cost: 0,
          min_cost: 0,
        },
      };
    }

    const summary = {
      total_cards: data.length,
      drafted_cards: data.filter((c) => c.was_drafted).length,
      undrafted_cards: data.filter((c) => !c.was_drafted).length,
      avg_cost: Math.round(
        data.reduce((sum, c) => sum + c.cost, 0) / data.length
      ),
      max_cost: Math.max(...data.map((c) => c.cost)),
      min_cost: Math.min(...data.map((c) => c.cost)),
    };

    return { summary };
  } catch (error) {
    console.error("Unexpected error fetching season summary:", error);
    return { summary: null, error: String(error) };
  }
}

/**
 * Get cards by cost range for current season
 */
export async function getCardsByCostRange(
  minCost: number,
  maxCost: number
): Promise<{
  cards: Array<{
    id: string;
    card_name: string;
    card_set: string;
    rarity: string;
    cubucks_cost: number;
    image_url?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("card_pools")
      .select("id, card_name, card_set, rarity, cubucks_cost, image_url")
      .gte("cubucks_cost", minCost)
      .lte("cubucks_cost", maxCost)
      .order("cubucks_cost", { ascending: false })
      .order("card_name");

    if (error) {
      console.error("Error fetching cards by cost:", error);
      return { cards: [], error: error.message };
    }

    return { cards: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching cards by cost:", error);
    return { cards: [], error: String(error) };
  }
}

/**
 * Get the current active season
 */
export async function getCurrentSeason(): Promise<{
  season: { id: string; name: string; season_number: number } | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, season_number")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching current season:", error);
      return { season: null, error: error.message };
    }

    return { season: data || null };
  } catch (error) {
    console.error("Unexpected error fetching current season:", error);
    return { season: null, error: String(error) };
  }
}
