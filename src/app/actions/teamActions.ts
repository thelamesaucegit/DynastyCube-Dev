// src/app/actions/teamActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  user_email: string;
  user_display_name?: string; // Add display name field
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members?: TeamMember[];
}

/**
 * Fetch all teams with their members
 */
export async function getTeamsWithMembers(): Promise<Team[]> {
  const supabase = await createClient();

  try {
    // Fetch all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return [];
    }

    // Fetch all team members
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("*");

    if (membersError) {
      console.error("Error fetching team members:", membersError);
      return teams || [];
    }

    // Fetch all users to get display names
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, display_name, discord_username");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      // Continue without display names if users query fails
    }

    // Create a map of user_id -> display_name for quick lookup
    const userDisplayNames = new Map(
      (users || []).map((u) => [
        u.id,
        u.display_name || u.discord_username || "Unknown User"
      ])
    );

    // Combine teams with their members, adding display names
    const teamsWithMembers = (teams || []).map((team) => ({
      ...team,
      members: (members || [])
        .filter((member) => member.team_id === team.id)
        .map((member) => ({
          ...member,
          user_display_name: userDisplayNames.get(member.user_id) || "Unknown User",
        })),
    }));

    return teamsWithMembers;
  } catch (error) {
    console.error("Unexpected error fetching teams:", error);
    return [];
  }
}

/**
 * Add a user to a team
 */
export async function addMemberToTeam(
  teamId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get user for audit purposes (non-blocking)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insert team member
    const { error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_email: userEmail.toLowerCase(),
        user_id: user?.id || null, // Optional: for audit trail
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate entry error
      if (error.code === "23505") {
        return { success: false, error: "User already in this team" };
      }
      console.error("Error adding member to team:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding member:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove a user from a team
 */
export async function removeMemberFromTeam(
  teamId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_email", userEmail.toLowerCase());

    if (error) {
      console.error("Error removing member from team:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing member:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get members of a specific team
 */
export async function getTeamMembers(
  teamId: string
): Promise<{ members: TeamMember[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error fetching team members:", error);
      return { members: [], error: error.message };
    }

    return { members: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching team members:", error);
    return { members: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get the team for a specific user by email
 */
export async function getUserTeam(
  userEmail: string
): Promise<{ team: Team | null; error?: string }> {
  const supabase = await createClient();

  try {
    // Get the team membership for this email
    const { data: membership, error: memberError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_email", userEmail.toLowerCase())
      .single();

    if (memberError) {
      // User not in any team (expected case)
      if (memberError.code === "PGRST116") {
        return { team: null };
      }
      console.error("Error fetching user team:", memberError);
      return { team: null, error: memberError.message };
    }

    if (!membership) {
      return { team: null };
    }

    // Get the team details
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", membership.team_id)
      .single();

    if (teamError) {
      console.error("Error fetching team details:", teamError);
      return { team: null, error: teamError.message };
    }

    return { team: team || null };
  } catch (error) {
    console.error("Unexpected error fetching user team:", error);
    return { team: null, error: "An unexpected error occurred" };
  }
}

/**
 * Join a team (for user self-registration)
 */
export async function joinTeam(
  teamId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    if (!userEmail) {
      return { success: false, error: "User email not provided" };
    }

    // Check if already in a team
    const { data: existing } = await supabase
      .from("team_members")
      .select("id")
      .eq("user_email", userEmail.toLowerCase())
      .single();

    if (existing) {
      return { success: false, error: "You are already in a team" };
    }

    // Get user ID for audit trail (optional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Add to team
    const { error } = await supabase.from("team_members").insert({
      team_id: teamId,
      user_email: userEmail.toLowerCase(),
      user_id: user?.id || null,
    });

    if (error) {
      console.error("Error joining team:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error joining team:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get all teams without members
 */
export async function getAllTeams(): Promise<{
  teams: Team[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, emoji, motto")
      .order("name");

    if (error) {
      console.error("Error fetching teams:", error);
      return { teams: [], error: error.message };
    }

    return { teams: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching teams:", error);
    return { teams: [], error: "An unexpected error occurred" };
  }
}
