// src/app/actions/adminActions.ts

"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards } from "@/lib/scryfall-client";
import { GameState } from "@/app/types";

// This remains the same as our last corrected version
interface AiProfile {
  id: string;
  profile_name: string;
}

// This client creation function remains the same
async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Ignore */ }
        },
      },
    }
  );
}

/**
 * --- MODIFIED ---
 * Fetches the replay data for a single match, now also including the
 * team information for the two competing teams.
 * @param matchId The UUID of the match.
 * @returns A promise that resolves to an object containing game states and team info.
 */
export async function getMatchReplay(matchId: string): Promise<{ 
  gameStates: GameState[] | null;
  team1: { id: string, name: string, emoji: string } | null;
  team2: { id: string, name: string, emoji: string } | null;
} | null> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  if (!matchId) {
    console.error("getMatchReplay called with invalid matchId");
    return null;
  }
  
  // --- FIX: The query now joins with the 'teams' table to fetch team info ---
  const { data, error } = await supabase
    .from('sim_matches')
    .select(`
      game_states,
      team1:teams!team1_id(id, name, emoji),
      team2:teams!team2_id(id, name, emoji)
    `)
    .eq('id', matchId)
    .single();

  if (error) {
    console.error(`Error fetching replay for match ${matchId}:`, error);
    return null;
  }

  if (!data) return null;

  return {
    gameStates: data.game_states || null,
    team1: data.team1,
    team2: data.team2
  };
}

/**
 * This function remains the same as our last corrected version.
 */
export async function validateAndCanonicalizeDeck(cardNames: string[]): Promise<{
  valid: Map<string, string>;
  invalid: string[];
}> {
  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const BASIC_LANDS = new Map<string, string>([
    ["mountain", "Mountain"], ["forest", "Forest"], ["island", "Island"],
    ["plains", "Plains"], ["swamp", "Swamp"],
  ]);
  const lowerCaseNames = [...new Set(cardNames.map(name => name.trim().toLowerCase()).filter(Boolean))];
  const validCanonicalMap = new Map<string, string>();
  const namesForDbCheck: string[] = [];
  for (const name of lowerCaseNames) {
    if (BASIC_LANDS.has(name)) {
      validCanonicalMap.set(name, BASIC_LANDS.get(name)!);
    } else {
      namesForDbCheck.push(name);
    }
  }
  if (namesForDbCheck.length > 0) {
    const { data: dbData, error: dbError } = await supabase.rpc('get_canonical_card_names', { names_to_check: namesForDbCheck });
    if (dbError) {
      console.error("Database error during card validation:", dbError);
      const invalidNames = lowerCaseNames.filter(name => !validCanonicalMap.has(name));
      return { valid: validCanonicalMap, invalid: invalidNames };
    }
    dbData.forEach((item: { canonical_name: string }) => {
      validCanonicalMap.set(item.canonical_name.toLowerCase(), item.canonical_name);
    });
  }
  const invalidNames = lowerCaseNames.filter(name => !validCanonicalMap.has(name));
  return { valid: validCanonicalMap, invalid: invalidNames };
}

// The backfill functions remain unchanged.
export async function backfillColorIdentity(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> { /* ... no change ... */ }
export async function backfillCMCForDraftPicks(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> { /* ... no change ... */ }
export async function backfillCMCForCardPools(): Promise<{ success: boolean; updated: number; failed: number; errors: string[]; }> { /* ... no change ... */ }
export async function backfillAllCMCData(): Promise<{ success: boolean; draftPicksUpdated: number; cardPoolsUpdated: number; totalFailed: number; errors: string[]; }> { /* ... no change ... */ }

/**
 * This function remains the same as our last corrected version.
 */
export async function getAiProfiles(): Promise<AiProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_profiles')
    .select('id, profile_name')
    .order('profile_name', { ascending: true });

  if (error) {
    console.error('Error fetching AI profiles:', error);
    return [];
  }
  return data || [];
}
