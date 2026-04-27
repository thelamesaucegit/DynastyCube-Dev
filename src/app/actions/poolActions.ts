// src/app/actions/poolActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";
import { PoolTableName } from "./cardActions"; // Import the shared type

type BasePoolCard = {
    id: string;
    card_id: string;
    card_name: string;
    card_set: string | null;
    card_type: string | null;
    rarity: string | null;
    colors: string[] | null;
    image_url: string | null;
    oldest_image_url: string | null;
    mana_cost: string | null;
    cmc: number | null;
    cubucks_cost: number | null;
    cubecobra_elo: number | null;
};

// This type extends the base card with the specific relational data we get when querying 'card_pools'
type CardWithDraftInfo = BasePoolCard & {
  team_draft_picks: {
        drafted_at: string | null;
        teams: {
            id: string;
            name: string;
            emoji: string;
        } | null;
    }[] | null;
};




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

export async function getCardsForPool(poolName: PoolTableName): Promise<{ cards: PoolCard[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    let query;
    if (poolName === 'card_pools') {
      query = supabase
        .from('card_pools')
        .select(`
          *,
          team_draft_picks (
            drafted_at,
            teams ( id, name, emoji )
          )
        `)
        .order('card_name', { ascending: true });
    } else {
      query = supabase
        .from(poolName)
        .select('*')
        .order('card_name', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching cards for pool "${poolName}":`, error);
      return { cards: [], error: error.message };
    }
    
    // --- THIS IS THE FIX: Define a union type for the map function ---
    // This tells TypeScript the 'card' can be one of two shapes, eliminating the need for 'any'.
    const cards: PoolCard[] = (data || []).map((card: CardWithDraftInfo | BasePoolCard) => {
      // Use a type guard to check if the draft info exists.
      const isDraftableCard = 'team_draft_picks' in card;
      
      const pick = isDraftableCard && Array.isArray(card.team_draft_picks) ? card.team_draft_picks[0] : null;
      const team = pick?.teams;

      return {
          id: card.id,
          card_id: card.card_id,
          card_name: card.card_name,
          card_set: card.card_set ?? undefined,
          card_type: card.card_type ?? undefined,
          rarity: card.rarity ?? undefined,
          colors: card.colors ?? undefined,
          image_url: card.image_url ?? undefined,
          oldest_image_url: card.oldest_image_url ?? undefined,
          mana_cost: card.mana_cost ?? undefined,
          cmc: card.cmc ?? undefined,
          cubucks_cost: card.cubucks_cost ?? undefined,
          cubecobra_elo: card.cubecobra_elo ?? undefined,
          is_drafted: !!pick, // Will be false if 'pick' is null
          drafted_by_team: team && team.id ? { id: team.id, name: team.name, emoji: team.emoji } : undefined,
          drafted_at: pick?.drafted_at ?? undefined,
      };
    });

    return { cards };
      
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error(`Unexpected error in getCardsForPool for pool "${poolName}":`, message);
    return { cards: [], error: message };
  }
}

export async function getPoolCardsWithStatus(): Promise<{
  cards: PoolCard[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data: allCards, error: cardsError } = await supabase
      .from("card_pools")
      .select(`*, team_draft_picks ( id, drafted_at, team_id, teams ( id, name, emoji ) )`)
      .order("card_name", { ascending: true });

    if (cardsError) {
      console.error("Error fetching card pool:", cardsError.message);
      return { cards: [], error: cardsError.message };
    }

    // --- FIX: Use the specific CardWithDraftInfo type here as well ---
    const cards: PoolCard[] = (allCards || []).map((card: CardWithDraftInfo) => {
      const pick = Array.isArray(card.team_draft_picks) ? card.team_draft_picks[0] : card.team_draft_picks;
      const team = pick?.teams ? (Array.isArray(pick.teams) ? pick.teams[0] : pick.teams) : null;

      return {
        id: card.id,
        card_id: card.card_id,
        card_name: card.card_name,
        card_set: card.card_set ?? undefined,
        card_type: card.card_type ?? undefined,
        rarity: card.rarity ?? undefined,
        colors: card.colors ?? undefined,
        image_url: card.image_url ?? undefined,
        oldest_image_url: card.oldest_image_url ?? undefined,
        mana_cost: card.mana_cost ?? undefined,
        cmc: card.cmc ?? undefined,
        cubucks_cost: card.cubucks_cost ?? undefined,
        cubecobra_elo: card.cubecobra_elo ?? undefined,
        is_drafted: !!pick,
        drafted_by_team: team ? { id: team.id, name: team.name, emoji: team.emoji } : undefined,
        drafted_at: pick?.drafted_at ?? undefined,
      };
    });

    return { cards };
  } catch (error) {
    console.error("Unexpected error in getPoolCardsWithStatus:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}


export interface PoolStatistics {
  totalCards: number;
  draftedCards: number;
  availableCards: number;
}

export async function getPoolStatistics(poolName: PoolTableName): Promise<{ stats: PoolStatistics | null; error?: string }> {
  try {
    const supabase = await createServerClient();
    
    // --- DYNAMIC STATS CALCULATION ---
    const { count: totalCards, error: totalError } = await supabase
      .from(poolName)
      .select('*', { count: "exact", head: true });

    if (totalError) {
      console.error(`Error fetching total cards count for ${poolName}:`, totalError.message);
      return { stats: null, error: totalError.message };
    }

    let draftedCards = 0;
    // Only calculate drafted cards for the main pool
    if (poolName === 'card_pools') {
      const { count, error: draftedError } = await supabase
        .from("card_pools")
        .select("id", { count: "exact", head: true })
        .not("team_draft_picks", "is", null);
      
      if (draftedError) {
        console.error("Error fetching drafted cards count:", draftedError.message);
        // Don't fail the whole function, just proceed with drafted as 0
      } else {
        draftedCards = count || 0;
      }
    }
    
    const availableCards = (totalCards || 0) - draftedCards;
   
    return {
      stats: {
        totalCards: totalCards || 0,
        draftedCards: draftedCards,
        availableCards: availableCards,
      },
    };
  } catch (error) {
    console.error(`Unexpected error in getPoolStatistics for ${poolName}:`, error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}
