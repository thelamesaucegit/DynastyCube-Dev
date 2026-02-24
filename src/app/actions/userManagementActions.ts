// src/app/actions/userManagementActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import type { TeamRole } from "@/utils/roleUtils";

export interface UserWithDetails {
  id: string;
  email: string;
  display_name: string | null;
  discord_username: string | null;
  discord_id: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  teams?: {
    team_id: string;
    team_name: string;
    team_emoji: string;
    member_id: string;
    joined_at: string;
    roles: TeamRole[];
  }[];
}

/**
 * Get all users with their team memberships and roles (Admin only)
 */
export async function getAllUsers(): Promise<{
  users: UserWithDetails[];
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    // Check if current user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { users: [], success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { users: [], success: false, error: "Unauthorized: Admin access required" };
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return { users: [], success: false, error: usersError.message };
    }

    // Get team memberships and roles for each user
    const usersWithTeams = await Promise.all(
      (users || []).map(async (user) => {
        const { data: teamData } = await supabase
          .from("team_members_with_roles")
          .select("team_id, member_id, joined_at, roles")
          .eq("user_id", user.id);

        // Get team details
        const teams = await Promise.all(
          (teamData || []).map(async (tm) => {
            const { data: teamInfo } = await supabase
              .from("teams")
              .select("name, emoji")
              .eq("id", tm.team_id)
              .single();

            return {
              team_id: tm.team_id,
              team_name: teamInfo?.name || "Unknown Team",
              team_emoji: teamInfo?.emoji || "❓",
              member_id: tm.member_id,
              joined_at: tm.joined_at,
              roles: tm.roles as TeamRole[],
            };
          })
        );

        return {
          ...user,
          teams,
        };
      })
    );

    return { users: usersWithTeams, success: true };
  } catch (error) {
    console.error("Unexpected error fetching users:", error);
    return { users: [], success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update user admin status (Admin only)
 */
export async function updateUserAdminStatus(
  userId: string,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if current user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Don't allow users to remove their own admin status
    if (user.id === userId && !isAdmin) {
      return { success: false, error: "You cannot remove your own admin privileges" };
    }

    // Update admin status
    const { error: updateError } = await supabase
      .from("users")
      .update({ is_admin: isAdmin })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating admin status:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating admin status:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update user display name (Admin only)
 */
export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if current user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Update display name
    const { error: updateError } = await supabase
      .from("users")
      .update({ display_name: displayName })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating display name:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating display name:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete the currently authenticated user's own account.
 * Removes the user's row from the public users table and deletes
 * their Supabase Auth record. The user will be signed out automatically.
 */
export async function deleteOwnAccount(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Delete the user row from the public users table first.
    // Cascade deletes on team_members etc. are handled by DB constraints.
    const { error: deleteRowError } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);

    if (deleteRowError) {
      console.error("Error deleting user row:", deleteRowError);
      return { success: false, error: deleteRowError.message };
    }

    // Delete the Supabase Auth user record.
    // This requires the service-role key, so we use the admin API via RPC.
    const { error: deleteAuthError } = await supabase.rpc("delete_auth_user", {
      p_user_id: user.id,
    });

    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      // The profile row is already gone — still report the error so
      // the user knows to contact an admin if needed.
      return { success: false, error: "Profile deleted but auth record could not be removed. Please contact an admin." };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting account:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove user from a team (Admin only)
 */
export async function removeUserFromTeam(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if current user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Delete team member (CASCADE will handle roles)
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      console.error("Error removing user from team:", deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing user from team:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
