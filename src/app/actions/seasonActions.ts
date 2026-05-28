// src/app/actions/seasonActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { importNextSetToChamber } from "./chamberActions"; // Ensure this is imported at the top
import { generateDraftOrder } from "./draftOrderActions";


export interface CardCostChange {
  card_id: string;
  card_name: string;
  old_cost: number;
  new_cost: number;
  was_drafted: boolean;
}

/**
 * Fires when the Offseason Timer hits zero!
 */
export async function executeSeasonRollover(): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    console.log("[SeasonRollover] 🔄 Starting full season rollover...");

    try {
        // 1. Run the Curation Economy
        const curationResult = await executeOffseasonCuration();
        if (!curationResult.success) throw new Error(curationResult.error);

        // 2. Identify Previous Season
        const { data: oldSeason } = await supabase.from('seasons').select('*').eq('is_active', true).single();
        if (!oldSeason) throw new Error("Could not find active season to roll over.");

        const nextSeasonNumber = oldSeason.season_number + 1;
        const isTestSeason = oldSeason.season_name.toUpperCase().includes("TEST");
        const nextSeasonName = isTestSeason ? `Test Season ${nextSeasonNumber}` : `Season ${nextSeasonNumber}`;

        console.log(`[SeasonRollover] Building ${nextSeasonName}...`);

        // 3. Deactivate Old, Create New
        await supabase.from('seasons').update({ is_active: false }).eq('id', oldSeason.id);
        
        const { data: newSeason, error: seasonErr } = await supabase.from('seasons').insert({
            season_name: nextSeasonName,
            season_number: nextSeasonNumber,
            is_active: true,
            phase: 'draft'
        }).select('id').single();

        if (seasonErr || !newSeason) throw new Error("Failed to create new season.");

        // 4. Generate the highly-calculated Draft Order!
        const draftOrderResult = await generateDraftOrder(newSeason.id, { orderType: 'previous_season' });
        if (!draftOrderResult.success) throw new Error(`Draft order generation failed: ${draftOrderResult.error}`);

        // 5. Spawn the new Draft Session!
        const startTime = new Date(Date.now() + 5 * 60000).toISOString(); // Draft starts 5 mins after generation
        
        await supabase.from("draft_sessions").insert({
            season_id: newSeason.id,
            status: "scheduled",
            total_rounds: 15, // Set to your cube standard
            hours_per_pick: isTestSeason ? 0.05 : 12, // 3 mins for test, 12 hours for real
            start_time: startTime,
            started_by: null,
        });

        // Clear the countdown timer
        await supabase.from('countdown_timers').update({ is_active: false }).eq('is_active', true);

        console.log("[SeasonRollover] ✅ Rollover complete! New draft scheduled.");
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[SeasonRollover] ❌ Rollover Failed:", msg);
        return { success: false, error: msg };
    }
}

/**
 * Executes the strict economic and pool curation rules for the Offseason.
 */
