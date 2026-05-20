// src/app/actions/cardActions.ts

"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { invalidateDraftCache } from '@/lib/draftCache';
import { type AnySupabaseClient } from "@/lib/supabase";
import { fetchAllCards, ScryfallCard , fetchOldestPrintings } from "@/lib/scryfall-client";
import { updateAllCubecobraElo } from "./cardRatingActions";



export type PoolTableName = "card_pools" | "the_chamber" | "resort_pool" | "card_pools_next"; 


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

// --- MODIFIED: Added hidden and oracle_id ---
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

/**
 * NEW HELPER FUNCTION
 * Calculates a card's Cubucks cost based on its format legalities.
 * - Default: 1
 * - Banned in Legacy: 3
 * - Restricted in Vintage: 5 (this takes precedence)
 */
function calculateCubucksCost(card: ScryfallCard): number {
  const legalities = card.legalities;
  let cost = 1; // Default cost

  // Per your logic, these are sequential multipliers on the base value
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
  const supabase = adminClient ?? await createClient();
  console.log(`[Draft Availability] Checking for pool: "${poolName}"`);
  try {
    // This first query to get all IDs is no longer needed, we can do it in one step.
    
    const { data: draftedPicks, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("card_pool_id")
      .not("card_pool_id", "is", null);

    if (draftError) {
      console.error("[Draft Availability] Error fetching from team_draft_picks:", draftError);
      return { cards: [], error: draftError.message };
    }

    const draftedInstanceIds = (draftedPicks || []).map(p => p.card_pool_id).filter(Boolean) as string[];
    console.log(`[Draft Availability] Found ${draftedInstanceIds.length} unique drafted card instances.`);

    // --- CORRECTED QUERY ---
    // Let the Supabase client handle the formatting of the 'in' clause.
    // We just provide an array of strings.

    let query = supabase
        .from("card_pools")
        .select("*")
        .eq("pool_name", poolName)
        .eq('hidden', false);

    // Only add the .not() filter if there are actually drafted cards to exclude.
    if (draftedInstanceIds.length > 0) {
        query = query.not("id", "in", `(${draftedInstanceIds.join(',')})`);
    }

    const { data: availableCards, error: availableError } = await query.order("card_name", { ascending: true });

    if(availableError) {
        console.error("[Draft Availability] Error fetching available card details:", availableError);
        return { cards: [], error: availableError.message };
    }
    
    console.log(`[Draft Availability] After filtering, there are ${availableCards?.length || 0} cards available.`);

    return { cards: availableCards || [] };

  } catch(error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[Draft Availability] UNEXPECTED CATCH BLOCK ERROR:", message);
    return { cards: [], error: message };
  }
}
export async function addCardToPool(
  card: CardData,
  tableName: PoolTableName = "card_pools"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      hidden: card.hidden || false,
      mana_cost: card.mana_cost,
      cmc: card.cmc || 0,
      pool_name: tableName === "the_chamber" ? "chamber" : "draft",
      created_by: user?.id || null,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (tableName === "card_pools") {
      invalidateDraftCache();
    }
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
            hidden: card.hidden || false,
            mana_cost: card.mana_cost,
            cmc: card.cmc || 0,
            pool_name: poolName,
            created_by: user?.id || null,
        }));
        const { data, error } = await supabase.from("card_pools").insert(cardsToInsert).select();
        if (error) { return { success: false, error: error.message }; }
        invalidateDraftCache();
        return { success: true, count: data?.length || 0 };
    } catch {
        return { success: false, error: "An unexpected error occurred" };
    }
}

/**
 * REVISED CONSOLIDATED FUNCTION
 * This function now allows duplicate card entries.
 * 1. Parses every line from the input for card names and optional costs.
 * 2. Fetches complete data for the unique names from Scryfall.
 * 3. Creates a distinct record for every line in the input.
 * 4. Inserts all new cards into the specified database table.
 * 5. After successful import, triggers the CubeCobra ELO sync.
 */
