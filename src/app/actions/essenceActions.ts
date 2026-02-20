// src/app/actions/essenceActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export interface EssenceBalance {
  user_id: string;
  display_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  essence_balance: number;
  essence_total_earned: number;
  essence_total_spent: number;
}

export interface EssenceTransaction {
  id: string;
  user_id: string;
  transaction_type: "grant" | "spend" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================================
// BALANCE QUERIES
// ============================================================================

/**
 * Get all users with their Essence balances (Admin use)
 */
export async function getAllUserEssenceBalances(): Promise<{
  users: EssenceBalance[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("users")
      .select(
        "id, display_name, discord_username, avatar_url, essence_balance, essence_total_earned, essence_total_spent"
      )
      .order("display_name");

    if (error) {
      console.error("Error fetching user essence balances:", error);
      return { users: [], error: error.message };
    }

    const users: EssenceBalance[] = (data || []).map(
      (u: {
        id: string;
        display_name: string | null;
        discord_username: string | null;
        avatar_url: string | null;
        essence_balance: number;
        essence_total_earned: number;
        essence_total_spent: number;
      }) => ({
        user_id: u.id,
        display_name: u.display_name,
        discord_username: u.discord_username,
        avatar_url: u.avatar_url,
        essence_balance: u.essence_balance ?? 0,
        essence_total_earned: u.essence_total_earned ?? 0,
        essence_total_spent: u.essence_total_spent ?? 0,
      })
    );

    return { users };
  } catch (error) {
    console.error("Unexpected error fetching essence balances:", error);
    return { users: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get the current authenticated user's Essence balance
 */
export async function getUserEssenceBalance(): Promise<{
  balance: EssenceBalance | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { balance: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("users")
      .select(
        "id, display_name, discord_username, avatar_url, essence_balance, essence_total_earned, essence_total_spent"
      )
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user essence balance:", error);
      return { balance: null, error: error.message };
    }

    return {
      balance: {
        user_id: data.id,
        display_name: data.display_name,
        discord_username: data.discord_username,
        avatar_url: data.avatar_url,
        essence_balance: data.essence_balance ?? 0,
        essence_total_earned: data.essence_total_earned ?? 0,
        essence_total_spent: data.essence_total_spent ?? 0,
      },
    };
  } catch (error) {
    console.error("Unexpected error fetching essence balance:", error);
    return { balance: null, error: "An unexpected error occurred" };
  }
}

// ============================================================================
// GRANTING ESSENCE
// ============================================================================

/**
 * Grant Essence to a single user (Admin only)
 */
export async function grantEssence(
  userId: string,
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

    // Check admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Call the stored procedure
    const { error } = await supabase.rpc("grant_essence_to_user", {
      p_user_id: userId,
      p_amount: amount,
      p_description: description || "Admin grant",
      p_created_by: user.id,
    });

    if (error) {
      console.error("Error granting Essence:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error granting Essence:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Grant Essence to all users (Admin only)
 */
export async function grantEssenceToAllUsers(
  amount: number,
  description?: string
): Promise<{ success: boolean; grantedCount?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, display_name");

    if (usersError) {
      return { success: false, error: usersError.message };
    }

    // Grant to each user
    let grantedCount = 0;
    for (const u of users || []) {
      const { error } = await supabase.rpc("grant_essence_to_user", {
        p_user_id: u.id,
        p_amount: amount,
        p_description: description || "Bulk grant",
        p_created_by: user.id,
      });

      if (error) {
        console.error(
          `Error granting Essence to ${u.display_name || u.id}:`,
          error
        );
      } else {
        grantedCount++;
      }
    }

    return { success: true, grantedCount };
  } catch (error) {
    console.error("Unexpected error granting Essence to all users:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Grant Essence to all members of a specific team (Admin only)
 */
export async function grantEssenceToTeamMembers(
  teamId: string,
  amount: number,
  description?: string
): Promise<{ success: boolean; grantedCount?: number; totalMembers?: number; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    if (amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    // Get all members of the specified team
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .not("user_id", "is", null);

    if (membersError) {
      return { success: false, error: membersError.message };
    }

    if (!members || members.length === 0) {
      return { success: false, error: "No members found in this team" };
    }

    // Grant to each team member
    let grantedCount = 0;
    for (const member of members) {
      const { error } = await supabase.rpc("grant_essence_to_user", {
        p_user_id: member.user_id,
        p_amount: amount,
        p_description: description || "Team grant",
        p_created_by: user.id,
      });

      if (error) {
        console.error(
          `Error granting Essence to team member ${member.user_id}:`,
          error
        );
      } else {
        grantedCount++;
      }
    }

    return { success: true, grantedCount, totalMembers: members.length };
  } catch (error) {
    console.error("Unexpected error granting Essence to team members:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * Get all Essence transactions (Admin use)
 */
export async function getAllEssenceTransactions(): Promise<{
  transactions: EssenceTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("essence_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching all essence transactions:", error);
      return { transactions: [], error: error.message };
    }

    return { transactions: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching essence transactions:", error);
    return { transactions: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get the current user's Essence transaction history
 */
export async function getUserEssenceTransactions(): Promise<{
  transactions: EssenceTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { transactions: [], error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("essence_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching user essence transactions:", error);
      return { transactions: [], error: error.message };
    }

    return { transactions: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching user transactions:", error);
    return { transactions: [], error: "An unexpected error occurred" };
  }
}
