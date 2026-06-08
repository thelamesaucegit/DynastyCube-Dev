// src/app/actions/essenceActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

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

export interface EssenceData {
    teamBank: number;
    personalBalance: number;
    canClaim: boolean;
    timeUntilNextClaim: string | null;
}

// ============================================================================
// DAILY CLAIMS (META ECONOMY)
// ============================================================================

export async function getEssenceData(teamId: string): Promise<{ success: boolean; data?: EssenceData; error?: string }> {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Get Team Bank
        const { data: teamData } = await supabase
            .from('teams')
            .select('essence_bank')
            .eq('id', teamId)
            .single();

        if (!user) {
            return { 
                success: true, 
                data: { teamBank: teamData?.essence_bank || 0, personalBalance: 0, canClaim: false, timeUntilNextClaim: null } 
            };
        }

        // Get User Balance and Claim Timer
        const { data: userData } = await supabase
            .from('users')
            .select('essence_balance, last_essence_claim')
            .eq('id', user.id)
            .single();

        let canClaim = true;
        let timeUntilNextClaim = null;

        if (userData?.last_essence_claim) {
            const lastClaim = new Date(userData.last_essence_claim).getTime();
            const now = Date.now();
            const hoursSinceClaim = (now - lastClaim) / (1000 * 60 * 60);

            // 20-hour rolling cooldown gives players a flexible daily window
            if (hoursSinceClaim < 20) {
                canClaim = false;
                const hoursLeft = Math.ceil(20 - hoursSinceClaim);
                timeUntilNextClaim = `${hoursLeft}h`;
            }
        }

        return {
            success: true,
            data: {
                teamBank: teamData?.essence_bank || 0,
                personalBalance: userData?.essence_balance || 0,
                canClaim,
                timeUntilNextClaim
            }
        };
    } catch (error) {
        return { success: false, error: "Failed to fetch Essence data." };
    }
}

export async function claimDailyEssence(teamId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: "Not authenticated" };

        // 1. Verify Membership
        const { data: memberData } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .single();

        if (!memberData) return { success: false, error: "You must be a member of this team to claim Essence." };

        // 2. Fetch Current States (Including essence_total_earned)
        const { data: userData } = await supabase
            .from('users')
            .select('essence_balance, essence_total_earned, last_essence_claim')
            .eq('id', user.id)
            .single();
            
        const { data: teamData } = await supabase
            .from('teams')
            .select('essence_bank')
            .eq('id', teamId)
            .single();

        if (!userData || !teamData) return { success: false, error: "Failed to fetch necessary data." };

        // 3. Verify Cooldown
        if (userData.last_essence_claim) {
            const hoursSinceClaim = (Date.now() - new Date(userData.last_essence_claim).getTime()) / (1000 * 60 * 60);
            if (hoursSinceClaim < 20) return { success: false, error: "You have already claimed your Essence recently." };
        }

        // 4. Calculate Claims
        let personalGained = 1;
        let teamBankCost = 0;

        if (teamData.essence_bank > 0) {
            personalGained = 2; // Base + 1 from Team Bank
            teamBankCost = 1;
        }

        // 5. Execute Transactions
        const newPersonalBalance = (userData.essence_balance || 0) + personalGained;
        const newTotalEarned = (userData.essence_total_earned || 0) + personalGained;
        const newTeamBank = teamData.essence_bank - teamBankCost;

        // Update User
        await supabase.from('users').update({ 
            essence_balance: newPersonalBalance, 
            essence_total_earned: newTotalEarned,
            last_essence_claim: new Date().toISOString() 
        }).eq('id', user.id);

        // Update Team Bank
        if (teamBankCost > 0) {
            await supabase.from('teams').update({ essence_bank: newTeamBank }).eq('id', teamId);
        }

        // Insert Transaction Record so it shows up in their history!
        await supabase.from('essence_transactions').insert({
            user_id: user.id,
            transaction_type: "grant",
            amount: personalGained,
            balance_after: newPersonalBalance,
            description: teamBankCost > 0 ? "Daily Essence Claim (+1 Base, +1 Team Bonus)" : "Daily Essence Claim (+1 Base)",
            created_by: user.id
        });

        await logSystemEvent("EssenceClaim", "info", `User ${user.id} claimed ${personalGained} Essence. Team Bank changed by -${teamBankCost}.`);

        return { 
            success: true, 
            message: teamBankCost > 0 
                ? "You claimed 1 Base Essence + 1 Bonus Essence from the Team Bank! ✨" 
                : "You claimed 1 Base Essence! ✨ (The Team Bank is empty)" 
        };

    } catch (error) {
        return { success: false, error: "An unexpected error occurred." };
    }
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