export async function bulkImportAndSync(
  lines: string[],
  defaultCubucksCost: number = 1, // This is now a fallback
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
        // 1. Parse all input lines.
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
            if (cardName) {
                requestedCards.push({ name: cardName, cost: explicitCost });
            }
        }
        
        if (requestedCards.length === 0) {
            return { success: true, added: 0, failed: [], eloSyncMessage: "No cards to import." };
        }

        // 2. Fetch unique card data from Scryfall.
        const uniqueNamesToFetch = [...new Set(requestedCards.map(req => req.name))];
        const { cards: scryfallResults, notFound, errors: fetchErrors } = await fetchAllCards(uniqueNamesToFetch);
        
        const failedImports: { name: string; reason: string }[] = [];
        notFound.forEach(name => failedImports.push({ name, reason: "Not found on Scryfall" }));
        if(fetchErrors.length > 0) console.error("Scryfall fetch errors:", fetchErrors);

        const scryfallCardMap = new Map<string, ScryfallCard>();
        scryfallResults.forEach(card => scryfallCardMap.set(card.name.toLowerCase(), card));

        const oracleIds = scryfallResults.map(c => c.oracle_id).filter(Boolean);
        const oldestImageMap = await fetchOldestPrintings(oracleIds);

        // 3. Prepare a card record for EVERY requested card, applying pricing logic.
        const cardsToInsert: Array<Omit<CardData, "id" | "created_at" | "rating_updated_at">> = [];
        for (const request of requestedCards) {
            const cardData = scryfallCardMap.get(request.name.toLowerCase());
            if (cardData) {
                // Determine cost: use explicit cost from input if provided, otherwise calculate it.
                const finalCost = request.cost !== null ? request.cost : calculateCubucksCost(cardData);

                cardsToInsert.push({
                    card_id: cardData.id,
                    card_name: cardData.name,
                    card_set: cardData.set_name,
                    card_type: cardData.type_line,
                    rarity: cardData.rarity,
                    colors: cardData.colors || [],
                    color_identity: cardData.color_identity || [],
                    image_url: cardData.image_uris?.normal || cardData.image_uris?.small,
                    oldest_image_url: oldestImageMap.get(cardData.oracle_id) || cardData.image_uris?.normal,
                    oracle_id: cardData.oracle_id,
                    hidden: cardData.type_line.toLowerCase().includes('basic land'),
                    mana_cost: cardData.mana_cost,
                    cmc: cardData.cmc || 0,
                    cubucks_cost: finalCost, // Use the determined cost
                    pool_name: poolName,
                });
            }
        }

        // 4. Insert cards into the database.
        if (cardsToInsert.length > 0) {
            const { error: insertError } = await supabase.from(tableName).insert(cardsToInsert);
            if (insertError) {
                return { success: false, added: 0, failed: failedImports, error: `DB insert error: ${insertError.message}` };
            }
            if (tableName === "card_pools") {
                invalidateDraftCache();
            }
        }
        
        // 5. Trigger ELO Sync.
        console.log("Card import successful. Starting ELO sync...");
  const eloResult = await updateAllCubecobraElo(tableName);

        return {
            success: true,
            added: cardsToInsert.length,
            failed: failedImports,
            eloSyncMessage: eloResult.message || "ELO sync did not return a message.",
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, added: 0, failed: [], error: errorMessage };
    }
}



