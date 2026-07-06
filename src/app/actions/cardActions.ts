// src/app/actions/cardActions.ts
"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { invalidateDraftCache } from '@/lib/draftCache';
import { type AnySupabaseClient } from "@/lib/supabase";
import { fetchAllCards, ScryfallCard , fetchOldestPrintings } from "@/lib/scryfall-client";
import { updateAllCubecobraElo } from "./cardRatingActions";

function createServiceClient() {
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export type PoolTableName = "card_pools" | "the_chamber" | "resort_pool" | "card_pools_next" | "retired_cards" ; 

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Ignore */ }
        },
      },
    }
  );
}

// --- MODIFIED: Added oracle_text ---
export interface CardData {
  id?: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  color_identity?: string[];
  image_url?: string | null;
  oldest_image_url?: string | null;
  oracle_id?: string | null;
  oracle_text?: string | null; // <-- ADDED
  hidden?: boolean;
  mana_cost?: string;
  cmc?: number;
  pool_name?: string;
  cubucks_cost?: number;
  created_at?: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
}

export interface ReplayCardData {
  name: string;
  card_type: string;
  image_url: string | null;
  oldest_image_url: string | null;
}

function calculateCubucksCost(card: ScryfallCard): number {
  const legalities = card.legalities;
  let cost = 1; 
  if (legalities.legacy === 'banned' && legalities.vintage !== 'restricted') {
    cost *= 3;
  }
  if (legalities.vintage === 'restricted') {
    cost *= 5;
  }
  return cost;
}

export async function getCardDataForReplay(cardNames: string[]): Promise<Map<string, ReplayCardData>> {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase.from('card_pools').select('card_name, card_type, image_url, oldest_image_url').in('card_name', cardNames);
        if (error) { throw error; }
        const cardDataMap = new Map<string, ReplayCardData>();
        if (data) {
            for (const card of data) {
                if (card.card_name && card.card_type) {
                    cardDataMap.set(card.card_name, {
                        name: card.card_name,
                        card_type: card.card_type,
                        image_url: card.image_url || null,
                        oldest_image_url: card.oldest_image_url || null,
                    });
                }
            }
        }
        return cardDataMap;
    } catch (err) {
        console.error("Unexpected error in getCardDataForReplay:", err);
        return new Map();
    }
}

export async function undraftAllCards(): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  const supabase = await createClient();
  try {
    const { data, error: updateError, count } = await supabase.from("card_pools").update({ was_drafted: false, times_drafted: 0 }).eq("was_drafted", true).select();
    if (updateError) throw updateError;
    const { error: deleteError } = await supabase.from("team_draft_picks").delete().not("id", "is", null);
    if (deleteError) throw deleteError;
    return { success: true, updatedCount: count || data?.length || 0 };
  } catch (error) { 
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function getCardPool(
  tableName: PoolTableName = "card_pools"
): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    if (error) {
      return { cards: [], error: error.message };
    }
    return { cards: data || [] };
  } catch {
    return { cards: [], error: "An unexpected error occurred" };
  }
}

export async function getAvailableCardsForDraft(poolName: string = "draft", adminClient?: AnySupabaseClient): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = adminClient ?? createServiceClient(); 
  try {
    const { data: draftedPicks, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("card_pool_id")
      .not("card_pool_id", "is", null);

    if (draftError) return { cards: [], error: draftError.message };
    
    const draftedInstanceIds = (draftedPicks || []).map(p => p.card_pool_id).filter(Boolean) as string[];

    let query = supabase
        .from("card_pools")
        .select("*")
        .eq("pool_name", poolName)
        .eq('hidden', false);

    if (draftedInstanceIds.length > 0) {
        query = query.not("id", "in", `(${draftedInstanceIds.join(',')})`);
    }

    const { data: availableCards, error: availableError } = await query.order("card_name", { ascending: true });
    if(availableError) return { cards: [], error: availableError.message };
    
    return { cards: availableCards || [] };
  } catch(error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { cards: [], error: message };
  }
}

