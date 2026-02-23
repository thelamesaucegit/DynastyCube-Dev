// src/app/actions/liveDraftActions.ts

"use server";

import { getActiveDraftOrder } from "@/app/actions/draftOrderActions";
import type { DraftOrderEntry } from "@/app/actions/draftOrderActions";

/**
 * Fetches all necessary data for the live draft board,
 * primarily the official draft order for the active season.
 */
export async function getDraftBoardData(): Promise<{
  draftOrder: DraftOrderEntry[];
  error?: string;
}> {
  try {
    const { order, error } = await getActiveDraftOrder();
    if (error) {
      return { draftOrder: [], error };
    }
    return { draftOrder: order };
  } catch (error) {
    console.error("Unexpected error fetching draft board data:", error);
    return { draftOrder: [], error: "An unexpected error occurred" };
  }
}
