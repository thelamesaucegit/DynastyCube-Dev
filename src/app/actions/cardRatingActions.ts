// src/app/actions/cardRatingActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import type { PoolTableName } from "./cardActions"; 

interface SimpleCard {
  name: string;
  elo?: number;
}

interface SimpleCardDict {
  [key: string]: SimpleCard; 
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
 * NEW: Exported so it can be used natively during Card Imports!
 */
export async function fetchEloMapFromS3(): Promise<Map<string, number>> {
  try {
    console.log("Fetching ELO data from CubeCobra S3 bucket...");
    const simpleCardDictResponse = await fetch(`${S3_BUCKET_URL}export/simpleCardDict.json`);

    if (!simpleCardDictResponse.ok) {
      throw new Error("Failed to fetch simpleCardDict.json from S3");
    }

    const simpleCardDict: SimpleCardDict = await simpleCardDictResponse.json();
    console.log("Successfully fetched S3 data. Building ELO map...");

    const eloMap = new Map<string, number>();

    for (const oracleId in simpleCardDict) {
      const cardData = simpleCardDict[oracleId];
      if (cardData && cardData.name && typeof cardData.elo === 'number') {
        eloMap.set(cardData.name.toLowerCase(), cardData.elo);
      }
    }
    
    console.log(`ELO map built successfully with ${eloMap.size} entries.`);
    return eloMap;
  } catch (error) {
    console.error("Error fetching or processing CubeCobra S3 data:", error);
    return new Map<string, number>();
  }
}

/**
 * Helper: Update a table's cubecobra_elo using a pre-fetched ELO map
 */
export async function updateTableCubecobraElo(
  tableName: PoolTableName | "team_draft_picks",
  eloMap: Map<string, number>,
  systemOverride: boolean = false // THE FIX: Allow cron jobs to bypass user auth
): Promise<CardRatingResult> {
  try {
    const supabase = await createServerClient();
    
    if (!systemOverride) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Not authenticated" };
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

    for (const card of cards) {
      const elo = eloMap.get(card.card_name.toLowerCase());
      
      if (elo == null) {
        notFoundCount++;
        continue;
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          cubecobra_elo: Math.round(elo),
          rating_updated_at: new Date().toISOString(),
        })
        .eq("id", card.id);

      if (updateError) {
        const errorMsg = `Failed to update ${card.card_name}: ${updateError.message}`;
        updateErrors.push(errorMsg);
        console.error(errorMsg);
      } else {
        updatedCount++;
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

export async function updateAllCubecobraElo(
  tableName?: PoolTableName,
  systemOverride: boolean = false // THE FIX: Allow cron jobs to bypass user auth
): Promise<{
  success: boolean;
  results: CardRatingResult[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    
    if (!systemOverride) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, results: [], message: "Not authenticated" };
    }
    
    console.log(`Starting CubeCobra ELO sync. Target: ${tableName || 'All Tables'}`);
    
    const eloMap = await fetchEloMapFromS3();
    if (eloMap.size === 0) {
      return { success: false, results: [], message: "Failed to build ELO map from CubeCobra S3 data." };
    }

    const syncResults: CardRatingResult[] = [];
    const tablesToSync: PoolTableName[] = tableName ? [tableName] : ["card_pools", "the_chamber", "resort_pool"];

    for (const table of tablesToSync) {
        const result = await updateTableCubecobraElo(table, eloMap, systemOverride);
        syncResults.push({ ...result, message: `[${table}] ${result.message}` });
    }

    const draftResult = await updateTableCubecobraElo("team_draft_picks", eloMap, systemOverride);
    syncResults.push({ ...draftResult, message: `[team_draft_picks] ${draftResult.message}` });

    const totalUpdated = syncResults.reduce((sum, res) => sum + (res.updatedCount || 0), 0);
    const totalNotFound = syncResults.reduce((sum, res) => sum + (res.notFoundCount || 0), 0);
    const totalErrors = syncResults.reduce((sum, res) => sum + (res.errorCount || 0), 0);

    return {
      success: syncResults.every(res => res.success),
      results: syncResults,
      message: `ELO Sync Complete: ${totalUpdated} updated, ${totalNotFound} not found, ${totalErrors} errors.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Unexpected error in updateAllCubecobraElo:", error);
    return { success: false, results: [], message: `Unexpected error: ${message}` };
  }
}
