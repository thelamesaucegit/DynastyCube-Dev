// src/app/actions/homeActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTeamsWithDetails } from "@/app/actions/teamActions";
import { getLatestStreamMatch, type StreamMatch } from "@/app/actions/liveStreamActions";


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

export interface ActiveDraftSession {
  id: string;
}

export interface RecentDraftPick {
  id: string;
  card_id: string;
  card_name: string;
  card_type?: string;
  image_url?: string;
  oldest_image_url?: string; // <-- ADDED
  team_id: string;
  team_name: string;
  team_emoji: string;
  pick_number?: number;
  drafted_at: string;
}

export interface CurrentSeason {
  id: string;
  season_name: string;
  phase: "draft" | "preseason" | "season" | "playoffs" | "postseason"; // <-- Added to match DB!
  season_number: number;
  start_date: string;
    is_active: boolean;
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

export interface CountdownTimer {
  id: string;
  title: string;
  end_time: string;
  link_url: string;
  link_text: string;
  is_active: boolean;
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

export interface HomepagePoll {
  id: string;
  title: string;
  vote_type: string;
}

export interface CypherStats {
  percentRemaining: number;
  hasRecentCypher: boolean;
}


export interface RecentTransaction {
  id: string;
  card_id: string;
  card_name: string;
  card_type?: string;
  image_url?: string;
  oldest_image_url?: string;
  team_id: string;
  team_name: string;
  team_emoji: string;
  from_team_id?: string;
  from_team_name?: string;
  from_team_emoji?: string;
  acquisition_method: string;
  acquired_at: string;
}

// Strict Database Return Type for Transactions
interface DbTransactionRow {
  id: string;
  card_id: string;
  card_name: string;
  card_type: string | null;
  image_url: string | null;
  oldest_image_url: string | null;
  team_id: string;
  from_team_id: string | null;
  acquisition_method: string;
  acquired_at: string;
  teams: { id: string; name: string; emoji: string } | { id: string; name: string; emoji: string }[] | null;
  from_teams: { id: string; name: string; emoji: string } | { id: string; name: string; emoji: string }[] | null;
}

export interface HomepageData {
  season: CurrentSeason | null;
  adminNews: AdminNews[];
  countdownTimer: CountdownTimer| null;
  liveMatch: StreamMatch | null;
  activePolls: HomepagePoll[];
  cypherStats: CypherStats | null;
  activeTeamCount: number;
  recentTransactions: RecentTransaction[];
  activeDraftSessionId: string | null;
}

export async function getRecentTransactions(limit: number = 10): Promise<{
  transactions: RecentTransaction[];
  error?: string;
}> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("card_transactions")
      .select(`
        id, card_id, card_name, card_type, image_url, oldest_image_url, team_id, from_team_id, acquisition_method, acquired_at,
        teams!card_transactions_team_id_fkey ( id, name, emoji ),
        from_teams:teams!card_transactions_from_team_id_fkey ( id, name, emoji )
      `)
      .order("acquired_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent transactions:", error);
      return { transactions: [], error: error.message };
    }

    const rawRows = (data || []) as unknown as DbTransactionRow[];

    const transactions: RecentTransaction[] = rawRows.map((tx) => {
      const team = Array.isArray(tx.teams) ? tx.teams[0] : tx.teams;
      const fromTeam = Array.isArray(tx.from_teams) ? tx.from_teams[0] : tx.from_teams;

      return {
        id: tx.id,
        card_id: tx.card_id,
        card_name: tx.card_name,
        card_type: tx.card_type || undefined,
        image_url: tx.image_url || undefined,
        oldest_image_url: tx.oldest_image_url || undefined,
        team_id: tx.team_id,
        team_name: team?.name || "Unknown Team",
        team_emoji: team?.emoji || "❓",
        from_team_id: tx.from_team_id || undefined,
        from_team_name: fromTeam?.name || undefined,
        from_team_emoji: fromTeam?.emoji || undefined,
        acquisition_method: tx.acquisition_method,
        acquired_at: tx.acquired_at,
      };
    });

