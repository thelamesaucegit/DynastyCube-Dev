// src/app/actions/liveDraftActions.ts

"use server";

import { createServerClient } from "@/lib/supabase"; 
import { getDraftOrder } from "@/app/actions/draftOrderActions";
import type { DraftOrderEntry } from "@/app/actions/draftOrderActions";

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
    const supabase = await createServerClient();

    // STEP 1: Find the season_id associated with the current draft session.
    const { data: sessionData, error: sessionError } = await supabase
      .from("draft_sessions")
      .select("season_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Could not find season for draft session:", sessionId, sessionError);
      return { draftOrder: [], error: "Could not find a season for this draft session." };
    }

    const { season_id } = sessionData;

    // STEP 2: Use the correct season_id to fetch the draft order.
    const { order, error: orderError } = await getDraftOrder(season_id);

    if (orderError) {
      return { draftOrder: [], error: orderError };
    }
    
    const draftOrderWithColors = order as DraftOrderTeam[];
    return { draftOrder: draftOrderWithColors };

  } catch (error) {
    console.error("Unexpected error fetching draft board data:", error);
    return { draftOrder: [], error: "An unexpected error occurred" };
  }
}