export async function addCardToPool(
  card: CardData,
  tableName: PoolTableName = "card_pools"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from(tableName).insert({
      card_id: card.card_id,
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors || [],
      color_identity: card.color_identity || [],
      image_url: card.image_url,
      oldest_image_url: card.oldest_image_url,
      oracle_id: card.oracle_id,
      oracle_text: card.oracle_text, // <-- ADDED
      hidden: card.hidden || false,
      mana_cost: card.mana_cost,
      cmc: card.cmc || 0,
      pool_name: tableName === "the_chamber" ? "chamber" : "draft",
      created_by: user?.id || null,
    });

    if (error) return { success: false, error: error.message };
    if (tableName === "card_pools") invalidateDraftCache();
    
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function addCardsToPool(cards: CardData[], poolName: string = "draft"): Promise<{ success: boolean; error?: string; count?: number }> {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const cardsToInsert = cards.map((card) => ({
            card_id: card.card_id,
            card_name: card.card_name,
            card_set: card.card_set,
            card_type: card.card_type,
            rarity: card.rarity,
            colors: card.colors || [],
            color_identity: card.color_identity || [],
            image_url: card.image_url,
            oldest_image_url: card.oldest_image_url,
            oracle_id: card.oracle_id,
            oracle_text: card.oracle_text, // <-- ADDED
            hidden: card.hidden || false,
            mana_cost: card.mana_cost,
            cmc: card.cmc || 0,
            pool_name: poolName,
            created_by: user?.id || null,
        }));

        const { data, error } = await supabase.from("card_pools").insert(cardsToInsert).select();
        if (error) return { success: false, error: error.message };
        
        invalidateDraftCache();
        return { success: true, count: data?.length || 0 };
    } catch {
        return { success: false, error: "An unexpected error occurred" };
    }
}

