// src/app/actions/teamActions.ts
"use server";

import { type AnySupabaseClient } from "@/lib/supabase";
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
           
          }
        },
      },
    }
  );
}

// 1. Define the exact shape returned by the RPC
export interface RpcTeamStatRow {
    id: string;
    name: string;
    emoji: string;
    motto: string;
    short_name: string;
    primary_color: string | null;
    secondary_color: string | null;
    member_count: number;
    rival_short_name: string | null;
    is_hidden: boolean;
    is_escaped: boolean; // <-- ADDED THIS
    wins: number;
    losses: number;
    game_wins: number;
    game_losses: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  user_email: string;
  user_display_name?: string;
  joined_at: string;
}

export interface Team {
  id: string;         
  short_name: string; 
  name: string;
  emoji: string;
  motto: string;
  is_hidden?: boolean;
  is_escaped?: boolean; // <-- ADDED THIS
  members?: TeamMember[];
}

export interface UserForDropdown {
  id: string;
  display_name: string;
  discord_username?: string;
  email?: string;
}

export interface TeamRecordData {
    wins: number;
    losses: number;
    game_wins: number;
    game_losses: number;
}

export interface TeamWithDetails {
  id: string;
  short_name: string;
  name: string;
  emoji: string;
  motto: string;
  wins: number;
  losses: number;
  game_wins: number;
  game_losses: number;
  rival_short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  member_count: number;
  is_hidden?: boolean;
  is_escaped: boolean; // <-- ADDED THIS
  last_pick: {
    image_url: string | null;
    card_name: string;
  } | null;
}

interface RawTeamResponse {
    id: string;
    name: string;
    emoji: string;
    motto: string;
    short_name: string;
    primary_color: string | null;
    secondary_color: string | null;
    member_count: number;
    rival_short_name: string | null;
    is_hidden: boolean;
    is_escaped: boolean; // <-- ADDED THIS
    team_records_view: TeamRecordData | TeamRecordData[] | null;
}

/**
 * Get all users for dropdown selection (Admin only)
 */
export async function getUsersForDropdown(): Promise<{
  users: UserForDropdown[];
  error?: string;
}> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, display_name, discord_username")
      .order("display_name");

    if (error) {
      console.error("Error fetching users for dropdown:", error);
      return { users: [], error: error.message };
    }

    return {
      users: (data || []).map((u) => ({
        id: u.id,
        display_name: u.display_name || u.discord_username || "Unknown User",
        discord_username: u.discord_username,
      })),
    };
  } catch (error) {
    console.error("Unexpected error fetching users:", error);
    return { users: [], error: "An unexpected error occurred" };
  }
}

/**
 * Resolve a team short_name (URL slug) to the full team object including UUID.
 */
export async function getTeamByShortName(
  shortName: string
): Promise<{ team: Team | null; error?: string }> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("short_name", shortName)
      .single();

    if (error) {
      if (error.code === "PGRST116") return { team: null };
      return { team: null, error: error.message };
    }

    return { team: data };
  } catch (error) {
    console.error("Unexpected error fetching team by short_name:", error);
    return { team: null, error: "An unexpected error occurred" };
  }
}

/**
 * Fetch all teams with their members
 */
