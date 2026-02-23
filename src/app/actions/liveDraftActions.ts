// src/app/actions/liveDraftActions.ts

"use server";

import { getDraftOrder } from "@/app/actions/draftOrderActions";
import type { DraftOrderEntry } from "@/app/actions/draftOrderActions";

// This interface is correct and defines the shape our component needs.
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
 * Fetches the official draft order for a given draft session,
 * including team colors for the UI.
 */
export async function getDraftBoardData(sessionId: string): Promise<{
  draftOrder: DraftOrderTeam[];
  error?: string;
}> {
  try {
    // UPDATED: We now call getDraftOrder and pass the specific sessionId.
    // This is more precise than relying on getActiveDraftOrder().
    const { order, error } = await getDraftOrder(sessionId);

    if (error) {
      return { draftOrder: [], error };
    }
    
    // Because we updated getDraftOrder to select the colors,
    // we can safely cast the result without using 'unknown'.
    const draftOrderWithColors = order as DraftOrderTeam[];

    return { draftOrder: draftOrderWithColors };

  } catch (error) {
    console.error("Unexpected error fetching draft board data:", error);
    return { draftOrder: [], error: "An unexpected error occurred" };
  }
}