export async function executeOffseasonCuration(): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    console.log("[Offseason] Starting Draft Pool Curation...");

    try {
        // 1. Double the cubucks_cost for all Keepers
        const { data: keepers } = await supabase.from('team_draft_picks').select('card_id').eq('is_keeper', true);
        if (keepers && keepers.length > 0) {
            const keeperIds = keepers.map(k => k.card_id);
            // Quick raw SQL RPC call or sequential update (RPC is better, but this works for scale)
            for (const id of keeperIds) {
                const { data: card } = await supabase.from('card_pools').select('cubucks_cost').eq('card_id', id).single();
                if (card) {
                    await supabase.from('card_pools').update({ cubucks_cost: card.cubucks_cost * 2 }).eq('card_id', id);
                }
            }
        }

        // 2. Increase cubucks_cost by 1 for all remaining Draft pool cards (excluding keepers)
        const keeperIdList = keepers?.map(k => k.card_id) || [];
        const { data: draftCards } = await supabase.from('card_pools').select('id, cubucks_cost').eq('pool_name', 'draft').not('card_id', 'in', `(${keeperIdList.join(',')})`);
        if (draftCards) {
            for (const card of draftCards) {
                await supabase.from('card_pools').update({ cubucks_cost: card.cubucks_cost + 1 }).eq('id', card.id);
            }
        }

        // 3. Remove non-keepers from teams (Undraft)
        await supabase.from('team_draft_picks').delete().eq('is_keeper', false);

        // 4. Free Agent Aging & Retirement
        const { data: freeAgents } = await supabase.from('card_pools').select('*').eq('pool_name', 'free');
        if (freeAgents) {
            for (const card of freeAgents) {
                const newSeasonsInFa = (card.seasons_in_free_agency || 0) + 1;
                
                if (newSeasonsInFa >= 2) {
                    // Retire the card
                    await supabase.from('retired_cards').insert({
                        card_id: card.card_id, card_name: card.card_name, card_set: card.card_set, card_type: card.card_type, rarity: card.rarity,
                        colors: card.colors, color_identity: card.color_identity, image_url: card.image_url, oldest_image_url: card.oldest_image_url,
                        oracle_id: card.oracle_id, mana_cost: card.mana_cost, cmc: card.cmc, cubucks_cost: card.cubucks_cost,
                        retired_reason: 'Free agent for 2 seasons'
                    });
                    await supabase.from('card_pools').delete().eq('id', card.id);
                } else {
                    // Age it, and if it still has value > 0, return to draft pool
                    if (card.cubucks_cost > 0) {
                        await supabase.from('card_pools').update({ pool_name: 'draft', seasons_in_free_agency: newSeasonsInFa }).eq('id', card.id);
                    } else {
                        await supabase.from('card_pools').update({ seasons_in_free_agency: newSeasonsInFa }).eq('id', card.id);
                    }
                }
            }
        }

        // 5. Promote Wire & Chamber to Draft
        await supabase.from('card_pools').update({ pool_name: 'draft' }).in('pool_name', ['wire', 'chamber']);

        // 6. Import Next Set into the Chamber
        const importResult = await importNextSetToChamber();
        if (!importResult.success) {
            console.warn("[Offseason] Chamber import returned an issue:", importResult.message);
        }

        console.log("[Offseason] Curation complete!");
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Offseason] Curation Failed:", msg);
        return { success: false, error: msg };
    }
}
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "Not authenticated" };
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.is_admin) {
    return { authorized: false, userId: user.id, error: "Unauthorized: Admin access required" };
  }

  return { authorized: true, userId: user.id };
}
export async function getWeekIdByNumber(
    seasonNumber: number,
    weekNumber: number
): Promise<{ weekId: string | null; error?: string }> {
    const supabase = await createServerClient(); // Uses the correct server client
    try {
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select('id')
            .eq('season_number', seasonNumber)
            .single();

        if (seasonError || !season) {
            return { weekId: null, error: `Season ${seasonNumber} not found.` };
        }

        const { data: week, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('id')
            .eq('season_id', season.id)
            .eq('week_number', weekNumber)
            .single();

        if (weekError || !week) {
            return { weekId: null, error: `Week ${weekNumber} not found in season ${seasonNumber}.` };
        }

        return { weekId: week.id, error: undefined };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        return { weekId: null, error: message };
    }
}

/**
 * Deletes an entire season and all its associated data.
 * THIS IS A DESTRUCTIVE AND IRREVERSIBLE ACTION.
 * The database's CASCADE constraint will handle deleting linked schedule_weeks, draft_sessions, etc.
 * @param seasonId The UUID of the season to delete.
 */
export async function deleteFullSeason(
  seasonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient(); // Assumes createServerClient is available
    const admin = await verifyAdmin(supabase); // Assumes verifyAdmin helper is available or you can copy it
    if (!admin.authorized) {
      return { success: false, error: admin.error };
    }

    const { error } = await supabase
      .from("seasons")
      .delete()
      .eq("id", seasonId);

    if (error) {
      console.error("Error deleting season:", error);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Unexpected error deleting full season:", message);
    return { success: false, error: message };
  }
}

/**
 * Rollover card costs to a new season
 * - Drafted cards: cost +1
 * - Undrafted cards: cost -1 (min 1)
 */
export async function rolloverSeasonCosts(
  newSeasonId: string,
  previousSeasonId?: string
): Promise<{
  success: boolean;
  changes?: CardCostChange[];
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the rollover function
    const { data, error } = await supabase.rpc("rollover_card_costs_for_new_season", {
      p_new_season_id: newSeasonId,
      p_previous_season_id: previousSeasonId || null,
    });

    if (error) {
      console.error("Error rolling over costs:", error);
      return { success: false, error: error.message };
    }

    return { success: true, changes: data || [] };
  } catch (error) {
    console.error("Unexpected error rolling over costs:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Initialize card costs for current season (all cards at 1 Cubuck)
 */
export async function initializeSeasonCosts(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the initialization function
    const { error } = await supabase.rpc("initialize_season_card_costs");

    if (error) {
      console.error("Error initializing costs:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error initializing costs:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get card pricing history across seasons
 */
export async function getCardPricingHistory(
  cardPoolId?: string
): Promise<{
  history: Array<{
    card_pool_id: string;
    card_name: string;
    card_set: string;
    rarity: string;
    season_number: number;
    season_name: string;
    cost: number;
    was_drafted: boolean;
    times_drafted: number;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    let query = supabase.from("card_pricing_history").select("*");

    if (cardPoolId) {
      query = query.eq("card_pool_id", cardPoolId);
    }

    const { data, error } = await query.order("card_name").order("season_number");

    if (error) {
      console.error("Error fetching pricing history:", error);
      return { history: [], error: error.message };
    }

    return { history: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching pricing history:", error);
    return { history: [], error: String(error) };
  }
}

/**
 * Get cost changes summary for last season
 */
export async function getSeasonCostSummary(
  seasonId: string
): Promise<{
  summary: {
    total_cards: number;
    drafted_cards: number;
    undrafted_cards: number;
    avg_cost: number;
    max_cost: number;
    min_cost: number;
  } | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("card_season_costs")
      .select("cost, was_drafted, times_drafted")
      .eq("season_id", seasonId);

    if (error) {
      console.error("Error fetching season summary:", error);
      return { summary: null, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        summary: {
          total_cards: 0,
          drafted_cards: 0,
          undrafted_cards: 0,
          avg_cost: 0,
          max_cost: 0,
          min_cost: 0,
        },
      };
    }

    const summary = {
      total_cards: data.length,
      drafted_cards: data.filter((c) => c.was_drafted).length,
      undrafted_cards: data.filter((c) => !c.was_drafted).length,
      avg_cost: Math.round(
        data.reduce((sum, c) => sum + c.cost, 0) / data.length
      ),
      max_cost: Math.max(...data.map((c) => c.cost)),
      min_cost: Math.min(...data.map((c) => c.cost)),
    };

    return { summary };
  } catch (error) {
    console.error("Unexpected error fetching season summary:", error);
    return { summary: null, error: String(error) };
  }
}

/**
 * Get cards by cost range for current season
 */
export async function getCardsByCostRange(
  minCost: number,
  maxCost: number
): Promise<{
  cards: Array<{
    id: string;
    card_name: string;
    card_set: string;
    rarity: string;
    cubucks_cost: number;
    image_url?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("card_pools")
      .select("id, card_name, card_set, rarity, cubucks_cost, image_url")
      .gte("cubucks_cost", minCost)
      .lte("cubucks_cost", maxCost)
      .order("cubucks_cost", { ascending: false })
      .order("card_name");

    if (error) {
      console.error("Error fetching cards by cost:", error);
      return { cards: [], error: error.message };
    }

    return { cards: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching cards by cost:", error);
    return { cards: [], error: String(error) };
  }
}

/**
 * Get the current active season
 */
export async function getCurrentSeason(): Promise<{
  season: { id: string; name: string; season_number: number } | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, season_number")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching current season:", error);
      return { season: null, error: error.message };
    }

    return { season: data || null };
  } catch (error) {
    console.error("Unexpected error fetching current season:", error);
    return { season: null, error: String(error) };
  }
}
