// src/app/actions/cardRatingActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import {
  fetchCubeData,
  extractEloMap,
} from "@/lib/cubecobra-client";

interface CardRatingResult {
  success: boolean;
  updatedCount?: number;
  notFoundCount?: number;
  errorCount?: number;
  message?: string;
  errors?: string[];
}

const DEFAULT_CUBE_ID = process.env.NEXT_PUBLIC_CUBECOBRA_CUBE_ID || "TheDynastyCube";

/**
 * Helper: Update a table's cubecobra_elo using a pre-fetched ELO map
 */
async function updateTableCubecobraElo(
  tableName: "card_pools" | "team_draft_picks",
  eloMap: Map<string, number>
): Promise<CardRatingResult> {
  try {
    const supabase = await createServerClient();

    // Check admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    // Fetch all cards from table
    const { data: cards, error: fetchError } = await supabase
      .from(tableName)
      .select("id, card_name");

    if (fetchError) {
      console.error(`Error fetching cards from ${tableName}:`, fetchError);
      return {
        success: false,
        message: `Database error: ${fetchError.message}`,
      };
    }

    if (!cards || cards.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: `No cards found in ${tableName}`,
      };
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
          cubecobra_elo: elo,
          rating_updated_at: new Date().toISOString(),
        })
        .eq("id", card.id);

      if (updateError) {
        updateErrors.push(`Failed to update ${card.card_name}: ${updateError.message}`);
        console.error(`Error updating ${card.card_name} in ${tableName}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      notFoundCount,
      errorCount: updateErrors.length,
      message: `Updated ${updatedCount} cards in ${tableName}. Not in cube: ${notFoundCount}. Errors: ${updateErrors.length}`,
      errors: updateErrors.length > 0 ? updateErrors : undefined,
    };
  } catch (error) {
    console.error(`Unexpected error updating ${tableName} CubeCobra ELO:`, error);
    return {
      success: false,
      message: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Update CubeCobra ELO for cards in card_pools table
 */
export async function updatePoolCubecobraElo(
  cubeId?: string
): Promise<CardRatingResult> {
  const id = cubeId || DEFAULT_CUBE_ID;
  console.log(`Fetching CubeCobra ELO for cube: ${id}`);

  const cubeData = await fetchCubeData(id);
  if (!cubeData) {
    return { success: false, message: `Failed to fetch cube "${id}" from CubeCobra` };
  }

  const eloMap = extractEloMap(cubeData);
  if (eloMap.size === 0) {
    return { success: false, message: "No ELO data found in CubeCobra response" };
  }

  return updateTableCubecobraElo("card_pools", eloMap);
}

/**
 * Update CubeCobra ELO for cards in team_draft_picks table
 */
export async function updateDraftPickCubecobraElo(
  cubeId?: string
): Promise<CardRatingResult> {
  const id = cubeId || DEFAULT_CUBE_ID;
  console.log(`Fetching CubeCobra ELO for cube: ${id}`);

  const cubeData = await fetchCubeData(id);
  if (!cubeData) {
    return { success: false, message: `Failed to fetch cube "${id}" from CubeCobra` };
  }

  const eloMap = extractEloMap(cubeData);
  if (eloMap.size === 0) {
    return { success: false, message: "No ELO data found in CubeCobra response" };
  }

  return updateTableCubecobraElo("team_draft_picks", eloMap);
}

/**
 * Update CubeCobra ELO for all cards (both pools and draft picks)
 * Fetches cube data once and reuses the ELO map for both tables
 */
export async function updateAllCubecobraElo(
  cubeId?: string
): Promise<{
  success: boolean;
  poolResult?: CardRatingResult;
  draftResult?: CardRatingResult;
  message?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Not authenticated" };
    }

    const id = cubeId || DEFAULT_CUBE_ID;
    console.log(`Starting full CubeCobra ELO update for cube: ${id}`);

    // Fetch cube data once
    const cubeData = await fetchCubeData(id);
    if (!cubeData) {
      return { success: false, message: `Failed to fetch cube "${id}" from CubeCobra` };
    }

    const eloMap = extractEloMap(cubeData);
    if (eloMap.size === 0) {
      return { success: false, message: "No ELO data found in CubeCobra response" };
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
      message: `CubeCobra ELO: ${totalUpdated} updated, ${totalNotFound} not in cube, ${totalErrors} errors`,
    };
  } catch (error) {
    console.error("Unexpected error in updateAllCubecobraElo:", error);
    return {
      success: false,
      message: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Test CubeCobra ELO lookup for a single card (for testing)
 */
export async function testCubecobraElo(
  cardName: string,
  cubeId?: string
): Promise<{
  success: boolean;
  elo?: number;
  cubeName?: string;
  message?: string;
}> {
  try {
    const id = cubeId || DEFAULT_CUBE_ID;
    const cubeData = await fetchCubeData(id);

    if (!cubeData) {
      return {
        success: false,
        message: `Failed to fetch cube "${id}" from CubeCobra`,
      };
    }

    const eloMap = extractEloMap(cubeData);
    const elo = eloMap.get(cardName.toLowerCase());

    if (elo == null) {
      return {
        success: false,
        message: `Card "${cardName}" not found in cube "${cubeData.name}" (${eloMap.size} cards loaded)`,
      };
    }

    return {
      success: true,
      elo,
      cubeName: cubeData.name,
      message: `Found ${cardName} in "${cubeData.name}" with ELO: ${elo}`,
    };
  } catch (error) {
    console.error("Error testing CubeCobra ELO:", error);
    return {
      success: false,
      message: `Error: ${error}`,
    };
  }
}
