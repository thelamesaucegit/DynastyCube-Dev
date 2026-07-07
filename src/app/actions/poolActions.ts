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

export interface PoolStatistics {
  totalCards: number;
  draftedCards: number;
  availableCards: number;
}

export async function getPoolCardsWithStatus(): Promise<{
  cards: PoolCard[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();
    
    // THE FIX: Using our new highly-efficient RPC function
    const { data, error } = await supabase.rpc("get_cards_with_draft_status", {
        p_pool_name: 'draft'
    });

    if (error) return { cards: [], error: error.message };

    return { cards: (data as PoolCard[]) || [] };
  } catch (error) {
    return { cards: [], error: "An unexpected error occurred" };
  }
}

export async function getCardsForPool(poolIdentifier: PoolIdentifier): Promise<{ cards: PoolCard[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    // For logical pools living inside the main 'card_pools' table, use the RPC
    if (poolIdentifier === 'draft' || poolIdentifier === 'free' || poolIdentifier === 'wire') {
      const { data, error } = await supabase.rpc("get_cards_with_draft_status", {
          p_pool_name: poolIdentifier
      });

      if (error) return { cards: [], error: error.message };
      return { cards: (data as PoolCard[]) || [] };
    } 
    
    // For physical standalone tables (like 'retired_cards' or 'the_chamber')
    const { data, error } = await supabase
      .from(poolIdentifier)
      .select('*')
      .order('card_name', { ascending: true });

    if (error) return { cards: [], error: error.message };
    
    const cards: PoolCard[] = (data || []).map((card) => ({
      id: card.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_set: card.card_set ?? undefined,
      card_type: card.card_type ?? undefined,
      rarity: card.rarity ?? undefined,
      colors: card.colors ?? undefined,
      image_url: card.image_url ?? undefined,
      oldest_image_url: card.oldest_image_url ?? undefined,
      oracle_text: card.oracle_text ?? undefined,
      mana_cost: card.mana_cost ?? undefined,
      cmc: card.cmc ?? undefined,
      cubucks_cost: card.cubucks_cost ?? undefined,
      cubecobra_elo: card.cubecobra_elo ?? undefined,
      is_drafted: false, // Physical separate tables don't track drafts this way
    }));

    return { cards };
  } catch (err) {
    return { cards: [], error: String(err) };
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
