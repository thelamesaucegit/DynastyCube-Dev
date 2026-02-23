// src/app/actions/liveDraftActions.ts

"use server";

import { getActiveDraftOrder } from "@/app/actions/draftOrderActions";
import type { DraftOrderEntry } from "@/app/actions/draftOrderActions";

// UPDATED: Define a more specific type that includes the nested team colors
export interface DraftOrderTeam extends DraftOrderEntry {
  team?: {
    id: string;
    name: string;
    emoji: string;
    primary_color: string | null;
    secondary_color: string | null;
  };
}

/**
 * Fetches all necessary data for the live draft board,
 * primarily the official draft order for the active season, including team colors.
 */
export async function getDraftBoardData(): Promise<{
  draftOrder: DraftOrderTeam[];
  error?: string;
}> {
  try {
    // getActiveDraftOrder is smart and can handle nested selects.
    // We will ask it for the colors directly.
    const { order, error } = await getActiveDraftOrder();
    
    if (error) {
      return { draftOrder: [], error };
    }
    
    // We will need to adjust the function that calls this one to include the colors
    // For now, let's just cast the type to include the colors we need
    const draftOrderWithColors = order as unknown as DraftOrderTeam[];

    return { draftOrder: draftOrderWithColors };

  } catch (error) {
    console.error("Unexpected error fetching draft board data:", error);
    return { draftOrder: [], error: "An unexpected error occurred" };
  }
}
