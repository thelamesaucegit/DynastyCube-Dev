// src/app/actions/roleActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { TeamRole } from "@/utils/roleUtils";

// Note: Import TeamRole from @/utils/roleUtils in client components

// Create a Supabase client with cookies support
async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}

export interface TeamMemberWithRoles {
  member_id: string;
  user_id: string;
  user_email: string;
  user_display_name?: string;
  team_id: string;
  joined_at: string;
  roles: TeamRole[];
  role_assigned_dates: string[];
}

export interface RoleHistoryEntry {
  id: string;
  team_member_id: string;
  role: TeamRole;
  action: "assigned" | "removed";
  performed_by: string;
  performed_at: string;
  notes?: string;
}

/**
 * Get all team members with their roles
 */
export async function getTeamMembersWithRoles(
  teamId: string
): Promise<{ members: TeamMemberWithRoles[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_members_with_roles")
      .select("*")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error fetching team members with roles:", error);
      return { members: [], error: error.message };
    }

    return { members: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team members with roles:", error);
    return { members: [], error: "An unexpected error occurred" };
  }
}

/**
 * Assign a role to a team member
 */
export async function assignRoleToMember(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();

    // Insert role assignment
    const { error: roleError } = await supabase
      .from("team_member_roles")
      .insert({
        team_member_id: teamMemberId,
        role,
        assigned_by: user?.id || null,
      });

    if (roleError) {
      // Check if role already exists
      if (roleError.code === "23505") {
        return { success: false, error: "Member already has this role" };
      }
      console.error("Error assigning role:", roleError);
      return { success: false, error: roleError.message };
    }

    // Log the role assignment in history
    await supabase.from("team_role_history").insert({
      team_member_id: teamMemberId,
      role,
      action: "assigned",
      performed_by: user?.id || null,
      notes,
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error assigning role:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove a role from a team member
 */
export async function removeRoleFromMember(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();

    // Remove role assignment
    const { error: roleError } = await supabase
      .from("team_member_roles")
      .delete()
      .eq("team_member_id", teamMemberId)
      .eq("role", role);

    if (roleError) {
      console.error("Error removing role:", roleError);
      return { success: false, error: roleError.message };
    }

    // Log the role removal in history
    await supabase.from("team_role_history").insert({
      team_member_id: teamMemberId,
      role,
      action: "removed",
      performed_by: user?.id || null,
      notes,
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing role:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check if a user has a specific role on a team
 */
export async function userHasTeamRole(
  userId: string,
  teamId: string,
  role: TeamRole
): Promise<{ hasRole: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("user_has_team_role", {
      p_user_id: userId,
      p_team_id: teamId,
      p_role: role,
    });

    if (error) {
      console.error("Error checking user role:", error);
      return { hasRole: false, error: error.message };
    }

    return { hasRole: data || false };
  } catch (error) {
    console.error("Unexpected error checking user role:", error);
    return { hasRole: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get all roles for a user on a team
 */
export async function getUserTeamRoles(
  userId: string,
  teamId: string
): Promise<{ roles: TeamRole[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("get_user_team_roles", {
      p_user_id: userId,
      p_team_id: teamId,
    });

    if (error) {
      console.error("Error getting user team roles:", error);
      return { roles: [], error: error.message };
    }

    return { roles: data || [] };
  } catch (error) {
    console.error("Unexpected error getting user team roles:", error);
    return { roles: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get role change history for a team
 */
export async function getTeamRoleHistory(
  teamId: string,
  limit: number = 50
): Promise<{ history: RoleHistoryEntry[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_role_history")
      .select(`
        *,
        team_members!inner (
          team_id,
          user_email
        )
      `)
      .eq("team_members.team_id", teamId)
      .order("performed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching role history:", error);
      return { history: [], error: error.message };
    }

    return { history: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching role history:", error);
    return { history: [], error: "An unexpected error occurred" };
  }
}

/**
 * Bulk assign multiple roles to a team member
 */
export async function assignMultipleRoles(
  teamMemberId: string,
  roles: TeamRole[],
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();

    // Insert all role assignments
    const roleAssignments = roles.map((role) => ({
      team_member_id: teamMemberId,
      role,
      assigned_by: user?.id || null,
    }));

    const { error: roleError } = await supabase
      .from("team_member_roles")
      .insert(roleAssignments);

    if (roleError) {
      console.error("Error assigning multiple roles:", roleError);
      return { success: false, error: roleError.message };
    }

    // Log all assignments in history
    const historyEntries = roles.map((role) => ({
      team_member_id: teamMemberId,
      role,
      action: "assigned" as const,
      performed_by: user?.id || null,
      notes,
    }));

    await supabase.from("team_role_history").insert(historyEntries);

    return { success: true };
  } catch (error) {
    console.error("Unexpected error assigning multiple roles:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get current user's roles for a specific team
 * Uses the team_members_with_roles view for consistency with TeamRoles component
 */
export async function getCurrentUserRolesForTeam(
  teamId: string
): Promise<{ roles: TeamRole[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log("[getCurrentUserRolesForTeam] User ID:", user?.id);
    console.log("[getCurrentUserRolesForTeam] Team ID:", teamId);

    if (authError || !user) {
      console.log("[getCurrentUserRolesForTeam] Auth error or no user:", authError);
      return { roles: [], error: "Not authenticated" };
    }

    // Use the team_members_with_roles view (same as TeamRoles component)
    const { data, error } = await supabase
      .from("team_members_with_roles")
      .select("roles")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .single();

    console.log("[getCurrentUserRolesForTeam] View data:", data);
    console.log("[getCurrentUserRolesForTeam] View error:", error);

    if (error) {
      // If no record found (PGRST116), user is not a member
      if (error.code === "PGRST116") {
        console.log("[getCurrentUserRolesForTeam] User is not a member of this team");
        return { roles: [] };
      }
      console.error("Error fetching user roles:", error);
      return { roles: [], error: error.message };
    }

    const roles = (data?.roles || []) as TeamRole[];
    console.log("[getCurrentUserRolesForTeam] Final roles:", roles);
    return { roles };
  } catch (error) {
    console.error("Unexpected error fetching user roles:", error);
    return { roles: [], error: "An unexpected error occurred" };
  }
}

// Helper functions moved to @/utils/roleUtils
// Import them from there if needed:
// import { getRoleDescription, getRoleEmoji, getRoleDisplayName } from "@/utils/roleUtils";
