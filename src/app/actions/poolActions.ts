// src/app/actions/poolActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { PoolTableName } from "./cardActions";

export type PoolIdentifier = 'draft' | 'free' | 'wire' | PoolTableName;

export interface PoolCard {
  id: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  oracle_text?: string | null;
  oldest_image_url?: string;
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

interface BasePoolCard {
  id: string;
  card_id: string;
  card_name: string;
  card_set: string | null;
  oracle_text?: string | null;
  card_type: string | null;
  rarity: string | null;
  colors: string[] | null;
  image_url: string | null;
  oldest_image_url: string | null;
  mana_cost: string | null;
  cmc: number | null;
  cubucks_cost: number | null;
  cubecobra_elo: number | null;
}

interface CardWithDraftInfo extends BasePoolCard {
  team_draft_picks: {
    drafted_at: string | null;
    teams: {
      id: string;
      name: string;
      emoji: string;
    } | null;
  }[] | null;
}

export interface PoolStatistics {
  totalCards: number;
  draftedCards: number;
  availableCards: number;
}

export async function getCardsForPool(poolIdentifier: PoolIdentifier): Promise<{ cards: PoolCard[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    let query;

    // For logical pools, we perform the join.
    if (poolIdentifier === 'draft' || poolIdentifier === 'free' || poolIdentifier === 'wire') {
      query = supabase
        .from('card_pools')
        .select(`*, team_draft_picks!left ( drafted_at, teams ( id, name, emoji ) )`)
        .eq('pool_name', poolIdentifier)
        .order('card_name', { ascending: true });
    } else {
      // For physical tables, we just select the data directly.
      query = supabase
        .from(poolIdentifier)
        .select('*')
        .order('card_name', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching cards for pool [${poolIdentifier}]:`, error);
      return { cards: [], error: error.message };
    }
    
    // THE FIX: Type mapped card parameter securely as CardWithDraftInfo | BasePoolCard
    const cards: PoolCard[] = (data || []).map((card: CardWithDraftInfo | BasePoolCard) => {
        const isDraftable = 'team_draft_picks' in card;
        const pick = isDraftable && card.team_draft_picks && Array.isArray(card.team_draft_picks) 
          ? card.team_draft_picks[0] 
          : null;
        const team = pick?.teams;

        return {
            id: card.id,
            card_id: card.card_id,
            card_name: card.card_name,
            card_set: card.card_set || undefined,
            card_type: card.card_type || undefined,
            rarity: card.rarity || undefined,
            colors: card.colors || undefined,
            image_url: card.image_url || undefined,
            oldest_image_url: card.oldest_image_url || undefined,
            oracle_text: card.oracle_text || undefined,
            mana_cost: card.mana_cost || undefined,
            cmc: card.cmc || undefined,
            cubucks_cost: card.cubucks_cost || undefined,
            cubecobra_elo: card.cubecobra_elo || undefined,
            is_drafted: !!pick,
            drafted_by_team: team ? { id: team.id, name: team.name, emoji: team.emoji } : undefined,
            drafted_at: pick?.drafted_at || undefined,
        };
    });

    return { cards };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error(`Unexpected error in getCardsForPool for pool "${poolIdentifier}":`, errorMessage);
    return { cards: [], error: errorMessage };
  }
}

export async function getPoolStatistics(poolIdentifier: PoolIdentifier): Promise<{ stats: PoolStatistics | null; error?: string }> {
  try {
    const supabase = await createServerClient();
    
    let totalCardsQuery;
    let isLogicalPool = false;

    if (poolIdentifier === 'draft' || poolIdentifier === 'free' || poolIdentifier === 'wire') {
        isLogicalPool = true;
        totalCardsQuery = supabase
            .from('card_pools')
            .select('*', { count: "exact", head: true })
            .eq('pool_name', poolIdentifier);
    } else {
        totalCardsQuery = supabase
            .from(poolIdentifier)
            .select('*', { count: "exact", head: true });
    }

    const { count: totalCards, error: totalError } = await totalCardsQuery;
    if (totalError) {
      console.error(`Error fetching total cards count for ${poolIdentifier}:`, totalError.message);
      return { stats: null, error: totalError.message };
    }

    let draftedCards = 0;

    if (isLogicalPool) {
      const { count, error: draftedError } = await supabase
        .from("card_pools")
        .select("id", { count: "exact", head: true })
        .eq('pool_name', poolIdentifier)
        .not("team_draft_picks", "is", null);
      
      if (!draftedError) {
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
    console.error(`Unexpected error in getPoolStatistics for ${poolIdentifier}:`, error);
    return { stats: null, error: "An unexpected error occurred" };
  }
}

export async function getPoolCardsWithStatus(): Promise<{
  cards: PoolCard[];
  error?: string;
}> {
    return getCardsForPool('draft');
}
