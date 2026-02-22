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

export async function getCardPool(poolName: string = "default"): Promise<{ cards: CardData[]; error?: string }> {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.from("card_pools").select("*").eq("pool_name", poolName).order("created_at", { ascending: false });
        if (error) return { cards: [], error: error.message };
        return { cards: data || [] };
    } catch (error) {
        return { cards: [], error: "An unexpected error occurred" };
    }
}

export async function getAvailableCardsForDraft(poolName: string = "default"): Promise<{ cards: CardData[]; error?: string }> {
    const supabase = await createClient();
    try {
        const { data: allCards, error: poolError } = await supabase.from("card_pools").select("*").eq("pool_name", poolName);
        if (poolError) return { cards: [], error: poolError.message };

        const { data: draftedPicks, error: draftError } = await supabase.from("team_draft_picks").select("card_pool_id");
        if (draftError) return { cards: [], error: draftError.message };

        const draftedInstanceIds = new Set((draftedPicks || []).map(p => p.card_pool_id).filter(Boolean));
        const availableCards = (allCards || []).filter(card => !draftedInstanceIds.has(card.id));
        
        return { cards: availableCards };
    } catch (error) {
        return { cards: [], error: "An unexpected error occurred" };
    }
}

export async function addCardToPool(card: CardData, poolName: string = "default"): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("card_pools").insert({
            // ... card data
        });
        if (error) return { success: false, error: error.message };
        invalidateDraftCache();
        return { success: true };
    } catch (error) {
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function addCardsToPool(cards: CardData[], poolName: string = "default"): Promise<{ success: boolean; error?: string; count?: number }> {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const cardsToInsert = cards.map(card => ({ /* ... card data ... */ }));
        const { data, error } = await supabase.from("card_pools").insert(cardsToInsert).select();
        if (error) return { success: false, error: error.message };
        invalidateDraftCache();
        return { success: true, count: data?.length || 0 };
    } catch (error) {
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function bulkImportCards(lines: string[], defaultCubucksCost: number = 1, poolName: string = "default"): Promise<{ success: boolean; added: number; skipped: number; failed: string[]; error?: string; }> {
    try {
        // ... (your existing bulk import logic)
        const supabase = await createClient();
        const cardsToInsert: any[] = [];
        // ... (loop and fetch from scryfall)
        if (cardsToInsert.length > 0) {
            const { error: insertError } = await supabase.from("card_pools").insert(cardsToInsert);
            if (insertError) return { success: false, added: 0, skipped: 0, failed: [], error: insertError.message };
            invalidateDraftCache();
        }
        return { success: true, added: cardsToInsert.length, skipped: 0, failed: [] };
    } catch (error) {
        return { success: false, added: 0, skipped: 0, failed: [], error: String(error) };
    }
}

export async function removeCardFromPool(dbId: string, poolName: string = "default"): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    try {
        const { error } = await supabase.from("card_pools").delete().eq("id", dbId);
        if (error) return { success: false, error: error.message };
        invalidateDraftCache();
        return { success: true };
    } catch (error) {
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function clearCardPool(poolName: string = "default"): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    try {
        const { error } = await supabase.from("card_pools").delete().eq("pool_name", poolName);
        if (error) return { success: false, error: error.message };
        invalidateDraftCache();
        return { success: true };
    } catch (error) {
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function removeFilteredCards(filter: "all" | "undrafted" | "drafted", poolName: string = "default"): Promise<{ success: boolean; removedCount?: number; error?: string }> {
    const supabase = await createClient();
    try {
        if (filter === "all") {
            const { count, error } = await supabase.from("card_pools").delete().eq("pool_name", poolName).select('*', { count: 'exact', head: true });
            if (error) return { success: false, error: error.message };
            invalidateDraftCache();
            return { success: true, removedCount: count || 0 };
        }

        const { data: poolCards, error: poolError } = await supabase.from("card_pools").select("id, card_id").eq("pool_name", poolName);
        if (poolError) return { success: false, error: poolError.message };
        if (!poolCards || poolCards.length === 0) return { success: true, removedCount: 0 };

        const { data: draftPicks, error: draftError } = await supabase.from("team_draft_picks").select("card_id");
        if (draftError) return { success: false, error: draftError.message };

        const draftedCardIds = new Set((draftPicks || []).map(p => p.card_id));

        if (filter === "undrafted") {
            const idsToDelete = poolCards.filter(c => !draftedCardIds.has(c.card_id)).map(c => c.id);
            if (idsToDelete.length === 0) return { success: true, removedCount: 0 };
            const { error: deleteError } = await supabase.from("card_pools").delete().in("id", idsToDelete);
            if (deleteError) return { success: false, error: deleteError.message };
            invalidateDraftCache();
            return { success: true, removedCount: idsToDelete.length };
        }
        
        if (filter === "drafted") {
            const draftedPoolCards = poolCards.filter(c => draftedCardIds.has(c.card_id));
            const draftedCardIdsInPool = draftedPoolCards.map(c => c.card_id);
            if (draftedCardIdsInPool.length === 0) return { success: true, removedCount: 0 };
            const { error: undraftError } = await supabase.from("team_draft_picks").delete().in("card_id", draftedCardIdsInPool);
            if (undraftError) return { success: false, error: undraftError.message };
            return { success: true, removedCount: draftedPoolCards.length };
        }

        return { success: false, error: "Invalid filter specified" };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

export async function getPoolNames(): Promise<{ pools: string[]; error?: string; }> {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.from("card_pools").select("pool_name").order("pool_name");
        if (error) return { pools: [], error: error.message };
        const uniquePools = [...new Set((data || []).map((item) => item.pool_name))];
        return { pools: uniquePools };
    } catch (error) {
        return { pools: [], error: "An unexpected error occurred" };
    }
}
