// src/app/actions/seasonActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { importNextSetToChamber } from "./chamberActions"; // Ensure this is imported at the top
import { generateDraftOrder } from "./draftOrderActions";
import { logSystemEvent } from "@/lib/systemLogger";



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
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
    
    console.log("[SeasonRollover] 🔄 Starting full modular season rollover...");
    
    try {
       // --- STEP 1: IDENTIFY OLD & CREATE NEW SEASON ---
        const { data: oldSeason, error: oldSeasonErr } = await supabase.from('seasons').select('*').eq('is_active', true).single();
        if (oldSeasonErr || !oldSeason) throw new Error(`Could not find active season. DB Error: ${JSON.stringify(oldSeasonErr)}`);

        const nextSeasonNumber = oldSeason.season_number + 1;
        const isTestSeason = oldSeason.season_name.toUpperCase().includes("TEST");
        const nextSeasonName = isTestSeason ? `Test Season ${nextSeasonNumber}` : `Season ${nextSeasonNumber}`;
        
        console.log(`[SeasonRollover] Building ${nextSeasonName}...`);

        const { error: deactivateErr } = await supabase.from('seasons').update({ is_active: false }).eq('id', oldSeason.id);
        if (deactivateErr) throw new Error(`Failed to deactivate old season: ${JSON.stringify(deactivateErr)}`);
        
        // FIX: Calculate dynamic start and end dates to satisfy NOT NULL constraints
        const now = new Date();
        
        // Determine the length of the previous season to mirror it (fallback to 90 days if unavailable)
        const oldDurationMs = (oldSeason.end_date && oldSeason.start_date)
            ? new Date(oldSeason.end_date).getTime() - new Date(oldSeason.start_date).getTime()
            : 90 * 24 * 60 * 60 * 1000; 
            
        const nextEndDate = new Date(now.getTime() + oldDurationMs);

        const { data: newSeason, error: seasonErr } = await supabase.from('seasons').insert({
            season_name: nextSeasonName,
            season_number: nextSeasonNumber,
            is_active: true,
            phase: 'draft',
            start_date: now.toISOString(),
            end_date: nextEndDate.toISOString(),
            cubucks_allocation: oldSeason.cubucks_allocation || 100 
        }).select('id').single();
        
        if (seasonErr || !newSeason) throw new Error(`Failed to create new season: ${JSON.stringify(seasonErr)}`);
      
        // --- STEP 2: ROLLOVER COSTS & RETIREMENTS ---
        console.log("[SeasonRollover] Running Cost Economy & Retirements...");
        const { error: costErr } = await supabase.rpc('rollover_season_costs', {
            p_new_season_id: newSeason.id,
            p_previous_season_id: oldSeason.id
        });
        if (costErr) throw new Error(`Cost Rollover RPC failed: ${costErr.message}`);


        // --- STEP 3: CULL POOLS TO MAKE ROOM ---
        console.log("[SeasonRollover] Culling lowest ELO cards to ensure 600 cap...");
        const { error: cullErr } = await supabase.rpc('cull_pools_for_chamber');
        if (cullErr) throw new Error(`Cull Pools RPC failed: ${cullErr.message}`);


        // --- STEP 4: FLUSH THE CHAMBER TABLE ---
        console.log("[SeasonRollover] Flushing The Chamber to Card Pools...");
        const { error: flushErr } = await supabase.rpc('flush_chamber_to_pools');
        if (flushErr) throw new Error(`Flush Chamber RPC failed: ${flushErr.message}`);


        // --- STEP 5: PROMOTE EXISTING STAGING POOLS ---
        console.log("[SeasonRollover] Promoting Wire and Chamber pools to Draft...");
        const { error: promoteErr } = await supabase.rpc('promote_staging_pools');
        if (promoteErr) throw new Error(`Promote Staging Pools RPC failed: ${promoteErr.message}`);



// --- STEP 6: CALCULATE AND SET DYNAMIC CAP ---
        console.log("[SeasonRollover] Calculating dynamic salary cap...");
        const { data: dynamicCap, error: capErr } = await supabase.rpc('update_season_dynamic_cap', {
            p_season_id: newSeason.id
        });
        if (capErr) throw new Error(`Dynamic Cap RPC failed: ${capErr.message}`);
        console.log(`[SeasonRollover] 💰 Dynamic Cap set to: ${dynamicCap} Cubucks`);

        // --- STEP 6.5: ALLOCATE TEAM BUDGETS ---
        console.log("[SeasonRollover] Allocating budgets to teams...");
        const { error: allocErr } = await supabase.rpc('allocate_season_budgets', {
            p_season_id: newSeason.id
        });
        if (allocErr) throw new Error(`Budget Allocation RPC failed: ${allocErr.message}`);
        console.log("[SeasonRollover] 🏦 Team budgets allocated and ledger updated.");

      

       // --- STEP 7: REFILL THE CHAMBER & BACKFILL METADATA ---
        console.log("[SeasonRollover] Refilling The Chamber...");
        const importResult = await importNextSetToChamber();
        if (!importResult.success) {
            console.warn("[SeasonRollover] Chamber import returned an issue:", importResult.message);
        } else {
            console.log("[SeasonRollover] Chamber refilled! Backfilling metadata...");
            
            // Note: I'm awaiting these sequentially to respect rate limits on Scryfall
            const { updateAllCubecobraElo } = await import('@/app/actions/cardRatingActions');
            const { backfillOracleData, backfillColorIdentity, backfillCMCForCardPools } = await import('@/app/actions/adminActions');

            await updateAllCubecobraElo('the_chamber');
            await backfillOracleData('the_chamber');
            await backfillColorIdentity('the_chamber');
            await backfillCMCForCardPools('the_chamber');
            
            console.log("[SeasonRollover] Metadata backfill complete for new chamber set.");
        }

        // --- STEP 8: DRAFT ORDER & SCHEDULING ---
        console.log("[SeasonRollover] Generating Draft Order...");
        const draftOrderResult = await generateDraftOrder(newSeason.id, { orderType: 'previous_season' });
        if (!draftOrderResult.success) throw new Error(`Draft order generation failed: ${draftOrderResult.error}`);

        const startTime = isTestSeason 
            ? new Date(Date.now() + 5 * 60000).toISOString() 
            : new Date().toISOString(); 
        
        const { error: draftErr } = await supabase.from("draft_sessions").insert({
            season_id: newSeason.id,
            name: `${nextSeasonName} Draft`,
            status: "scheduled",
            total_rounds: 40, 
            hours_per_pick: isTestSeason ? 0.00138 : 1, 
            start_time: startTime,
            started_by: null,
        });
        if (draftErr) throw new Error(`Failed to insert draft session: ${JSON.stringify(draftErr)}`);

        await supabase.from('countdown_timers').delete().eq('is_active', true);
        
        console.log("[SeasonRollover] ✅ Rollover complete! New draft scheduled.");
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        
        // Log to database immediately safely
        await logSystemEvent(
            'SeasonRollover', 
            'error', 
            `Rollover Pipeline Failed: ${msg}`,
            { timestamp: new Date().toISOString() }
        );

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


/**
 * Checks for an expired 'Off-Season Ends' timer and triggers the season rollover if found.
 * This can be called by a cron job or manually by an admin to force the transition.
 */
export async function checkAndExecuteSeasonRollover(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  // --- ADDED THIS HUGE LOG SO YOU CAN SEE IT IN YOUR SERVER CONSOLE ---
  console.log("======================================================");
  console.log("[RolloverCron] ⏰ EXECUTED: checkAndExecuteSeasonRollover()");
  console.log("======================================================");

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
    
    const { data: timer, error: timerError } = await supabase
      .from("countdown_timers")
      .select("id, end_time, title")
      .ilike("title", "%Offseason Curation%") 
      .eq("is_active", true)
      .single();

    if (timerError && timerError.code !== "PGRST116") {
      console.error("[RolloverCron] DB Error fetching timer:", timerError);
      throw new Error(`Database error checking timer: ${timerError.message}`);
    }

    if (!timer) {
      console.log("[RolloverCron] No active offseason timer found.");
      return { success: true, message: "No active postseason timer found. No action taken." };
    }

    const now = new Date();
    const endTime = new Date(timer.end_time);

    console.log(`[RolloverCron] Timer Found: '${timer.title}'. Ends at: ${endTime.toISOString()}`);

    if (now >= endTime) {
      console.log(`[RolloverCron] 🚨 Timer has expired! Triggering executeSeasonRollover()...`);
      
      // Also log it to the DB so you don't have to rely on Vercel logs
      await logSystemEvent("SeasonRollover", "info", `Cron detected expired timer. Starting rollover pipeline.`);
      
      const rolloverResult = await executeSeasonRollover();
      
      if (!rolloverResult.success) {
        throw new Error(rolloverResult.error || "Rollover function failed without a specific error.");
      }
      return { success: true, message: "Season rollover executed successfully." };
    } else {
      console.log(`[RolloverCron] ⏳ Timer still ticking. Exiting.`);
      return { success: true, message: `Timer '${timer.title}' has not expired yet.` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RolloverCheck] ❌ Failed to check or execute season rollover:", msg);
    
    // Log failure to DB
    await logSystemEvent("SeasonRollover", "error", `Cron check failed: ${msg}`);
    
    return { success: false, message: "Failed to process season rollover.", error: msg };
  }
}