export async function getTeamsWithMembers(): Promise<Team[]> {
  const supabase = await createClient();
  try {
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return [];
    }

    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("*");

    if (membersError) {
      console.error("Error fetching team members:", membersError);
      return teams || [];
    }

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, display_name, discord_username");

    if (usersError) {
      console.error("Error fetching users:", usersError);
    }

    const userDisplayNames = new Map(
      (users || []).map((u) => [
        u.id,
        u.display_name || u.discord_username || "Unknown User"
      ])
    );

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
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_email: userEmail.toLowerCase(),
        user_id: user?.id || null,
      })
      .select()
      .single();

    if (error) {
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
 * Add a user to a team by user_id (returns member_id for role assignment)
 */
export async function addMemberToTeamById(
  teamId: string,
  userId: string
): Promise<{ success: boolean; memberId?: string; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("id, display_name, discord_username")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return { success: false, error: "User not found" };
    }

    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    if (existingMember) {
      return { success: false, error: "User is already a member of this team" };
    }

    const { data, error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: userId,
        user_email: userProfile.display_name || userProfile.discord_username || userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error adding member to team:", error);
      return { success: false, error: error.message };
    }

    return { success: true, memberId: data.id };
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
    const { data: membership, error: memberError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_email", userEmail.toLowerCase())
      .single();

    if (memberError) {
      if (memberError.code === "PGRST116") {
        return { team: null };
      }
      console.error("Error fetching user team:", memberError);
      return { team: null, error: memberError.message };
    }

    if (!membership) {
      return { team: null };
    }

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

    const { data: existing } = await supabase
      .from("team_members")
      .select("id")
      .eq("user_email", userEmail.toLowerCase())
      .single();

    if (existing) {
      return { success: false, error: "You are already in a team" };
    }

    const { data: { user } } = await supabase.auth.getUser();

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
      .select("id, short_name, name, emoji, motto")
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

/**
 * Get all VISIBLE teams with their season record and last draft pick.
 */
export async function getTeamsWithDetails(
  includeHidden = false,
  adminClient?: AnySupabaseClient 
): Promise<{
  teams: TeamWithDetails[];
  error?: string;
}> {
  const supabase = adminClient ?? await createClient();
  
  try {
    const rpcResponse = await supabase
      .rpc('get_teams_with_stats', { p_include_hidden: includeHidden })
      .returns<RpcTeamStatRow[]>();
      
    const teamsData = rpcResponse.data;
    const teamsError = rpcResponse.error;

    if (teamsError) {
      console.error("Error fetching teams via RPC:", teamsError);
      return { teams: [], error: teamsError.message };
    }

    if (!Array.isArray(teamsData) || teamsData.length === 0) {
      return { teams: [] };
    }

    const lastPickMap = new Map<string, { image_url: string | null; card_name: string }>();
    const picksResponse = await supabase
      .rpc('get_latest_pick_for_each_team')
      .returns<Array<{ team_id: string; image_url: string | null; card_name: string }>>();
    
    const latestPicks = picksResponse.data;
    if (Array.isArray(latestPicks)) {
        latestPicks.forEach(pick => {
            lastPickMap.set(pick.team_id, { image_url: pick.image_url, card_name: pick.card_name });
        });
    }

    const enrichedTeams: TeamWithDetails[] = teamsData.map((team: RpcTeamStatRow) => ({
        id: team.id,
        short_name: team.short_name,
        name: team.name,
        emoji: team.emoji,
        motto: team.motto,
        wins: team.wins,
        losses: team.losses,
        game_wins: team.game_wins,
        game_losses: team.game_losses,
        rival_short_name: team.rival_short_name,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
        member_count: team.member_count,
        is_hidden: team.is_hidden,
        is_escaped: team.is_escaped || false, // <-- ADDED THIS
        last_pick: lastPickMap.get(team.id) || null,
    }));

    return { teams: enrichedTeams };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error fetching team details:", errorMessage);
    return { teams: [], error: "An unexpected error occurred" };
  }
}



export async function toggleChangelingIdentity(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // 1. Verify the current season is Neutral
    const { data: season } = await supabase.from('seasons').select('day_night_status').eq('is_active', true).single();
    if (season?.day_night_status !== 'neutral') {
       return { success: false, error: `You cannot shapeshift while the season is locked to ${season?.day_night_status}.` };
    }

    // 2. Fetch the team's current identity
    const { data: team } = await supabase.from('teams').select('active_identity').eq('id', teamId).single();
    if (!team) return { success: false, error: "Team not found." };

    const newIdentityKey = team.active_identity === 'changelings' ? 'mimics' : 'changelings';

    // 3. Fetch the cosmetic details from the new team_identities table!
    const { data: identityData, error: identityError } = await supabase
        .from('team_identities')
        .select('name, emoji, primary_color, secondary_color')
        .eq('team_id', teamId)
        .eq('identity_key', newIdentityKey)
        .single();

    if (identityError || !identityData) {
        return { success: false, error: "Identity profile not found in the database." };
    }

    // 4. Apply the cosmetic swap dynamically
    const { error } = await supabase.from('teams').update({
        active_identity: newIdentityKey,
        name: identityData.name,
        emoji: identityData.emoji,
        primary_color: identityData.primary_color,
        secondary_color: identityData.secondary_color
    }).eq('id', teamId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
