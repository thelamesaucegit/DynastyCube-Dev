// src/app/actions/homeActions.ts
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
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}

export interface RecentDraftPick {
  id: string;
  card_id: string;
  card_name: string;
  card_type?: string;
  image_url?: string;
  team_id: string;
  team_name: string;
  team_emoji: string;
  pick_number?: number;
  drafted_at: string;
}

export interface CurrentSeason {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: string;
}

export interface AdminNews {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_name: string;
}

export interface RecentGame {
  id: string;
  team1_id: string;
  team1_name: string;
  team1_emoji: string;
  team2_id: string;
  team2_name: string;
  team2_emoji: string;
  team1_score: number;
  team2_score: number;
  winner_id?: string;
  played_at: string;
}

/**
 * Get recent draft picks (last 10 picks)
 */
export async function getRecentDraftPicks(limit: number = 10): Promise<{
  picks: RecentDraftPick[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_draft_picks")
      .select(`
        id,
        card_id,
        card_name,
        card_type,
        image_url,
        team_id,
        pick_number,
        drafted_at,
        teams (
          id,
          name,
          emoji
        )
      `)
      .order("drafted_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent draft picks:", error);
      return { picks: [], error: error.message };
    }

    const picks: RecentDraftPick[] = (data || []).map((pick) => {
      const team = Array.isArray(pick.teams) ? pick.teams[0] : pick.teams;
      return {
        id: pick.id,
        card_id: pick.card_id,
        card_name: pick.card_name || "Unknown Card",
        card_type: pick.card_type,
        image_url: pick.image_url,
        team_id: pick.team_id,
        team_name: team?.name || "Unknown Team",
        team_emoji: team?.emoji || "❓",
        pick_number: pick.pick_number,
        drafted_at: pick.drafted_at,
      };
    });

    return { picks };
  } catch (error) {
    console.error("Unexpected error fetching recent draft picks:", error);
    return { picks: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get current season information
 */
export async function getCurrentSeason(): Promise<{
  season: CurrentSeason | null;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "active")
      .single();

    if (error) {
      // No active season is not an error
      if (error.code === "PGRST116") {
        return { season: null };
      }
      console.error("Error fetching current season:", error);
      return { season: null, error: error.message };
    }

    return { season: data };
  } catch (error) {
    console.error("Unexpected error fetching current season:", error);
    return { season: null, error: "An unexpected error occurred" };
  }
}

/**
 * Get recent admin news posts (only published)
 */
export async function getAdminNews(limit: number = 5): Promise<{
  news: AdminNews[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("admin_news")
      .select(`
        id,
        title,
        content,
        created_at,
        author_id
      `)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching admin news:", error);
      return { news: [], error: error.message };
    }

    const news: AdminNews[] = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      created_at: item.created_at,
      author_name: "Admin Team", // Simplified - no user lookup needed
    }));

    return { news };
  } catch (error) {
    console.error("Unexpected error fetching admin news:", error);
    return { news: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get recent game results
 */
export async function getRecentGames(limit: number = 5): Promise<{
  games: RecentGame[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("games")
      .select(`
        id,
        team1_id,
        team2_id,
        team1_score,
        team2_score,
        winner_id,
        played_at,
        team1:teams!games_team1_id_fkey (
          id,
          name,
          emoji
        ),
        team2:teams!games_team2_id_fkey (
          id,
          name,
          emoji
        )
      `)
      .order("played_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent games:", error);
      return { games: [], error: error.message };
    }

    const games: RecentGame[] = (data || []).map((game) => {
      const team1 = Array.isArray(game.team1) ? game.team1[0] : game.team1;
      const team2 = Array.isArray(game.team2) ? game.team2[0] : game.team2;
      return {
        id: game.id,
        team1_id: game.team1_id,
        team1_name: team1?.name || "Unknown Team",
        team1_emoji: team1?.emoji || "❓",
        team2_id: game.team2_id,
        team2_name: team2?.name || "Unknown Team",
        team2_emoji: team2?.emoji || "❓",
        team1_score: game.team1_score,
        team2_score: game.team2_score,
        winner_id: game.winner_id,
        played_at: game.played_at,
      };
    });

    return { games };
  } catch (error) {
    console.error("Unexpected error fetching recent games:", error);
    return { games: [], error: "An unexpected error occurred" };
  }
}
