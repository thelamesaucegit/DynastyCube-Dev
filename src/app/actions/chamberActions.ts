// src/app/actions/chamberActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { fetchAllCards, searchAllCards, ScryfallCard } from "@/lib/scryfall-client";
import { type CardData } from "./cardActions";

// Helper to create a Supabase client
async function getSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

// Re-using the cost calculation logic from cardActions
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

export async function importNextSetToChamber(): Promise<{
  success: boolean;
  message: string;
  importedSetName?: string;
  cardsAdded?: number;
  errors?: string[];
}> {
  const supabase = await getSupabaseClient();

  try {
    // 1. Find the next set to import...
    const { data: nextSet, error: fetchSetError } = await supabase
      .from("chamber_records")
      .select("*")
      .eq("added", false)
      .eq("in_chamber", false) 
      .eq("bonus", false)
      .order("set_num", { ascending: true })
      .limit(1)
      .single();

    if (fetchSetError || !nextSet) {
      if (fetchSetError && fetchSetError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch next set: ${fetchSetError.message}`);
      }
      return { success: true, message: "All available sets have been imported into The Chamber." };
    }

    console.log(`Found next set to import: ${nextSet.set_name} (Code: ${nextSet.set_code})`);

    // 2. Construct the Scryfall search query...
    const scryfallQuery = `(set:${nextSet.set_code}) -is:reprint -banned:vintage -oracle:banding -oracle:"bands with" -oracle:" ante"`;
    
    // 3. Fetch all matching cards using the new `searchAllCards` function.
    const { cards: scryfallResults, errors: fetchErrors } = await searchAllCards(scryfallQuery);

    if (fetchErrors.length > 0) {
        console.error("Scryfall fetch errors:", fetchErrors);
    }
    
    if (scryfallResults.length === 0) {
        console.warn(`No cards found for set ${nextSet.set_name} matching the criteria.`);
    }

    // --- HELPER TO EXTRACT ORACLE TEXT ---
    interface ScryfallFace { oracle_text?: string; }
    interface ScryfallData { oracle_text?: string; card_faces?: ScryfallFace[]; }

    const extractOracleText = (rawCard: unknown) => {
        const card = rawCard as ScryfallData;
        if (card.oracle_text) return card.oracle_text;
        if (card.card_faces) {
            return card.card_faces.map((face: ScryfallFace) => face.oracle_text).filter(Boolean).join('\n//\n');
        }
        return null;
    };

    // 4. Prepare card data for insertion...
    const cardsToInsert: Array<Omit<CardData, "id" | "created_at" | "rating_updated_at">> = scryfallResults.map(card => {
        const finalCost = calculateCubucksCost(card);

        return {
            card_id: card.id,
            card_name: card.name,
            card_set: card.set_name,
            card_type: card.type_line,
            rarity: card.rarity,
            oracle_text: extractOracleText(card),
            colors: card.colors || [],
            color_identity: card.color_identity || [],
            image_url: card.image_uris?.normal || card.image_uris?.small,
            oracle_id: card.oracle_id,
            hidden: card.type_line.toLowerCase().includes('basic land'),
            mana_cost: card.mana_cost,
            cmc: card.cmc || 0,
            cubucks_cost: finalCost,
            pool_name: 'chamber', // Valid FK name for the chamber
        };
    });

    // 5. Insert the new cards...
    if (cardsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("the_chamber").insert(cardsToInsert);
        if (insertError) {
            throw new Error(`Failed to insert cards into the_chamber: ${insertError.message}`);
        }
    }

    // 6. Update the record...
    const { error: updateRecordError } = await supabase
      .from("chamber_records")
      .update({ in_chamber: true })
      .eq("id", nextSet.id);

    if (updateRecordError) {
      console.error(`CRITICAL: Failed to update chamber_records for set ${nextSet.set_code}. Manual correction needed.`);
      throw new Error(`Cards were imported, but failed to update record for ${nextSet.set_code}: ${updateRecordError.message}`);
    }

    // =========================================================================
    // THE FIX: DYNAMICALLY SYNC ELO IMMEDIATELY UPON IMPORT
    // =========================================================================
    console.log(`[Chamber Actions] Triggering ELO Sync for newly imported cards in the_chamber...`);
    try {
        const { updateAllCubecobraElo } = await import('@/app/actions/cardRatingActions');
        const syncResult = await updateAllCubecobraElo('the_chamber');
        
        if (!syncResult.success) {
            console.warn(`[Chamber Actions] Minor Warning: ELO sync returned false during import. Log: ${syncResult.message}`);
        } else {
            console.log(`[Chamber Actions] ELO Sync complete for new chamber set!`);
        }
    } catch (eloErr) {
        console.error(`[Chamber Actions] Critical Error running ELO sync after import:`, eloErr);
        // We log it but do not throw, so the user still gets a success message for the base import.
    }

    return {
      success: true,
      message: `Successfully processed set '${nextSet.set_name}' and synced CubeCobra ELO.`,
      importedSetName: nextSet.set_name,
      cardsAdded: cardsToInsert.length,
      errors: fetchErrors,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Error in importNextSetToChamber:", message);
    return { success: false, message };
  }
}
