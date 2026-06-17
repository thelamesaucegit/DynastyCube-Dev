// src/app/actions/chamberActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { fetchAllCards, searchAllCards, ScryfallCard } from "@/lib/scryfall-client";
import { type CardData } from "./cardActions";
import { fetchEloMapFromS3 } from "./cardRatingActions"; // THE FIX: Import S3 Fetcher

// Helper to create a Supabase client
async function getSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function calculateCubucksCost(card: ScryfallCard): number {
    const legalities = card.legalities;
    let cost = 1;
    if (legalities.legacy === 'banned' && legalities.vintage !== 'restricted') cost *= 3;
    if (legalities.vintage === 'restricted') cost *= 5;
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

    const scryfallQuery = `(set:${nextSet.set_code}) -is:reprint -banned:vintage -oracle:banding -oracle:"bands with" -oracle:" ante"`;
    
    const { cards: scryfallResults, errors: fetchErrors } = await searchAllCards(scryfallQuery);
    if (fetchErrors.length > 0) console.error("Scryfall fetch errors:", fetchErrors);
    if (scryfallResults.length === 0) console.warn(`No cards found for set ${nextSet.set_name}.`);

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

    // THE FIX: Fetch the ELO Map before transforming so we can attach it INLINE
    console.log(`[Chamber Actions] Fetching S3 ELO map to hydrate new cards inline...`);
    const eloMap = await fetchEloMapFromS3();

    // Note: We removed rating_updated_at from the Omit so we can assign it inline!
    const cardsToInsert: Array<Omit<CardData, "id" | "created_at">> = scryfallResults.map(card => {
        const finalCost = calculateCubucksCost(card);
        const rawElo = eloMap.get(card.name.toLowerCase());
        const elo = rawElo != null ? Math.round(rawElo) : undefined;

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
            cubecobra_elo: elo, // <--- HYDRATED INLINE
            rating_updated_at: elo != null ? new Date().toISOString() : undefined, // <--- HYDRATED INLINE
            pool_name: 'chamber', 
        };
    });

    if (cardsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("the_chamber").insert(cardsToInsert);
        if (insertError) {
            throw new Error(`Failed to insert cards into the_chamber: ${insertError.message}`);
        }
    }

    const { error: updateRecordError } = await supabase
      .from("chamber_records")
      .update({ in_chamber: true })
      .eq("id", nextSet.id);

    if (updateRecordError) {
      console.error(`CRITICAL: Failed to update chamber_records for set ${nextSet.set_code}. Manual correction needed.`);
      throw new Error(`Cards were imported, but failed to update record for ${nextSet.set_code}: ${updateRecordError.message}`);
    }

    return {
      success: true,
      message: `Successfully processed set '${nextSet.set_name}' and hydrated CubeCobra ELOs.`,
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
