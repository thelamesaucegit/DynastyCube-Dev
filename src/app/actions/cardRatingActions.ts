"use server";

import { createServerClient } from "@/lib/supabase";

// NEW: Helper interfaces for the S3 data structures
interface NameToId {
  [key: string]: string[]; // e.g., "lightning bolt": ["0000579f-7b35-4ed3-b44c-db2a538066fe"]
}

interface SimpleCard {
  name: string;
  elo?: number;
}

interface SimpleCardDict {
  [key: string]: SimpleCard; // Key is Oracle ID
}


interface CardRatingResult {
  success: boolean;
  updatedCount?: number;
  notFoundCount?: number;
  errorCount?: number;
  message?: string;
  errors?: string[];
}

const S3_BUCKET_URL = "https://cubecobra-public.s3.amazonaws.com/";

/**
 * NEW: Fetches the required JSON files from CubeCobra's public S3 bucket
 * and builds the ELO map.
 */
async function fetchEloMapFromS3(): Promise<Map<string, number>> {
  try {
    console.log("Fetching ELO data from CubeCobra S3 bucket...");

    // 1. Fetch the name-to-oracle-ID mapping
    const nameToIdResponse = await fetch(`${S3_BUCKET_URL}cards/nameToId.json`);
    if (!nameToIdResponse.ok) {
      throw new Error("Failed to fetch nameToId.json");
    }
    const nameToId: NameToId = await nameToIdResponse.json();

    // 2. Fetch the card dictionary with ELO scores
    const simpleCardDictResponse = await fetch(`${S3_BUCKET_URL}export/simpleCardDict.json`);
    if (!simpleCardDictResponse.ok) {
      throw new Error("Failed to fetch simpleCardDict.json");
    }
    const simpleCardDict: SimpleCardDict = await simpleCardDictResponse.json();

    console.log("Successfully fetched S3 data. Building ELO map...");

    // 3. Create the final ELO map (lowercase name -> elo)
    const eloMap = new Map<string, number>();

    for (const name in nameToId) {
      const oracleIds = nameToId[name];
      if (oracleIds && oracleIds.length > 0) {
        // Use the first Oracle ID to look up the card data
        const cardData = simpleCardDict[oracleIds[0]];
        if (cardData && typeof cardData.elo === 'number') {
          eloMap.set(name.toLowerCase(), cardData.elo);
        }
      }
    }
    
    console.log(`ELO map built successfully with ${eloMap.size} entries.`);
    return eloMap;

  } catch (error) {
    console.error("Error fetching or processing CubeCobra S3 data:", error);
    // Return an empty map on failure to prevent downstream errors
    return new Map<string, number>();
  }
}


/**
 * Helper: Update a table's cubecobra_elo using a pre-fetched ELO map
 */
async function updateTableCubecobraElo(
  tableName: "card_pools" | "team_draft_picks",
  eloMap: Map<string, number>
): Promise<CardRatingResult> {
  // This function remains unchanged as it's already doing its job perfectly!
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    const { data: cards, error: fetchError } = await supabase
      .from(tableName)
      .select("id, card_name");

    if (fetchError) {
      return { success: false, message: `Database error: ${fetchError.message}` };
    }
    if (!cards || cards.length === 0) {
      return { success: true, updatedCount: 0, message: `No cards found in ${tableName}` };
    }

    console.log(`Matching ${cards.length} cards from ${tableName} against CubeCobra ELO data...`);
    let updatedCount = 0;
    let notFoundCount = 0;
    const updateErrors: string[] = [];

    // Use a transaction for bulk updates for better performance
    const updates = cards
      .map(card => {
        const elo = eloMap.get(card.card_name.toLowerCase());
        if (elo != null) {
          return {
            id: card.id,
            cubecobra_elo: elo,
            rating_updated_at: new Date().toISOString(),
          };
        } else {
          notFoundCount++;
          return null;
        }
      })
      .filter(Boolean) as { id: string; cubecobra_elo: number; rating_updated_at: string }[];

    if (updates.length > 0) {
      const { error: updateError } = await supabase.from(tableName).upsert(updates);
      if (updateError) {
        updateErrors.push(`Bulk update failed: ${updateError.message}`);
        console.error(`Error bulk updating ${tableName}:`, updateError);
      } else {
        updatedCount = updates.length;
      }
    }

    return {
      success: updateErrors.length === 0,
      updatedCount,
      notFoundCount,
      errorCount: updateErrors.length,
      message: `Updated ${updatedCount} cards in ${tableName}. Not found: ${notFoundCount}. Errors: ${updateErrors.length}`,
      errors: updateErrors.length > 0 ? updateErrors : undefined,
    };
  } catch (error) {
    console.error(`Unexpected error updating ${tableName} CubeCobra ELO:`, error);
    return { success: false, message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * REPLACED: This now uses the S3 data source instead of a specific cube
 */
export async function updateAllCubecobraElo(): Promise<{
  success: boolean;
  poolResult?: CardRatingResult;
  draftResult?: CardRatingResult;
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    console.log("Starting full CubeCobra ELO update from S3 source...");
    
    // Fetch the global ELO map once
    const eloMap = await fetchEloMapFromS3();
    
    if (eloMap.size === 0) {
      return { success: false, message: "Failed to build ELO map from CubeCobra S3 data. Check server logs." };
    }

    // Update both tables using the same ELO map
    const poolResult = await updateTableCubecobraElo("card_pools", eloMap);
    const draftResult = await updateTableCubecobraElo("team_draft_picks", eloMap);

    const totalUpdated = (poolResult.updatedCount || 0) + (draftResult.updatedCount || 0);
    const totalNotFound = (poolResult.notFoundCount || 0) + (draftResult.notFoundCount || 0);
    const totalErrors = (poolResult.errorCount || 0) + (draftResult.errorCount || 0);

    return {
      success: poolResult.success && draftResult.success,
      poolResult,
      draftResult,
      message: `CubeCobra ELO Sync: ${totalUpdated} updated, ${totalNotFound} not found, ${totalErrors} errors`,
    };
  } catch (error) {
    console.error("Unexpected error in updateAllCubecobraElo:", error);
    return { success: false, message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// NOTE: The single-table update functions and the test function are now deprecated
// as they rely on the old cube-specific fetch. You can either remove them
// or leave them if they are used elsewhere for testing specific cubes.
// For simplicity, I'm leaving them out of this final version.
