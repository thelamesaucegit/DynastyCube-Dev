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
// AUTHENTICATION HELPERS
// ============================================

/**
 * Verify that the current user is authenticated and is a member of the specified team
 */
async function verifyTeamMembership(
  teamId: string
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const supabase = await createServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "You must be logged in to perform this action" };
  }

  // Check team membership
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return { authorized: false, userId: user.id, error: "You must be a member of this team to perform this action" };
  }

  return { authorized: true, userId: user.id };
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
 * Allocate Cubucks to a team (respects season cap)
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

    // Get active season cap
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("cubucks_allocation")
      .eq("is_active", true)
      .single();

    const cap = activeSeason?.cubucks_allocation ?? null;

    // Get current team balance to check cap
    if (cap !== null) {
      const { data: team } = await supabase
        .from("teams")
        .select("cubucks_balance")
        .eq("id", teamId)
        .single();

      if (team) {
        const newBalance = team.cubucks_balance + amount;
        if (newBalance > cap) {
          const maxAllowable = cap - team.cubucks_balance;
          if (maxAllowable <= 0) {
            return {
              success: false,
              error: `Team is already at or above the season cap of ${cap} Cubucks (current balance: ${team.cubucks_balance})`,
            };
          }
          return {
            success: false,
            error: `Allocation would exceed the season cap of ${cap} Cubucks. Current balance: ${team.cubucks_balance}, max you can add: ${maxAllowable}`,
          };
        }
      }
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
 * Allocate Cubucks to all teams (season start) — respects season cap
 */
export async function allocateCubucksToAllTeams(
  amount: number
): Promise<{ success: boolean; allocatedCount?: number; skippedCount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get active season cap
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("cubucks_allocation")
      .eq("is_active", true)
      .single();

    const cap = activeSeason?.cubucks_allocation ?? null;

    // Get all teams with current balance
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, cubucks_balance");

    if (teamsError) {
      return { success: false, error: teamsError.message };
    }

    // Allocate to each team (clamped to cap)
    let allocatedCount = 0;
    let skippedCount = 0;
    for (const team of teams || []) {
      // Calculate how much we can actually give this team
      let effectiveAmount = amount;
      if (cap !== null) {
        const headroom = cap - team.cubucks_balance;
        if (headroom <= 0) {
          skippedCount++;
          continue; // Already at or above cap
        }
        effectiveAmount = Math.min(amount, headroom);
      }

      const { error } = await supabase.rpc("allocate_cubucks_to_team", {
        p_team_id: team.id,
        p_amount: effectiveAmount,
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

    return { success: true, allocatedCount, skippedCount };
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

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    // Find the original draft transaction to get the cost
    const { data: originalTransaction, error: txError } = await supabase
      .from("cubucks_transactions")
      .select("*")
      .eq("team_id", teamId)
      .eq("draft_pick_id", draftPickId)
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
      return await processRefund(supabase, teamId, draftPickId, cardId, cardName, refundAmount, authCheck.userId!);
    }

    // The original transaction amount is negative (spent), so we refund the absolute value
    const refundAmount = Math.abs(originalTransaction.amount);

    return await processRefund(supabase, teamId, draftPickId, cardId, cardName, refundAmount, authCheck.userId!);
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
  draftPickId?: string,
  isManualPick?: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
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

/**
 * Internal: Spend Cubucks on an auto-draft pick without user session check.
 * Only for use by server-side auto-draft logic.
 */
export async function spendCubucksOnDraftInternal(
  teamId: string,
  cardId: string,
  cardName: string,
  cost: number,
  cardPoolId?: string,
  draftPickId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Call the stored procedure directly — no user session required
    const { error } = await supabase.rpc("spend_cubucks_on_draft", {
      p_team_id: teamId,
      p_amount: cost,
      p_card_id: cardId,
      p_card_name: cardName,
      p_draft_pick_id: draftPickId || null,
      p_season_id: null,
      p_card_pool_id: cardPoolId || null,
    });

    if (error) {
      console.error("Error spending Cubucks (auto-draft):", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error spending Cubucks (auto-draft):", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// SEASON ALLOCATION & CAP MANAGEMENT
// ============================================

/**
 * Update the cubucks_allocation for a season
 */
export async function updateSeasonAllocation(
  seasonId: string,
  newAllocation: number
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

    if (newAllocation < 0) {
      return { success: false, error: "Allocation must be a positive number" };
    }

    const { error } = await supabase
      .from("seasons")
      .update({ cubucks_allocation: newAllocation, updated_at: new Date().toISOString() })
      .eq("id", seasonId);

    if (error) {
      console.error("Error updating season allocation:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating season allocation:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Reset all team cubucks balances to the season cap.
 * Any team above the cap gets set to the cap.
 * Any team below the cap stays unchanged (they spent cubucks legitimately).
 * Pass resetAll=true to set ALL teams to exactly the cap value.
 */
export async function resetTeamBalancesToCap(
  resetAll: boolean = false
): Promise<{ success: boolean; resetCount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get active season cap
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id, cubucks_allocation")
      .eq("is_active", true)
      .single();

    if (!activeSeason) {
      return { success: false, error: "No active season found" };
    }

    const cap = activeSeason.cubucks_allocation;

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, cubucks_balance, cubucks_total_earned, cubucks_total_spent");

    if (teamsError || !teams) {
      return { success: false, error: teamsError?.message || "Failed to fetch teams" };
    }

    let resetCount = 0;
    for (const team of teams) {
      const shouldReset = resetAll || team.cubucks_balance > cap;
      if (!shouldReset) continue;

      const oldBalance = team.cubucks_balance;
      const newBalance = cap;
      const adjustment = newBalance - oldBalance;

      // Update the team's balance
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          cubucks_balance: newBalance,
          // Also reset total_earned to match so the math stays consistent
          cubucks_total_earned: newBalance + team.cubucks_total_spent,
        })
        .eq("id", team.id);

      if (updateError) {
        console.error(`Error resetting team ${team.name}:`, updateError);
        continue;
      }

      // Log the adjustment as a transaction
      await supabase.from("cubucks_transactions").insert({
        team_id: team.id,
        season_id: activeSeason.id,
        transaction_type: "adjustment",
        amount: adjustment,
        balance_after: newBalance,
        description: `Balance reset to season cap (${cap}). Was ${oldBalance}.`,
        created_by: user.id,
      });

      resetCount++;
    }

    return { success: true, resetCount };
  } catch (error) {
    console.error("Unexpected error resetting team balances:", error);
    return { success: false, error: String(error) };
  }
}