export async function removeCardFromPool(
  dbId: string,
  tableName: PoolTableName = "card_pools"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from(tableName).delete().eq("id", dbId);
    if (error) {
      return { success: false, error: error.message };
    }
    if (tableName === "card_pools") {
      invalidateDraftCache();
    }
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function clearCardPool(
  tableName: PoolTableName = "card_pools"
): Promise<{ success: boolean; error?: string, removedCount?: number }> {
  const supabase = await createClient();
  try {
     const { count, error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .not("id", "is", null);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
    if (tableName === "card_pools") {
      invalidateDraftCache();
    }
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
    if (!poolCards || poolCards.length === 0) { return { success: true, removedCount: 0 }; }
    const { data: draftPicks, error: draftError } = await supabase.from("team_draft_picks").select("card_id");
    if (draftError) throw draftError;
    const draftedCardIds = new Set((draftPicks || []).map((p) => p.card_id));
    let idsToDelete: string[];
    if (filter === "undrafted") {
      idsToDelete = poolCards.filter((c) => !draftedCardIds.has(c.card_id)).map((c) => c.id);
    } else {
      idsToDelete = poolCards.filter((c) => draftedCardIds.has(c.card_id)).map((c) => c.id);
    }
    if (idsToDelete.length === 0) { return { success: true, removedCount: 0 }; }
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
    if (error) {
        console.error("Error fetching pool names:", error.message);
        return { pools: [], error: error.message };
    }
    const uniquePools = [...new Set((data || []).map((item) => item.pool_name))];
    return { pools: uniquePools };
  } catch {
    return { pools: [], error: "An unexpected error occurred" };
  }
}

/**
 * NEW HELPER FUNCTION
 * Scans an imported card pool for rows missing Scryfall enrichment (missing oracle_id)
 * Fetches the missing images, IDs, and color identities, then updates the rows.
 */
export async function backfillImportedCards(
  tableName: PoolTableName = "card_pools_next"
): Promise<{ success: boolean; updated: number; error?: string }> {
    const supabase = await createClient();

    try {
        // 1. Get cards that are missing Scryfall data (oracle_id is null)
        const { data: cardsToFix, error: fetchError } = await supabase
            .from(tableName)
            .select("id, card_name")
            .is("oracle_id", null); 

        if (fetchError) throw fetchError;
        if (!cardsToFix || cardsToFix.length === 0) {
            return { success: true, updated: 0 };
        }

        console.log(`[BACKFILL] Found ${cardsToFix.length} cards missing Scryfall data. Fetching...`);

        // 2. Fetch missing data from Scryfall
        const uniqueNames = [...new Set(cardsToFix.map(c => c.card_name))];
        const { cards: scryfallResults, notFound, errors: fetchErrors } = await fetchAllCards(uniqueNames);
        
        if (fetchErrors.length > 0) console.error("[BACKFILL] Scryfall fetch errors:", fetchErrors);
        if (notFound.length > 0) console.warn("[BACKFILL] Cards not found on Scryfall:", notFound);

        const scryfallCardMap = new Map<string, ScryfallCard>();
        scryfallResults.forEach(card => scryfallCardMap.set(card.name.toLowerCase(), card));

        // 3. Fetch oldest printings to guarantee retro frames if available
        const oracleIds = scryfallResults.map(c => c.oracle_id).filter(Boolean);
        const oldestImageMap = await fetchOldestPrintings(oracleIds);

        let updatedCount = 0;

        // 4. Update the database rows one by one
        for (const dbCard of cardsToFix) {
            const scryData = scryfallCardMap.get(dbCard.card_name.toLowerCase());
            if (scryData) {
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update({
                        card_id: scryData.id,
                        oracle_id: scryData.oracle_id,
                        image_url: scryData.image_uris?.normal || scryData.image_uris?.small,
                        oldest_image_url: oldestImageMap.get(scryData.oracle_id) || scryData.image_uris?.normal,
                        color_identity: scryData.color_identity || [],
                        cmc: scryData.cmc || 0,
                        hidden: scryData.type_line.toLowerCase().includes('basic land')
                    })
                    .eq("id", dbCard.id);

                if (!updateError) {
                    updatedCount++;
                } else {
                    console.error(`[BACKFILL] Failed to update ${dbCard.card_name}:`, updateError.message);
                }
            }
        }

        console.log(`[BACKFILL] Complete! Successfully updated ${updatedCount} cards.`);
        return { success: true, updated: updatedCount };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, updated: 0, error: errorMessage };
    }
}
export async function promoteSeasonData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc('promote_season_data');
    if (error) throw error;
    
    // Clear the cache so the frontend updates immediately
    invalidateDraftCache(); 
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