export async function bulkImportAndSync(
  lines: string[],
  _defaultCubucksCost: number = 1,
  tableName: PoolTableName = "card_pools"
): Promise<{
  success: boolean;
  added: number;
  failed: { name: string; reason: string }[];
  error?: string;
  eloSyncMessage?: string;
}> {
    const supabase = await createClient();
    const poolName = tableName === "the_chamber" ? "chamber" : "draft";

    try {
        const requestedCards: { name: string; cost: number | null }[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let cardName = trimmed;
            let explicitCost: number | null = null;
            const lastCommaIndex = trimmed.lastIndexOf(",");
            if (lastCommaIndex !== -1) {
                const possibleCost = trimmed.substring(lastCommaIndex + 1).trim();
                const parsedCost = parseInt(possibleCost, 10);
                if (!isNaN(parsedCost) && parsedCost >= 0) {
                    cardName = trimmed.substring(0, lastCommaIndex).trim();
                    explicitCost = parsedCost;
                }
            }
            if (cardName) requestedCards.push({ name: cardName, cost: explicitCost });
        }
        
        if (requestedCards.length === 0) {
            return { success: true, added: 0, failed: [], eloSyncMessage: "No cards to import." };
        }

        const uniqueNamesToFetch = [...new Set(requestedCards.map(req => req.name))];
       const { cards: scryfallResults, notFound, errors: fetchErrors } = await fetchAllCards(uniqueNamesToFetch);
        
        const failedImports: { name: string; reason: string }[] = [];
        notFound.forEach(name => failedImports.push({ name, reason: "Not found on Scryfall" }));
        if(fetchErrors.length > 0) console.error("Scryfall fetch errors:", fetchErrors);

        // THE FIX: Check the reprint boolean!
        const reprintOracleIds = scryfallResults.filter(c => c.reprint).map(c => c.oracle_id).filter(Boolean) as string[];
        const originalPrintingsMap = await fetchOldestPrintings(reprintOracleIds);

        const scryfallCardMap = new Map<string, ScryfallCard>();
        scryfallResults.forEach(card => {
            // If it's a reprint, and we fetched the original, swap the entire card object out!
            if (card.reprint && card.oracle_id && originalPrintingsMap.has(card.oracle_id)) {
                scryfallCardMap.set(card.name.toLowerCase(), originalPrintingsMap.get(card.oracle_id)!);
            } else {
                scryfallCardMap.set(card.name.toLowerCase(), card);
            }
        });

        const cardsToInsert: Array<Omit<CardData, "id" | "created_at" | "rating_updated_at">> = [];

                    // --- HELPER TO EXTRACT ORACLE TEXT ---
        interface ScryfallFace { 
            oracle_text?: string;
            image_uris?: { normal?: string; small?: string; };
        }
        interface ScryfallData {
            oracle_text?: string;
            image_uris?: { normal?: string; small?: string; };
            card_faces?: ScryfallFace[];
        }

        const extractOracleText = (rawCard: unknown) => {
            const card = rawCard as ScryfallData;
            if (card.oracle_text) return card.oracle_text;
            if (card.card_faces) {
                return card.card_faces.map((face) => face.oracle_text).filter(Boolean).join('\n//\n');
            }
            return null;
        };
        
        // --- NEW HELPER FOR DFC IMAGES ---
        const extractImageUrl = (rawCard: unknown) => {
            const card = rawCard as ScryfallData;
            if (card.image_uris?.normal) return card.image_uris.normal;
            if (card.card_faces && card.card_faces[0]?.image_uris?.normal) {
                return card.card_faces[0].image_uris.normal;
            }
            return card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small;
        };

        for (const request of requestedCards) {
            const cardData = scryfallCardMap.get(request.name.toLowerCase());
            if (cardData) {
                const finalCost = request.cost !== null ? request.cost : calculateCubucksCost(cardData);
                const imageUrl = extractImageUrl(cardData);
                
                cardsToInsert.push({
                    card_id: cardData.id,
                    card_name: cardData.name,
                    card_set: cardData.set_name,
                    card_type: cardData.type_line,
                    rarity: cardData.rarity,
                    colors: cardData.colors || [],
                    color_identity: cardData.color_identity || [],
                    image_url: imageUrl, 
                    oldest_image_url:  imageUrl, 
                    oracle_id: cardData.oracle_id,
                    oracle_text: extractOracleText(cardData),
                    hidden: cardData.type_line.toLowerCase().includes('basic land'),
                    mana_cost: cardData.mana_cost,
                    cmc: cardData.cmc || 0,
                    cubucks_cost: finalCost,
                    pool_name: poolName,
                });
            }
        }

        if (cardsToInsert.length > 0) {
            const { error: insertError } = await supabase.from(tableName).insert(cardsToInsert);
            if (insertError) {
                return { success: false, added: 0, failed: failedImports, error: `DB insert error: ${insertError.message}` };
            }
            if (tableName === "card_pools") invalidateDraftCache();
        }
        
        const eloResult = await updateAllCubecobraElo(tableName);
        return {
            success: true,
            added: cardsToInsert.length,
            failed: failedImports,
            eloSyncMessage: eloResult.message || "ELO sync did not return a message.",
        };
    } catch (error) {
        return { success: false, added: 0, failed: [], error: error instanceof Error ? error.message : String(error) };
    }
}

