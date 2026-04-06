// src/app/actions/poolActions.ts
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
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}

export interface PoolCard {
  id: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  mana_cost?: string;
  cmc?: number;
  cubucks_cost?: number;
  pool_name: string;
  created_at: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
  // Draft status
  is_drafted: boolean;
  drafted_by_team?: {
    id: string;
    name: string;
    emoji: string;
  };
  drafted_at?: string;
}

/**
 * Get all cards in a pool with their draft status
 */
export async function getPoolCardsWithStatus(
  poolName: string = "default"
): Promise<{ cards: PoolCard[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: poolCards, error: poolError } = await supabase
      .from("card_pools")
      .select("*")
      .eq("pool_name", poolName)
      .order("card_name");

    if (poolError) return { cards: [], error: poolError.message };

    const { data: draftPicks, error: picksError } = await supabase
      .from("team_draft_picks")
      .select(`
        card_id,
        team_id,
        drafted_at,
        teams (
          id,
          name,
          emoji
        )
      `);

    if (picksError) return { cards: [], error: picksError.message };

        // Define the shape of the draft info
    interface DraftInfo {
      team: {
        id: string;
        name: string;
        emoji: string;
      };
      drafted_at: string;
    }

    // FIX: Map drafted cards as an array of picks using the explicit interface
    const draftedCardsMap = new Map<string, DraftInfo[]>();
    (draftPicks || []).forEach((pick) => {
      if (!draftedCardsMap.has(pick.card_id)) {
        draftedCardsMap.set(pick.card_id, []);
      }
      // TypeScript now knows 'pick.teams' is exactly what 'team' needs to be
      draftedCardsMap.get(pick.card_id)!.push({
        team: pick.teams as unknown as DraftInfo["team"], // Type assertion if needed based on Supabase return type
        drafted_at: pick.drafted_at,
      });
    });


    const cardsWithStatus: PoolCard[] = (poolCards || []).map((card) => {
      // FIX: Get the array of picks for this Scryfall ID
      const picksForThisCard = draftedCardsMap.get(card.card_id);
      
      // Pull exactly ONE pick off the array to apply to this specific instance
      const draftInfo = picksForThisCard && picksForThisCard.length > 0 
        ? picksForThisCard.shift() 
        : null;

      return {
        id: card.id,
        card_id: card.card_id,
        card_name: card.card_name,
        card_set: card.card_set,
        card_type: card.card_type,
        rarity: card.rarity,
        colors: card.colors,
        image_url: card.image_url,
        mana_cost: card.mana_cost,
        cmc: card.cmc,
        cubucks_cost: card.cubucks_cost,
        pool_name: card.pool_name,
        created_at: card.created_at,
        cubecobra_elo: card.cubecobra_elo,
        rating_updated_at: card.rating_updated_at,
        is_drafted: !!draftInfo,
        drafted_by_team: draftInfo?.team,
        drafted_at: draftInfo?.drafted_at,
      };
    });

    return { cards: cardsWithStatus };
  } catch (error) {
    console.error("Unexpected error fetching pool cards:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get pool statistics
 */
export async function getPoolStatistics(
  poolName: string = "default"
): Promise<{
  stats: {
    totalCards: number;
    draftedCards: number;
    availableCards: number;
    draftPercentage: number;
  } | null;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Get total cards in pool
    const { count: totalCards, error: poolError } = await supabase
      .from("card_pools")
      .select("*", { count: "exact", head: true })
      .eq("pool_name", poolName);

    if (poolError) {
      console.error("Error counting pool cards:", poolError);
      return { stats: null, error: poolError.message };
    }

    // Get unique drafted cards from this pool
    const { data: poolCards, error: cardsError } = await supabase
      .from("card_pools")
      .select("card_id")
      .eq("pool_name", poolName);

    if (cardsError) {
      console.error("Error fetching pool card IDs:", cardsError);
      return { stats: null, error: cardsError.message };
    }

    const poolCardIds = (poolCards || []).map((c) => c.card_id);

    const { count: draftedCards, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("*", { count: "exact", head: true })
      .in("card_id", poolCardIds);

    if (draftError) {
      console.error("Error counting drafted cards:", draftError);
      return { stats: null, error: draftError.message };
    }

    const total = totalCards || 0;
    const drafted = draftedCards || 0;
    const available = total - drafted;
    const percentage = total > 0 ? (drafted / total) * 100 : 0;

    return {
      stats: {
        totalCards: total,
        draftedCards: drafted,
        availableCards: available,
        draftPercentage: Math.round(percentage * 10) / 10,
      },
    };
  } catch (error) {
    console.error("Unexpected error fetching pool statistics:", error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}

/**
 * Get available pool names
 */
export async function getAvailablePools(): Promise<{
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
    const uniquePools = [...new Set((data || []).map((p) => p.pool_name))];

    return { pools: uniquePools };
  } catch (error) {
    console.error("Unexpected error fetching pool names:", error);
    return { pools: [], error: "An unexpected error occurred" };
  }
}
