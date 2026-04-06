// src/app/actions/statsActions.ts
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

export interface TeamStatistics {
  totalCards: number;
  totalDecks: number;
  colorDistribution: { [color: string]: number };
  typeDistribution: { [type: string]: number };
  rarityDistribution: { [rarity: string]: number };
  averageCMC: number;
  cmcDistribution: { [cmc: string]: number };
  recentPicks: number; // Picks in last 7 days
}

export interface DeckStatistics {
  deckId: string;
  deckName: string;
  totalCards: number;
  mainboardCount: number;
  sideboardCount: number;
  maybeboardCount: number;
  colorDistribution: { [color: string]: number };
  typeDistribution: { [type: string]: number };
  averageCMC: number;
  cmcDistribution: { [cmc: string]: number };
  colorIdentity: string[];
}

/**
 * Get comprehensive statistics for a team
 */
export async function getTeamStatistics(
  teamId: string
): Promise<{ stats: TeamStatistics | null; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all draft picks for the team
    const { data: picks, error: picksError } = await supabase
      .from("team_draft_picks")
      .select("*")
      .eq("team_id", teamId);

    if (picksError) {
      console.error("Error fetching picks for stats:", picksError);
      return { stats: null, error: picksError.message };
    }

    // Get all decks count
    const { count: decksCount, error: decksError } = await supabase
      .from("team_decks")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    if (decksError) {
      console.error("Error fetching decks count:", decksError);
      return { stats: null, error: decksError.message };
    }

    const picksList = picks || [];
    const totalCards = picksList.length;
    const totalDecks = decksCount || 0;

    // Calculate color distribution
    const colorDistribution: { [color: string]: number } = {};
    picksList.forEach((pick) => {
      if (pick.colors && Array.isArray(pick.colors)) {
        pick.colors.forEach((color: string) => {
          colorDistribution[color] = (colorDistribution[color] || 0) + 1;
        });
      }
    });

    // Calculate type distribution (simplified - first word of card_type)
    const typeDistribution: { [type: string]: number } = {};
    picksList.forEach((pick) => {
      if (pick.card_type) {
        const mainType = pick.card_type.split(/[\s—-]/)[0]; // Split on space or em-dash
        typeDistribution[mainType] = (typeDistribution[mainType] || 0) + 1;
      }
    });

    // Calculate rarity distribution
    const rarityDistribution: { [rarity: string]: number } = {};
    picksList.forEach((pick) => {
      if (pick.rarity) {
        rarityDistribution[pick.rarity] = (rarityDistribution[pick.rarity] || 0) + 1;
      }
    });

    // Calculate average CMC
    const cmcValues = picksList
      .filter((pick) => pick.cmc !== null && pick.cmc !== undefined)
      .map((pick) => pick.cmc);
    const averageCMC =
      cmcValues.length > 0
        ? cmcValues.reduce((sum, cmc) => sum + cmc, 0) / cmcValues.length
        : 0;

    // Calculate CMC distribution
    const cmcDistribution: { [cmc: string]: number } = {};
    picksList.forEach((pick) => {
      if (pick.cmc !== null && pick.cmc !== undefined) {
        const cmcKey = pick.cmc.toString();
        cmcDistribution[cmcKey] = (cmcDistribution[cmcKey] || 0) + 1;
      }
    });

    // Calculate recent picks (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentPicks = picksList.filter((pick) => {
      const draftedAt = new Date(pick.drafted_at);
      return draftedAt >= sevenDaysAgo;
    }).length;

    const stats: TeamStatistics = {
      totalCards,
      totalDecks,
      colorDistribution,
      typeDistribution,
      rarityDistribution,
      averageCMC: Math.round(averageCMC * 100) / 100,
      cmcDistribution,
      recentPicks,
    };

    return { stats };
  } catch (error) {
    console.error("Unexpected error fetching team statistics:", error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}

/**
 * Get statistics for a specific deck
 */
export async function getDeckStatistics(
  deckId: string
): Promise<{ stats: DeckStatistics | null; error?: string }> {
  const supabase = await createClient();

  try {
    // Get deck info
    const { data: deck, error: deckError } = await supabase
      .from("team_decks")
      .select("*")
      .eq("id", deckId)
      .single();

    if (deckError) {
      console.error("Error fetching deck:", deckError);
      return { stats: null, error: deckError.message };
    }

    // Get all cards in deck
    const { data: deckCards, error: cardsError } = await supabase
      .from("deck_cards")
      .select(`
        *,
        team_draft_picks (
          card_type,
          colors,
          cmc,
          rarity
        )
      `)
      .eq("deck_id", deckId);

    if (cardsError) {
      console.error("Error fetching deck cards:", cardsError);
      return { stats: null, error: cardsError.message };
    }

    const cards = deckCards || [];
    const mainboardCards = cards.filter((c) => c.category === "mainboard");
    const sideboardCards = cards.filter((c) => c.category === "sideboard");
    const maybeboardCards = cards.filter((c) => c.category === "maybeboard");

    const mainboardCount = mainboardCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
    const sideboardCount = sideboardCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
    const maybeboardCount = maybeboardCards.reduce((sum, c) => sum + (c.quantity || 1), 0);

    // Calculate color distribution (mainboard + sideboard only)
    const colorDistribution: { [color: string]: number } = {};
    const allColors = new Set<string>();

    [...mainboardCards, ...sideboardCards].forEach((card) => {
      const pick = card.team_draft_picks;
      if (pick && pick.colors && Array.isArray(pick.colors)) {
        pick.colors.forEach((color: string) => {
          allColors.add(color);
          colorDistribution[color] = (colorDistribution[color] || 0) + (card.quantity || 1);
        });
      }
    });

    // Calculate type distribution
    const typeDistribution: { [type: string]: number } = {};
    [...mainboardCards, ...sideboardCards].forEach((card) => {
      const pick = card.team_draft_picks;
      if (pick && pick.card_type) {
        const mainType = pick.card_type.split(/[\s—-]/)[0];
        typeDistribution[mainType] = (typeDistribution[mainType] || 0) + (card.quantity || 1);
      }
    });

    // Calculate average CMC (mainboard only)
    const cmcValues: number[] = [];
    mainboardCards.forEach((card) => {
      const pick = card.team_draft_picks;
      if (pick && pick.cmc !== null && pick.cmc !== undefined) {
        for (let i = 0; i < (card.quantity || 1); i++) {
          cmcValues.push(pick.cmc);
        }
      }
    });
    const averageCMC =
      cmcValues.length > 0
        ? cmcValues.reduce((sum, cmc) => sum + cmc, 0) / cmcValues.length
        : 0;

    // Calculate CMC distribution (mainboard only)
    const cmcDistribution: { [cmc: string]: number } = {};
    mainboardCards.forEach((card) => {
      const pick = card.team_draft_picks;
      if (pick && pick.cmc !== null && pick.cmc !== undefined) {
        const cmcKey = pick.cmc.toString();
        cmcDistribution[cmcKey] = (cmcDistribution[cmcKey] || 0) + (card.quantity || 1);
      }
    });

    const stats: DeckStatistics = {
      deckId,
      deckName: deck.deck_name,
      totalCards: mainboardCount + sideboardCount + maybeboardCount,
      mainboardCount,
      sideboardCount,
      maybeboardCount,
      colorDistribution,
      typeDistribution,
      averageCMC: Math.round(averageCMC * 100) / 100,
      cmcDistribution,
      colorIdentity: Array.from(allColors),
    };

    return { stats };
  } catch (error) {
    console.error("Unexpected error fetching deck statistics:", error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}

/**
 * Get statistics for all decks of a team
 */
export async function getTeamDecksStatistics(
  teamId: string
): Promise<{ stats: DeckStatistics[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: decks, error: decksError } = await supabase
      .from("team_decks")
      .select("id")
      .eq("team_id", teamId);

    if (decksError) {
      console.error("Error fetching team decks:", decksError);
      return { stats: [], error: decksError.message };
    }

    const deckStats: DeckStatistics[] = [];
    for (const deck of decks || []) {
      const { stats } = await getDeckStatistics(deck.id);
      if (stats) {
        deckStats.push(stats);
      }
    }

    return { stats: deckStats };
  } catch (error) {
    console.error("Unexpected error fetching team decks statistics:", error);
    return { stats: [], error: "An unexpected error occurred" };
  }
}