export async function removeCardFromPool(dbId: string, tableName: PoolTableName = "card_pools"): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from(tableName).delete().eq("id", dbId);
    if (error) return { success: false, error: error.message };
    if (tableName === "card_pools") invalidateDraftCache();
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function clearCardPool(tableName: PoolTableName = "card_pools"): Promise<{ success: boolean; error?: string, removedCount?: number }> {
  const supabase = await createClient();
  try {
     const { count, error: deleteError } = await supabase.from(tableName).delete().not("id", "is", null);
    if (deleteError) return { success: false, error: deleteError.message };
    if (tableName === "card_pools") invalidateDraftCache();
    return { success: true, removedCount: count ?? 0 };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function removeFilteredCards(filter: "all" | "undrafted" | "drafted", poolName: string = "draft"): Promise<{ success: boolean; removedCount?: number; error?: string }> {
  const supabase = await createClient();
  try {
    if (filter === "all") {
      const { count, error: countError } = await supabase.from("card_pools").select("*", { count: "exact", head: true }).eq("pool_name", poolName);
      if(countError) throw countError;
      const { error: deleteError } = await supabase.from("card_pools").delete().eq("pool_name", poolName);
      if (deleteError) throw deleteError;
      return { success: true, removedCount: count || 0 };
    }

    const { data: poolCards, error: poolError } = await supabase.from("card_pools").select("id, card_id").eq("pool_name", poolName);
    if (poolError) throw poolError;
    if (!poolCards || poolCards.length === 0) return { success: true, removedCount: 0 };

    const { data: draftPicks, error: draftError } = await supabase.from("team_draft_picks").select("card_id");
    if (draftError) throw draftError;

    const draftedCardIds = new Set((draftPicks || []).map((p) => p.card_id));
    let idsToDelete: string[];

    if (filter === "undrafted") {
      idsToDelete = poolCards.filter((c) => !draftedCardIds.has(c.card_id)).map((c) => c.id);
    } else {
      idsToDelete = poolCards.filter((c) => draftedCardIds.has(c.card_id)).map((c) => c.id);
    }

    if (idsToDelete.length === 0) return { success: true, removedCount: 0 };
    const { error: deleteError } = await supabase.from("card_pools").delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
    return { success: true, removedCount: idsToDelete.length };
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
  } catch {
    return { pools: [], error: "An unexpected error occurred" };
  }
}

export async function backfillImportedCards(tableName: PoolTableName = "card_pools_next"): Promise<{ success: boolean; updated: number; error?: string }> {
    const supabase = await createClient();
    try {
        // --- THE MAGIC FIX: Check for missing oracle_text too! ---
        const { data: cardsToFix, error: fetchError } = await supabase
            .from(tableName)
            .select("id, card_name")
            .or('oracle_id.is.null,oracle_text.is.null'); 
            
        if (fetchError) throw fetchError;
        if (!cardsToFix || cardsToFix.length === 0) return { success: true, updated: 0 };

        const uniqueNames = [...new Set(cardsToFix.map(c => c.card_name))];
        const { cards: scryfallResults } = await fetchAllCards(uniqueNames);
        
        // THE FIX: Do the exact same boolean check and swap here
        const reprintOracleIds = scryfallResults.filter(c => c.reprint).map(c => c.oracle_id).filter(Boolean) as string[];
        const originalPrintingsMap = await fetchOldestPrintings(reprintOracleIds);

        const scryfallCardMap = new Map<string, ScryfallCard>();
        scryfallResults.forEach(card => {
            if (card.reprint && card.oracle_id && originalPrintingsMap.has(card.oracle_id)) {
                scryfallCardMap.set(card.name.toLowerCase(), originalPrintingsMap.get(card.oracle_id)!);
            } else {
                scryfallCardMap.set(card.name.toLowerCase(), card);
            }
        });

        let updatedCount = 0;
        
        interface ScryfallFace { oracle_text?: string; }
        interface ScryfallData { oracle_text?: string; card_faces?: ScryfallFace[]; }

        const extractOracleText = (rawCard: unknown) => {
            const card = rawCard as ScryfallData;
            if (card.oracle_text) return card.oracle_text;
            if (card.card_faces) return card.card_faces.map((face: ScryfallFace) => face.oracle_text).filter(Boolean).join('\n//\n');
            return null;
        };

        for (const dbCard of cardsToFix) {
            const scryData = scryfallCardMap.get(dbCard.card_name.toLowerCase());
            if (scryData) {
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update({
                        card_id: scryData.id,
                        oracle_id: scryData.oracle_id,
                        oracle_text: extractOracleText(scryData), 
                        image_url: scryData.image_uris?.normal || scryData.image_uris?.small,
                        oldest_image_url:  scryData.image_uris?.normal || scryData.image_uris?.small,
                        color_identity: scryData.color_identity || [],
                        cmc: scryData.cmc || 0,
                        hidden: scryData.type_line.toLowerCase().includes('basic land')
                    })
                    .eq("id", dbCard.id);
                if (!updateError) updatedCount++;
            }
        }
        return { success: true, updated: updatedCount };
    } catch (error) {
        return { success: false, updated: 0, error: String(error) };
    }
}


export async function promoteSeasonData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc('promote_season_data');
    if (error) throw error;
    invalidateDraftCache(); 
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
