// src/app/actions/cubucksActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// ============================================
// TYPES
// ============================================

export interface CubucksTransaction {
  id: string;
  team_id: string;
  season_id?: string;
  transaction_type: "allocation" | "draft_pick" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  card_id?: string;
  card_name?: string;
  draft_pick_id?: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface Season {
  id: string;
  season_number: number;
  season_name: string;
  start_date: string;
  end_date?: string;
  cubucks_allocation: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamBalance {
  id: string;
  name: string;
  emoji: string;
  cubucks_balance: number;
  cubucks_total_earned: number;
  cubucks_total_spent: number;
}

// ============================================
// SEASON MANAGEMENT
// ============================================

/**
 * Get all seasons
 */
export async function getSeasons(): Promise<{ seasons: Season[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("season_number", { ascending: false });

    if (error) {
      console.error("Error fetching seasons:", error);
      return { seasons: [], error: error.message };
    }

    return { seasons: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching seasons:", error);
    return { seasons: [], error: String(error) };
  }
}

/**
 * Get active season
 */
export async function getActiveSeason(): Promise<{ season: Season | null; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" which is okay
      console.error("Error fetching active season:", error);
      return { season: null, error: error.message };
    }

    return { season: data };
  } catch (error) {
    console.error("Unexpected error fetching active season:", error);
    return { season: null, error: String(error) };
  }
}

/**
 * Create a new season
 */
export async function createSeason(
  seasonNumber: number,
  seasonName: string,
  cubucksAllocation: number
): Promise<{ success: boolean; seasonId?: string; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("seasons")
      .insert({
        season_number: seasonNumber,
        season_name: seasonName,
        start_date: new Date().toISOString(),
        cubucks_allocation: cubucksAllocation,
        is_active: false, // Don't auto-activate
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating season:", error);
      return { success: false, error: error.message };
    }

    return { success: true, seasonId: data.id };
  } catch (error) {
    console.error("Unexpected error creating season:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Activate a season (deactivates others)
 */
export async function activateSeason(
  seasonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Deactivate all seasons
    await supabase.from("seasons").update({ is_active: false }).neq("id", seasonId);

    // Activate the selected season
    const { error } = await supabase
      .from("seasons")
      .update({ is_active: true })
      .eq("id", seasonId);

    if (error) {
      console.error("Error activating season:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error activating season:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// TEAM BALANCES
// ============================================

/**
 * Get all team balances
 */
export async function getTeamBalances(): Promise<{
  teams: TeamBalance[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("teams")
      .select("id, name, emoji, cubucks_balance, cubucks_total_earned, cubucks_total_spent")
      .order("name");

    if (error) {
      console.error("Error fetching team balances:", error);
      return { teams: [], error: error.message };
    }

    return { teams: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team balances:", error);
    return { teams: [], error: String(error) };
  }
}

/**
 * Get single team balance
 */
export async function getTeamBalance(
  teamId: string
): Promise<{ team: TeamBalance | null; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("teams")
      .select("id, name, emoji, cubucks_balance, cubucks_total_earned, cubucks_total_spent")
      .eq("id", teamId)
      .single();

    if (error) {
      console.error("Error fetching team balance:", error);
      return { team: null, error: error.message };
    }

    return { team: data };
  } catch (error) {
    console.error("Unexpected error fetching team balance:", error);
    return { team: null, error: String(error) };
  }
}

// ============================================
// CUBUCKS ALLOCATION
// ============================================

/**
 * Allocate Cubucks to a team
 */
export async function allocateCubucks(
  teamId: string,
  amount: number,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the stored procedure
    const { error } = await supabase.rpc("allocate_cubucks_to_team", {
      p_team_id: teamId,
      p_amount: amount,
      p_season_id: null, // Uses active season
      p_description: description || "Admin allocation",
      p_created_by: user.id,
    });

    if (error) {
      console.error("Error allocating Cubucks:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error allocating Cubucks:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Allocate Cubucks to all teams (season start)
 */
export async function allocateCubucksToAllTeams(
  amount: number
): Promise<{ success: boolean; allocatedCount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name");

    if (teamsError) {
      return { success: false, error: teamsError.message };
    }

    // Allocate to each team
    let allocatedCount = 0;
    for (const team of teams || []) {
      const { error } = await supabase.rpc("allocate_cubucks_to_team", {
        p_team_id: team.id,
        p_amount: amount,
        p_season_id: null,
        p_description: "Season allocation",
        p_created_by: user.id,
      });

      if (error) {
        console.error(`Error allocating to team ${team.name}:`, error);
      } else {
        allocatedCount++;
      }
    }

    return { success: true, allocatedCount };
  } catch (error) {
    console.error("Unexpected error allocating Cubucks to all teams:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// CARD COSTS
// ============================================

/**
 * Set cost for a card
 */
export async function setCardCost(
  cardId: string,
  cost: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("card_pools")
      .update({ cubucks_cost: cost })
      .eq("id", cardId);

    if (error) {
      console.error("Error setting card cost:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error setting card cost:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Set costs for multiple cards
 */
export async function setBulkCardCosts(
  cards: Array<{ id: string; cost: number }>
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    let updatedCount = 0;
    for (const card of cards) {
      const { error } = await supabase
        .from("card_pools")
        .update({ cubucks_cost: card.cost })
        .eq("id", card.id);

      if (error) {
        console.error(`Error setting cost for card ${card.id}:`, error);
      } else {
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error("Unexpected error setting bulk card costs:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// TRANSACTIONS
// ============================================

/**
 * Get transactions for a team
 */
export async function getTeamTransactions(
  teamId: string
): Promise<{ transactions: CubucksTransaction[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("cubucks_transactions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team transactions:", error);
      return { transactions: [], error: error.message };
    }

    return { transactions: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team transactions:", error);
    return { transactions: [], error: String(error) };
  }
}

/**
 * Get all transactions (admin)
 */
export async function getAllTransactions(): Promise<{
  transactions: CubucksTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("cubucks_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching all transactions:", error);
      return { transactions: [], error: error.message };
    }

    return { transactions: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching all transactions:", error);
    return { transactions: [], error: String(error) };
  }
}

// ============================================
// DRAFT ACTIONS
// ============================================

/**
 * Refund Cubucks when undrafting a card
 * This reverses the draft transaction and removes the draft pick
 */
export async function refundDraftPick(
  teamId: string,
  draftPickId: string,
  cardId: string,
  cardName: string
): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Find the original draft transaction to get the cost
    const { data: originalTransaction, error: txError } = await supabase
      .from("cubucks_transactions")
      .select("*")
      .eq("team_id", teamId)
      .eq("card_id", cardId)
      .eq("transaction_type", "draft_pick")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (txError || !originalTransaction) {
      console.error("Error finding original transaction:", txError);
      // If we can't find the transaction, try to get cost from card pool
      const { data: cardPool } = await supabase
        .from("card_pools")
        .select("cubucks_cost")
        .eq("card_id", cardId)
        .single();

      // Default to 1 if we can't find the cost
      const refundAmount = cardPool?.cubucks_cost || 1;

      // Proceed with refund using the card pool cost
      return await processRefund(supabase, teamId, draftPickId, cardId, cardName, refundAmount, user.id);
    }

    // The original transaction amount is negative (spent), so we refund the absolute value
    const refundAmount = Math.abs(originalTransaction.amount);

    return await processRefund(supabase, teamId, draftPickId, cardId, cardName, refundAmount, user.id);
  } catch (error) {
    console.error("Unexpected error refunding draft pick:", error);
    return { success: false, error: String(error) };
  }
}

// Helper function to process the refund
async function processRefund(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  teamId: string,
  draftPickId: string,
  cardId: string,
  cardName: string,
  refundAmount: number,
  userId: string
): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
  // Get current team balance
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("cubucks_balance, cubucks_total_spent")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return { success: false, error: "Failed to fetch team balance" };
  }

  const newBalance = team.cubucks_balance + refundAmount;
  const newTotalSpent = Math.max(0, team.cubucks_total_spent - refundAmount);

  // Update team balance
  const { error: updateError } = await supabase
    .from("teams")
    .update({
      cubucks_balance: newBalance,
      cubucks_total_spent: newTotalSpent,
    })
    .eq("id", teamId);

  if (updateError) {
    console.error("Error updating team balance:", updateError);
    return { success: false, error: "Failed to update team balance" };
  }

  // Get active season for the transaction
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  // Create refund transaction record
  const { error: txInsertError } = await supabase
    .from("cubucks_transactions")
    .insert({
      team_id: teamId,
      season_id: activeSeason?.id || null,
      transaction_type: "refund",
      amount: refundAmount, // Positive amount for refund
      balance_after: newBalance,
      card_id: cardId,
      card_name: cardName,
      draft_pick_id: draftPickId,
      description: `Refund for undrafting ${cardName}`,
      created_by: userId,
    });

  if (txInsertError) {
    console.error("Error creating refund transaction:", txInsertError);
    // Don't fail the whole operation if just the transaction log fails
  }

  // Delete the draft pick
  const { error: deleteError } = await supabase
    .from("team_draft_picks")
    .delete()
    .eq("id", draftPickId);

  if (deleteError) {
    console.error("Error deleting draft pick:", deleteError);
    return { success: false, error: "Failed to remove draft pick" };
  }

  return { success: true, refundAmount };
}

/**
 * Spend Cubucks on a draft pick
 */
export async function spendCubucksOnDraft(
  teamId: string,
  cardId: string,
  cardName: string,
  cost: number,
  cardPoolId?: string,
  draftPickId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the stored procedure
    const { error } = await supabase.rpc("spend_cubucks_on_draft", {
      p_team_id: teamId,
      p_amount: cost,
      p_card_id: cardId,
      p_card_name: cardName,
      p_draft_pick_id: draftPickId || null,
      p_season_id: null, // Uses active season
      p_card_pool_id: cardPoolId || null, // For tracking drafted cards
    });

    if (error) {
      console.error("Error spending Cubucks:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error spending Cubucks:", error);
    return { success: false, error: String(error) };
  }
}