    return { transactions };
  } catch (error) {
    console.error("Unexpected error fetching recent transactions:", error);
    return { transactions: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get the currently active draft session ID
 */
export async function getActiveDraftSession(): Promise<{
  session: ActiveDraftSession | null;
  error?: string;
}> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("draft_sessions")
      .select("id")
      .eq("status", "active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return { session: null };
      console.error("Error fetching active draft session:", error);
      return { session: null, error: error.message };
    }
    return { session: data };
  } catch (error) {
    console.error("Unexpected error fetching active draft session:", error);
    return { session: null, error: "An unexpected error occurred" };
  }
}

/**
 * Get the currently active countdown timer
 */
export async function getActiveCountdownTimer(): Promise<{
  timer: CountdownTimer | null;
  error?: string;
}> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("countdown_timers")
      .select("id, title, end_time, link_url, link_text, is_active")
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") return { timer: null };
      console.error("Error fetching active countdown timer:", error);
      return { timer: null, error: error.message };
    }
    return { timer: data };
  } catch (error) {
    console.error("Unexpected error fetching active countdown timer:", error);
    return { timer: null, error: "An unexpected error occurred" };
  }
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
        oldest_image_url, 
        team_id,
        pick_number,
        drafted_at,
        teams (
          id,
          name,
          emoji
        )
      `)
      .neq("card_id", "skipped-pick") // <-- FIX: Do not fetch skipped picks for the homepage
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
        oldest_image_url: pick.oldest_image_url,
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
      .eq("is_active", "TRUE")
      .single();

    if (error) {
      if (error.code === "PGRST116") return { season: null };
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
      author_name: "Admin Team",
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
      .from("matches")
      .select(`
        id,
        home_team_id,
        away_team_id,
        home_team_wins,
        away_team_wins,
        winner_team_id,
        confirmed_at,
        team1:teams!matches_home_team_id_fkey (
          id,
          name,
          emoji
        ),
        team2:teams!matches_away_team_id_fkey (
          id,
          name,
          emoji
        )
      `)
      .eq("status", "completed")
      .order("confirmed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent games:", error);
      return { games: [], error: error.message };
    }

    const games: RecentGame[] = (data || []).map((match) => {
      const team1 = Array.isArray(match.team1) ? match.team1[0] : match.team1;
      const team2 = Array.isArray(match.team2) ? match.team2[0] : match.team2;

      return {
        id: match.id,
        team1_id: match.home_team_id,
        team1_name: team1?.name || "Unknown Team",
        team1_emoji: team1?.emoji || "❓",
        team2_id: match.away_team_id,
        team2_name: team2?.name || "Unknown Team",
        team2_emoji: team2?.emoji || "❓",
        team1_score: match.home_team_wins,
        team2_score: match.away_team_wins,
        winner_id: match.winner_team_id,
        played_at: match.confirmed_at,
      };
    });

    return { games };
  } catch (error) {
    console.error("Unexpected error fetching recent games:", error);
    return { games: [], error: "An unexpected error occurred" };
  }
}
export async function getHomepageData(): Promise<{ data: HomepageData | null; error?: string }> {
  try {
    // All requests are now bundled and run in parallel on the server
    const [
      seasonResult,
      teamsResult,
      newsResult,
      timerResult,
      liveMatchResult,
      pollsResult,
      cypherResult,
      transactionsResult,
      draftSessionResult
    ] = await Promise.all([
      getCurrentSeason(),
      getTeamsWithDetails(),
      getAdminNews(1),
      getActiveCountdownTimer(),
      getLatestStreamMatch(),
      getHomepageActivePolls(),
      getCypherStats(),
      getRecentTransactions(20),
      getActiveDraftSession()
    ]);

    const homepageData: HomepageData = {
      season: seasonResult.season,
      adminNews: newsResult.news,
      countdownTimer: timerResult.timer,
      liveMatch: liveMatchResult.match,
      activePolls: pollsResult.polls || [],
      cypherStats: cypherResult.stats || null,
      activeTeamCount: teamsResult.teams?.filter(t => !(t as { is_hidden?: boolean }).is_hidden).length || 8,
      recentTransactions: transactionsResult.transactions,
      activeDraftSessionId: draftSessionResult.session?.id || null,
    };

    return { data: homepageData };

  } catch (error) {
    console.error("Error fetching comprehensive homepage data:", error);
    return { data: null, error: "Failed to load homepage data." };
  }
}
/**
 * Get active polls filtered for the homepage (Global + User's Team)
 */
export async function getHomepageActivePolls(): Promise<{ polls: HomepagePoll[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let userTeamId: string | null = null;
    
    if (user) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();
      if (teamMember) userTeamId = teamMember.team_id;
    }

  const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffIso = sevenDaysAgo.toISOString();

    const { data: polls, error } = await supabase
      .from('polls')
      .select('id, title, vote_type, team_id, ends_at, is_active') 
      .or(`is_active.eq.true,ends_at.gte.${cutoffIso}`) 
      .order('created_at', { ascending: false });


    if (error) return { polls: [], error: error.message };

    const activePolls: HomepagePoll[] = (polls || [])
      .filter((poll) => {
        // Filter out team polls that don't belong to the user
        if (poll.vote_type === 'team') {
          return poll.team_id === userTeamId;
        }
        return true; // Global polls are allowed
      })
      .map((poll) => ({
        id: poll.id,
        title: poll.title,
        vote_type: poll.vote_type,
        ends_at: poll.ends_at, 
        is_active: poll.is_active
      }));

    return { polls: activePolls };
  } catch (error: unknown) {
    return { polls: [], error: String(error) };
  }
}

/**
 * Get aggregate cypher completion stats
 */
export async function getCypherStats(): Promise<{ stats: CypherStats | null; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: cyphers, error: cypherError } = await supabase
      .from('cyphers')
      .select('id, content, created_at')
      .eq('is_published', true);

    if (cypherError) return { stats: null, error: cypherError.message };
    if (!cyphers || cyphers.length === 0) {
      return { stats: { percentRemaining: 100, hasRecentCypher: false } };
    }

    const { data: revealed } = await supabase.from('cypher_revealed_words').select('cypher_id, word');

    const revealedMap = new Map<string, Set<string>>();
    revealed?.forEach((r) => {
      if (!revealedMap.has(r.cypher_id)) revealedMap.set(r.cypher_id, new Set<string>());
      revealedMap.get(r.cypher_id)!.add(r.word.toLowerCase());
    });

    let totalUniqueWords = 0;
    let totalRevealedWords = 0;
    let hasRecentCypher = false;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    cyphers.forEach((cypher) => {
      if (new Date(cypher.created_at) >= threeDaysAgo) {
        hasRecentCypher = true;
      }

      const matches = Array.from(cypher.content.matchAll(/([a-zA-Z']+)/g)) as RegExpMatchArray[];
      const uniqueWords = new Set<string>(matches.map((m) => m[0].toLowerCase()));
      
      totalUniqueWords += uniqueWords.size;

      const revealedSet = revealedMap.get(cypher.id);
      if (revealedSet) {
        let revealedCount = 0;
        uniqueWords.forEach((word) => {
          if (revealedSet.has(word)) revealedCount++;
        });
        totalRevealedWords += revealedCount;
      }
    });

    const completionPercentage = totalUniqueWords > 0 ? Math.round((totalRevealedWords / totalUniqueWords) * 100) : 0;
    const percentRemaining = 100 - completionPercentage;

    return { stats: { percentRemaining, hasRecentCypher } };
  } catch (error: unknown) {
    return { stats: null, error: String(error) };
  }
}
