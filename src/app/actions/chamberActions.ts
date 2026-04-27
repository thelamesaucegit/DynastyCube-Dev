//src/app/actions/chamberActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";
import { fetchAllCards, ScryfallCard } from "@/lib/scryfall-client";
import { type CardData } from "./cardActions"; // We'll reuse this interface

// Helper to create a Supabase client
async function getSupabaseClient() {
  // Assuming you have a standard way to create a service role client for admin actions
  // If not, we can use the user-based client. For admin tasks, service role is safer.
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
    // 1. Find the next set to import from chamber_records
    const { data: nextSet, error: fetchSetError } = await supabase
      .from("chamber_records")
      .select("*")
      .eq("in_chamber", false)
      .eq("bonus", false)
      .order("set_num", { ascending: true })
      .limit(1)
      .single();

    if (fetchSetError || !nextSet) {
      if (fetchSetError && fetchSetError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(`Failed to fetch next set: ${fetchSetError.message}`);
      }
      return { success: true, message: "All available sets have been imported into The Chamber." };
    }

    console.log(`Found next set to import: ${nextSet.set_name} (Code: ${nextSet.set_code})`);

    // 2. Construct the Scryfall search query based on your requirements
    const scryfallQuery = `(set:${nextSet.set_code}) -is:reprint -banned:vintage -oracle:banding -oracle:"bands with" -oracle:" ante"`;
    
    // 3. Fetch all matching cards from Scryfall
    const { cards: scryfallResults, notFound, errors: fetchErrors } = await fetchAllCards(scryfallQuery);

    if (fetchErrors.length > 0) {
        console.error("Scryfall fetch errors:", fetchErrors);
    }
    
    if (scryfallResults.length === 0) {
        // This can happen for sets with no cards matching the criteria. We should still mark it as done.
        console.warn(`No cards found for set ${nextSet.set_name} matching the criteria.`);
    }

    // 4. Prepare card data for insertion, including calculated cost
    const cardsToInsert: Array<Omit<CardData, "id" | "created_at" | "rating_updated_at">> = scryfallResults.map(card => {
        const finalCost = calculateCubucksCost(card);
        return {
            card_id: card.id,
            card_name: card.name,
            card_set: card.set_name,
            card_type: card.type_line,
            rarity: card.rarity,
            colors: card.colors || [],
            color_identity: card.color_identity || [],
            image_url: card.image_uris?.normal || card.image_uris?.small,
            oracle_id: card.oracle_id,
            hidden: card.type_line.toLowerCase().includes('basic land'),
            mana_cost: card.mana_cost,
            cmc: card.cmc || 0,
            cubucks_cost: finalCost,
            pool_name: 'chamber', // Explicitly set for this table
        };
    });

    // 5. Insert the new cards into `the_chamber` table
    if (cardsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("the_chamber").insert(cardsToInsert);
        if (insertError) {
            throw new Error(`Failed to insert cards into the_chamber: ${insertError.message}`);
        }
    }

    // 6. Update the record in `chamber_records` to mark it as complete
    const { error: updateRecordError } = await supabase
      .from("chamber_records")
      .update({ in_chamber: true, added: true }) // Mark as both in_chamber and added
      .eq("id", nextSet.id);

    if (updateRecordError) {
      // This is a critical error, as it could lead to re-importing the same set.
      console.error(`CRITICAL: Failed to update chamber_records for set ${nextSet.set_code}. Manual correction needed.`);
      throw new Error(`Cards were imported, but failed to update record for ${nextSet.set_code}: ${updateRecordError.message}`);
    }

    return {
      success: true,
      message: `Successfully processed set '${nextSet.set_name}'.`,
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
