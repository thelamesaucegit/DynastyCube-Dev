// src/app/actions/adminRoleActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { TeamRole } from "@/utils/roleUtils";

// Create a Supabase client with cookies support
async function createClient() {
  const cookieStore = await cookies();

  // Debug: Log available cookies
  const allCookies = cookieStore.getAll();
  console.log("Available cookies count:", allCookies.length);
  console.log("Cookie names:", allCookies.map(c => c.name));

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = cookieStore.getAll();
          console.log("getAll() called, returning", cookies.length, "cookies");
          return cookies;
        },
        setAll(cookiesToSet) {
          try {
            console.log("setAll() called with", cookiesToSet.length, "cookies");
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            console.error("Error in setAll():", error);
          }
        },
      },
    }
  );
}

export interface TeamWithMembers {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members: TeamMemberWithRoles[];
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

/**
 * Get all teams with their members and roles (Admin only)
 */
export async function getAllTeamsWithRoles(): Promise<{
  teams: TeamWithMembers[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { teams: [], error: "Not authenticated" };
    }

    // Get user's admin status
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { teams: [], error: "Admin access required" };
    }

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return { teams: [], error: teamsError.message };
    }

    // Get all members with roles for all teams
    const { data: membersData, error: membersError } = await supabase
      .from("team_members_with_roles")
      .select("*")
      .order("team_id")
      .order("joined_at");

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return { teams: [], error: membersError.message };
    }

    // Group members by team
    const teamsWithMembers: TeamWithMembers[] = (teams || []).map((team) => ({
      ...team,
      members: (membersData || []).filter((m) => m.team_id === team.id),
    }));

    return { teams: teamsWithMembers };
  } catch (error) {
    console.error("Unexpected error fetching teams with roles:", error);
    return { teams: [], error: "An unexpected error occurred" };
  }
}

/**
 * Assign role to a member (Admin version - works across all teams)
 */
export async function adminAssignRole(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: "Admin access required" };
    }

    // Insert role assignment
    const { error: roleError } = await supabase
      .from("team_member_roles")
      .insert({
        team_member_id: teamMemberId,
        role,
        assigned_by: user.id,
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
      performed_by: user.id,
      notes: notes || "Assigned by admin",
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error assigning role:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove role from a member (Admin version - works across all teams)
 */
export async function adminRemoveRole(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: "Admin access required" };
    }

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
      performed_by: user.id,
      notes: notes || "Removed by admin",
    });

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing role:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check if current user is an admin
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Try getUser first
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // Debug logging
    console.log("checkIsAdmin - user:", user ? "Found" : "Not found");
    console.log("checkIsAdmin - userError:", userError);

    if (!user) {
      // Try getSession as fallback
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("checkIsAdmin - session:", session ? "Found" : "Not found");
      console.log("checkIsAdmin - sessionError:", sessionError);

      if (session?.user) {
        // Use session user
        const { data: profile, error } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error checking admin status:", error);
          return { isAdmin: false, error: error.message };
        }

        return { isAdmin: profile?.is_admin || false };
      }

      return { isAdmin: false, error: "Not authenticated" };
    }

    const { data: profile, error } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error checking admin status:", error);
      return { isAdmin: false, error: error.message };
    }

    return { isAdmin: profile?.is_admin || false };
  } catch (error) {
    console.error("Unexpected error checking admin status:", error);
    return { isAdmin: false, error: "An unexpected error occurred" };
  }
}
