// src/app/actions/poolActions.ts

"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  oldest_image_url?: string; // Added field
  mana_cost?: string;
  cmc?: number;
  cubucks_cost?: number;
  cubecobra_elo?: number;
  is_drafted: boolean;
  drafted_by_team?: {
    id: string;
    name: string;
    emoji: string;
  };
  drafted_at?: string;
}

export async function getPoolCardsWithStatus(): Promise<{
  cards: PoolCard[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: allCards, error: cardsError } = await supabase
      .from("card_pools")
      .select(
        `
        id,
        card_id,
        card_name,
        card_set,
        card_type,
        rarity,
        colors,
        image_url,
        oldest_image_url,
        mana_cost,
        cmc,
        cubucks_cost,
        cubecobra_elo,
        team_draft_picks (
          id,
          drafted_at,
          team_id,
          teams ( id, name, emoji )
        )
      `
      )
      .order("card_name", { ascending: true });

    if (cardsError) {
      console.error("Error fetching card pool:", cardsError.message);
      return { cards: [], error: cardsError.message };
    }

    const cards: PoolCard[] = (allCards || []).map((card) => {
      const pick = Array.isArray(card.team_draft_picks)
        ? card.team_draft_picks[0]
        : card.team_draft_picks;
      const team = pick?.teams ? (Array.isArray(pick.teams) ? pick.teams[0] : pick.teams) : null;

      return {
        id: card.id,
        card_id: card.card_id,
        card_name: card.card_name,
        card_set: card.card_set,
        card_type: card.card_type,
        rarity: card.rarity,
        colors: card.colors,
        image_url: card.image_url,
        oldest_image_url: card.oldest_image_url, // Include this in the mapped data
        mana_cost: card.mana_cost,
        cmc: card.cmc,
        cubucks_cost: card.cubucks_cost,
        cubecobra_elo: card.cubecobra_elo,
        is_drafted: !!pick,
        drafted_by_team: team
          ? { id: team.id, name: team.name, emoji: team.emoji }
          : undefined,
        drafted_at: pick?.drafted_at || undefined,
      };
    });

    return { cards: cards };
  } catch (error) {
    console.error("Unexpected error in getPoolCardsWithStatus:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

export interface PoolStatistics {
  totalCards: number;
  draftedCards: number;
  availableCards: number;
  draftPercentage: number;
}

export async function getPoolStatistics(): Promise<{
  stats: PoolStatistics | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { count: totalCards, error: totalError } = await supabase
      .from("card_pools")
      .select("*", { count: "exact", head: true });
    if (totalError) {
      console.error("Error fetching total cards count:", totalError.message);
      return { stats: null, error: totalError.message };
    }

    const { count: draftedCards, error: draftedError } = await supabase
      .from("card_pools")
      .select("*", { count: "exact", head: true })
      .eq("was_drafted", true);
    if (draftedError) {
      console.error("Error fetching drafted cards count:", draftedError.message);
      return { stats: null, error: draftedError.message };
    }

    const availableCards = (totalCards || 0) - (draftedCards || 0);
    const draftPercentage =
      totalCards && totalCards > 0
        ? Math.round(((draftedCards || 0) / totalCards) * 100)
        : 0;

    return {
      stats: {
        totalCards: totalCards || 0,
        draftedCards: draftedCards || 0,
        availableCards: availableCards,
        draftPercentage: draftPercentage,
      },
    };
  } catch (error) {
    console.error("Unexpected error in getPoolStatistics:", error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}
