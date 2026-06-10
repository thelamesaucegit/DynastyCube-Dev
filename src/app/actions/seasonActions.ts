// src/app/actions/seasonActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { importNextSetToChamber } from "./chamberActions";
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
    let newSeasonId: string | null = null;
    
    try {
        // --- STEP 0: BACKUP THE DATABASE STATE ---
        console.log("[SeasonRollover] 💾 Creating database staging snapshot...");
        const { error: backupErr } = await supabase.rpc('backup_rollover_state');
        if (backupErr) throw new Error(`Failed to create staging snapshot: ${backupErr.message}`);

        // =====================================================================
        // --- EXECUTE THE VALVE ---
        // =====================================================================
        console.log("[SeasonRollover] Checking for Valve Vote...");
        try {
            const { data: valvePoll } = await supabase
                .from('polls')
                .select('id')
                .eq('title', 'THE VALVE')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let releaseValve = false;

            if (valvePoll) {
                const { data: options } = await supabase.from('poll_options').select('id, option_text').eq('poll_id', valvePoll.id);
                const { data: votes } = await supabase.from('poll_votes').select('option_id, vote_weight').eq('poll_id', valvePoll.id);
                
                if (options && votes) {
                    let releaseVotes = 0;
                    let shutVotes = 0;
                    
                    const releaseOptId = options.find(o => o.option_text === "RELEASE THE VALVE")?.id;
                    const shutOptId = options.find(o => o.option_text === "LEAVE THE VALVE SHUT")?.id;

                    votes.forEach(v => {
                        if (v.option_id === releaseOptId) releaseVotes += (v.vote_weight || 1);
                        if (v.option_id === shutOptId) shutVotes += (v.vote_weight || 1);
                    });

                    if (releaseVotes > shutVotes) releaseValve = true;
                }
                
                await supabase.from('polls').update({ is_active: false }).eq('id', valvePoll.id);
            }

            const { data: purgedCard, error: valveErr } = await supabase.rpc('execute_the_valve', {
                p_release: releaseValve
            });

            if (valveErr) throw new Error(valveErr.message);

            if (releaseValve && purgedCard) {
                console.log(`[SeasonRollover] 🚨 THE VALVE WAS RELEASED! Purged: ${purgedCard}`);
                await logSystemEvent("TheValve", "info", `The Valve was released! ${purgedCard} was retired from the Cube.`);
            } else {
                console.log(`[SeasonRollover] 🔒 The Valve remained shut (or no card was nominated). Accumulating pressure.`);
            }
        } catch (valveCatchErr) {
            console.error("[SeasonRollover] Error executing The Valve:", valveCatchErr);
            await logSystemEvent("TheValve", "warn", `Error executing The Valve logic`, { error: String(valveCatchErr) });
        }

        // =====================================================================
        // --- STEP 1: IDENTIFY OLD & CREATE NEW SEASON ---
        const { data: oldSeason, error: oldSeasonErr } = await supabase.from('seasons').select('*').eq('is_active', true).single();
        if (oldSeasonErr || !oldSeason) throw new Error(`Could not find active season. DB Error: ${JSON.stringify(oldSeasonErr)}`);
        
        const nextSeasonNumber = oldSeason.season_number + 1;
        const isTestSeason = oldSeason.season_name.toUpperCase().includes("TEST");
        const nextSeasonName = isTestSeason ? `Test Season ${nextSeasonNumber}` : `Season ${nextSeasonNumber}`;
        
        console.log(`[SeasonRollover] Building ${nextSeasonName}...`);
        
        const { error: deactivateErr } = await supabase.from('seasons').update({ is_active: false }).eq('id', oldSeason.id);
        if (deactivateErr) throw new Error(`Failed to deactivate old season: ${JSON.stringify(deactivateErr)}`);
        
        const now = new Date();
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
            cubucks_allocation: oldSeason.cubucks_allocation || 40 
        }).select('id').single();
        
        if (seasonErr || !newSeason) throw new Error(`Failed to create new season: ${JSON.stringify(seasonErr)}`);
        newSeasonId = newSeason.id; 

        // =====================================================================
        // --- ESCAPE ROOM: CALCULATE COST & PROTECT CARDS ---
        // =====================================================================
        const escapeCardCost = Math.max(3, Math.ceil((oldSeason.cubucks_allocation || 40) * 0.05));
        console.log(`[SeasonRollover] Escape Room cards will be priced at ${escapeCardCost} Çubucks.`);

        const { error: protectErr } = await supabase
            .from('team_draft_picks')
            .update({ is_keeper: true })
            .contains('scars', ['escape']);

        if (protectErr) console.error("[SeasonRollover] Failed to protect escape cards:", protectErr);

        // =====================================================================
               // =====================================================================
        // --- STEP 2: ROLLOVER COSTS & NATURAL RETIREMENT ---
        console.log("[SeasonRollover] Running Cost Economy & Retirements...");
        const { error: costErr } = await supabase.rpc('rollover_season_costs', { p_new_season_id: newSeason.id, p_previous_season_id: oldSeason.id });
        if (costErr) throw new Error(`Cost Rollover RPC failed: ${costErr.message}`);

        // THE FIX 1: Run natural Free Agency purge (Drops 0-cost cards immediately)
        console.log("[SeasonRollover] Processing Natural Free Agency (0-cost cards)...");
        const { error: natFreeErr } = await supabase.rpc('process_natural_free_agency');
        if (natFreeErr) throw new Error(`Natural Free Agency RPC failed: ${natFreeErr.message}`);

        // =====================================================================
        // --- STEP 3: PROMOTE EXISTING STAGING POOLS ---
        // We do this BEFORE culling so all survivors consolidate into 'draft'
        console.log("[SeasonRollover] Promoting Wire back to Draft...");
        const { error: promoteErr } = await supabase.rpc('promote_staging_pools');
        if (promoteErr) throw new Error(`Promote Staging Pools RPC failed: ${promoteErr.message}`);


       // =====================================================================
        // --- NEW META EVENT: THE RAT PLAGUE ---
        // =====================================================================
        console.log("[SeasonRollover] 🐀 Executing The Rat Plague (Cloning rats)...");
        try {
            const { error: ratErr } = await supabase.rpc('execute_rat_plague');
            if (ratErr) {
                console.warn("[SeasonRollover] ⚠️ Rat Plague encountered an error:", ratErr.message);
                await logSystemEvent("SeasonRollover", "warn", `Rat plague execution failed: ${ratErr.message}`);
            } else {
                await logSystemEvent("SeasonRollover", "info", `The Rat Plague executed successfully. The swarm grows.`);
            }
        } catch (ratCatchErr) {
            console.error("[SeasonRollover] Failed to execute Rat Plague:", ratCatchErr);
        }

        // =====================================================================
        // --- STEP 4: CULL POOLS TO MAKE ROOM FOR THE CHAMBER ---
        // Now that Draft holds exactly the survivors, we trim the fat if needed.
        console.log("[SeasonRollover] Culling lowest ELO cards to ensure 600 cap...");
        const { error: cullErr } = await supabase.rpc('cull_pools_for_chamber');
        if (cullErr) throw new Error(`Cull Pools RPC failed: ${cullErr.message}`);

        // =====================================================================
        // --- STEP 5: FLUSH THE CHAMBER TABLE ---
        console.log("[SeasonRollover] Flushing The Chamber to Card Pools...");
        const { error: flushErr } = await supabase.rpc('flush_chamber_to_pools');
        if (flushErr) throw new Error(`Flush Chamber RPC failed: ${flushErr.message}`);

        // =====================================================================
        // --- ESCAPE ROOM: DOWNGRADE TO TEMPORARY & SPIKE COSTS ---
        // =====================================================================
        console.log(`[SeasonRollover] Downgrading Escape cards to Temporary...`);
        const { data: survivingEscapes } = await supabase
            .from('team_draft_picks')
            .select('id, card_pool_id')
            .contains('scars', ['escape']);

        if (survivingEscapes && survivingEscapes.length > 0) {
            const pickIds = survivingEscapes.map(p => p.id);
            const poolIds = survivingEscapes.map(p => p.card_pool_id);

            await supabase.from('team_draft_picks')
                .update({ cubucks_cost: escapeCardCost, scars: ['temporary'] })
                .in('id', pickIds);

            await supabase.from('card_pools')
                .update({ cubucks_cost: escapeCardCost, scars: ['temporary'] })
                .in('id', poolIds);
                
            console.log(`[SeasonRollover] Successfully transitioned ${survivingEscapes.length} Escape cards.`);
        }

        // --- RESET TEAM STATUSES ---
        console.log("[Rollover] Resetting team 'is_escaped' and 'locked_in' statuses...");
        const { error: resetTeamsError } = await supabase.from('teams').update({ is_escaped: false, locked_in: false }).not('id', 'is', null);
        if (resetTeamsError) throw new Error(`Failed to reset team status: ${resetTeamsError.message}`);


        // =====================================================================
        // --- STEP 6: CALCULATE AND SET DYNAMIC CAP ---
        console.log("[SeasonRollover] Calculating dynamic salary cap...");
        const { data: dynamicCap, error: capErr } = await supabase.rpc('update_season_dynamic_cap', { p_season_id: newSeason.id });
        if (capErr) throw new Error(`Dynamic Cap RPC failed: ${capErr.message}`);
        console.log(`[SeasonRollover] 💰 Dynamic Cap set to: ${dynamicCap} Cubucks`);

        // --- STEP 6.5: ALLOCATE TEAM BUDGETS ---
        console.log("[SeasonRollover] Allocating budgets to teams...");
        const { error: allocErr } = await supabase.rpc('allocate_season_budgets', { p_season_id: newSeason.id });
        if (allocErr) throw new Error(`Budget Allocation RPC failed: ${allocErr.message}`);
        console.log("[SeasonRollover] 🏦 Team budgets allocated and ledger updated.");
      
        // --- STEP 7: REFILL THE CHAMBER & BACKFILL METADATA ---
        console.log("[SeasonRollover] Refilling The Chamber...");
        const importResult = await importNextSetToChamber();
        if (!importResult.success) {
            console.warn("[SeasonRollover] Chamber import returned an issue:", importResult.message);
        } else {
            console.log("[SeasonRollover] Chamber refilled! Backfilling metadata...");
            const { updateAllCubecobraElo } = await import('@/app/actions/cardRatingActions');
            const { backfillOracleData, backfillColorIdentity, backfillCMCForCardPools } = await import('@/app/actions/adminActions');
            await updateAllCubecobraElo('the_chamber');
            await backfillOracleData('the_chamber');
            await backfillColorIdentity('the_chamber');
            await backfillCMCForCardPools('the_chamber');
            
            console.log("[SeasonRollover] Metadata backfill complete for new chamber set.");
        }

        // =====================================================================
        // --- STEP 7.5: ROTATE THE RESORT POOL ---
        // =====================================================================
        console.log("[SeasonRollover] Rotating the Resort Pool...");
        try {
            await supabase.from('resort_pool').update({ hidden: true }).eq('hidden', false);
            const { data: allResortIds } = await supabase.from('resort_pool').select('id');
            
            if (allResortIds && allResortIds.length > 0) {
                const shuffled = allResortIds.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, 20).map(card => card.id);
                const { error: revealErr } = await supabase
                    .from('resort_pool')
                    .update({ hidden: false })
                    .in('id', selected);
                if (revealErr) throw new Error(revealErr.message);
                console.log(`[SeasonRollover] Successfully revealed 20 random Resort Pool lands!`);
            }
        } catch (resortErr) {
            console.error("[SeasonRollover] Failed to rotate Resort Pool:", resortErr);
        }

        // =====================================================================
        // --- STEP 8: DRAFT ORDER & SCHEDULING ---
        console.log("[SeasonRollover] Generating Draft Order...");
        
        const draftOrderResult = await generateDraftOrder(newSeason.id, { 
            orderType: 'previous_season',
            systemOverride: true 
        });
        
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
        console.error(`[SeasonRollover] ❌ PIPELINE FAILED: ${msg}`);
        
        try {
            console.log("[SeasonRollover] 🚨 Triggering Staging Rollback...");
            await supabase.rpc('restore_rollover_state', { p_failed_season_id: newSeasonId });
            await supabase.from('seasons').update({ is_active: true }).eq('is_active', false).order('season_number', { ascending: false }).limit(1);
            await supabase
                .from('countdown_timers')
                .update({ title: 'BLOCKED: Offseason Curation (See Logs)' })
                .eq('title', 'Offseason Curation & Next Draft') 
                .eq('is_active', true);
            console.log("[SeasonRollover] ✅ Rollback Complete. Cron Job Blocked.");
        } catch (rollbackErr) {
            console.error("[SeasonRollover] 💀 FATAL: Rollback Failed!", rollbackErr);
        }

        await logSystemEvent('SeasonRollover', 'error', `Pipeline Failed: ${msg}`, { timestamp: new Date().toISOString() });
        return { success: false, error: msg };
    }
}

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { authorized: false, error: "Not authenticated" };

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.is_admin) return { authorized: false, userId: user.id, error: "Unauthorized: Admin access required" };

  return { authorized: true, userId: user.id };
}

export async function getWeekIdByNumber(
    seasonNumber: number,
    weekNumber: number
): Promise<{ weekId: string | null; error?: string }> {
    const supabase = await createServerClient(); 
    try {
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select('id')
            .eq('season_number', seasonNumber)
            .single();

        if (seasonError || !season) return { weekId: null, error: `Season ${seasonNumber} not found.` };

        const { data: week, error: weekError } = await supabase
            .from('schedule_weeks')
            .select('id')
            .eq('season_id', season.id)
            .eq('week_number', weekNumber)
            .single();

        if (weekError || !week) return { weekId: null, error: `Week ${weekNumber} not found in season ${seasonNumber}.` };

        return { weekId: week.id, error: undefined };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        return { weekId: null, error: message };
    }
}

export async function deleteFullSeason(seasonId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient(); 
    const admin = await verifyAdmin(supabase); 
    if (!admin.authorized) return { success: false, error: admin.error };

    const { error } = await supabase.from("seasons").delete().eq("id", seasonId);
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

export async function rolloverSeasonCosts(newSeasonId: string, previousSeasonId?: string): Promise<{ success: boolean; changes?: CardCostChange[]; error?: string; }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("rollover_card_costs_for_new_season", {
      p_new_season_id: newSeasonId,
      p_previous_season_id: previousSeasonId || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, changes: data || [] };
  } catch (error) {
    console.error("Unexpected error rolling over costs:", error);
    return { success: false, error: String(error) };
  }
}

export async function initializeSeasonCosts(): Promise<{ success: boolean; error?: string; }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("initialize_season_card_costs");
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getCardPricingHistory(cardPoolId?: string): Promise<{
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
    if (cardPoolId) query = query.eq("card_pool_id", cardPoolId);

    const { data, error } = await query.order("card_name").order("season_number");
    if (error) return { history: [], error: error.message };
    return { history: data || [] };
  } catch (error) {
    return { history: [], error: String(error) };
  }
}

export async function getSeasonCostSummary(seasonId: string): Promise<{
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

    if (error) return { summary: null, error: error.message };

    if (!data || data.length === 0) {
      return { summary: { total_cards: 0, drafted_cards: 0, undrafted_cards: 0, avg_cost: 0, max_cost: 0, min_cost: 0 } };
    }

    const summary = {
      total_cards: data.length,
      drafted_cards: data.filter((c) => c.was_drafted).length,
      undrafted_cards: data.filter((c) => !c.was_drafted).length,
      avg_cost: Math.round(data.reduce((sum, c) => sum + c.cost, 0) / data.length),
      max_cost: Math.max(...data.map((c) => c.cost)),
      min_cost: Math.min(...data.map((c) => c.cost)),
    };

    return { summary };
  } catch (error) {
    return { summary: null, error: String(error) };
  }
}

export async function getCardsByCostRange(minCost: number, maxCost: number): Promise<{
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

    if (error) return { cards: [], error: error.message };
    return { cards: data || [] };
  } catch (error) {
    return { cards: [], error: String(error) };
  }
}

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

    if (error && error.code !== "PGRST116") return { season: null, error: error.message };
    return { season: data || null };
  } catch (error) {
    return { season: null, error: String(error) };
  }
}

// =============================================================================
// PHASE TRANSITION: SEASON -> PLAYOFFS
// =============================================================================
export async function checkAndExecuteSeasonToPlayoffTransition(): Promise<{ success: boolean; transitioned: boolean; error?: string }> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name, phase")
      .eq("is_active", true)
      .single();

    if (seasonError || !season) return { success: false, transitioned: false, error: "No active season found." };
    if (season.phase !== "season") return { success: true, transitioned: false }; 

    const { data: finalWeek, error: weekError } = await supabase
      .from("schedule_weeks")
      .select("id, end_date, match_completion_deadline")
      .eq("season_id", season.id)
      .eq("week_number", 6)
      .single();

    if (weekError || !finalWeek) return { success: false, transitioned: false, error: "Final regular season week metadata unavailable." };

    const now = new Date();
    const deadline = new Date(finalWeek.match_completion_deadline || finalWeek.end_date);

    if (now >= deadline) {
      console.log(`[CronPhase] Final regular season week has ended. Transitioning ${season.season_name} to Playoffs!`);
      await logSystemEvent("SeasonRollover", "info", `Chronological regular season deadline reached. Initiating playoff phase.`);

      const { count: unfinishedCount } = await supabase
          .from("weekly_matchups")
          .select("id", { count: 'exact', head: true })
          .eq("season_id", season.id)
          .eq("is_playoff", false)
          .eq("is_outcome_final", false);

      if (unfinishedCount && unfinishedCount > 0) {
          console.warn(`[CronPhase] Warning: Phase transition reached, but ${unfinishedCount} matchups are still unfinished.`);
      }

      const isTestSeason = season.season_name.toUpperCase().includes("TEST");
      const { generateInitialPlayoffBracket } = await import("@/app/actions/weeklyMatchupActions");
      
      await generateInitialPlayoffBracket(season.id, isTestSeason);
      console.log(`[CronPhase] Playoff bracket successfully generated.`);
      return { success: true, transitioned: true };
    }

    return { success: true, transitioned: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CronPhase] Error running Playoff Transition check:", msg);
    await logSystemEvent("SeasonRollover", "error", `Playoff phase transition failed: ${msg}`);
    return { success: false, transitioned: false, error: msg };
  }
}

// =============================================================================
// THE FIX: NEW PHASE TRANSITION: PLAYOFFS -> POSTSEASON
// =============================================================================
export async function checkAndExecutePlayoffsToPostseasonTransition(): Promise<{ success: boolean; transitioned: boolean; error?: string }> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // 1. Get the current active season
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name, phase")
      .eq("is_active", true)
      .single();

    if (seasonError || !season) return { success: false, transitioned: false, error: "No active season found." };
    if (season.phase !== "playoffs") return { success: true, transitioned: false }; 

    // 2. Find the Championship week (is_championship_week = true)
    const { data: champWeek, error: weekError } = await supabase
      .from("schedule_weeks")
      .select("id, end_date, match_completion_deadline")
      .eq("season_id", season.id)
      .eq("is_championship_week", true)
      .single();

    // If the championship week isn't scheduled yet, we can't transition
    if (weekError || !champWeek) return { success: true, transitioned: false };

    const now = new Date();
    const deadline = new Date(champWeek.match_completion_deadline || champWeek.end_date);

    // 3. Wait until the championship schedule week has chronologically concluded
    if (now >= deadline) {
      console.log(`[CronPhase] Championship week has ended. Transitioning ${season.season_name} to Postseason!`);
      await logSystemEvent("SeasonRollover", "info", `Championship deadline reached. Initiating postseason transition.`);

      // Verify no games are pending as a failsafe
      const { count: unfinishedCount } = await supabase
          .from("weekly_matchups")
          .select("id", { count: 'exact', head: true })
          .eq("season_id", season.id)
          .eq("is_championship_week", true) // Assuming it uses the boolean, or just checks week_id
          .eq("is_outcome_final", false);

      if (unfinishedCount && unfinishedCount > 0) {
          console.warn(`[CronPhase] Warning: Championship transition reached, but matchups are still unfinished.`);
      }

      // Fire the advancePlayoffBracket function to grant the valve, set the phase, and generate the timer
      const isTestSeason = season.season_name.toUpperCase().includes("TEST");
      const { advancePlayoffBracket } = await import("@/app/actions/weeklyMatchupActions");
      
      await advancePlayoffBracket(season.id, isTestSeason);
      console.log(`[CronPhase] Postseason successfully triggered.`);
      return { success: true, transitioned: true };
    }

    return { success: true, transitioned: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CronPhase] Error running Postseason Transition check:", msg);
    await logSystemEvent("SeasonRollover", "error", `Postseason phase transition failed: ${msg}`);
    return { success: false, transitioned: false, error: msg };
  }
}

// =============================================================================
// THE MASTER CRON SCHEDULER
// =============================================================================
export async function checkAndExecuteSeasonRollover(): Promise<{ success: boolean; message: string; error?: string; }> {
  console.log("======================================================");
  console.log("[RolloverCron] ⏰ EXECUTED: checkAndExecuteSeasonRollover()");
  console.log("======================================================");
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
    
    // --- STEP 1: RUN THE PLAYOFF PHASE TRANSITION HANDLER ---
    const playoffTransitionCheck = await checkAndExecuteSeasonToPlayoffTransition();
    if (playoffTransitionCheck.success && playoffTransitionCheck.transitioned) {
        return { success: true, message: "Season successfully advanced to the Playoff phase." };
    }

    // --- STEP 2: THE FIX - RUN THE POSTSEASON PHASE TRANSITION HANDLER ---
    const postseasonTransitionCheck = await checkAndExecutePlayoffsToPostseasonTransition();
    if (postseasonTransitionCheck.success && postseasonTransitionCheck.transitioned) {
        return { success: true, message: "Season successfully advanced to the Postseason phase and timer generated." };
    }

    // --- STEP 3: RUN THE STANDARD OFFSEASON ROLLOVER TIMER ---
    const { data: timer, error: timerError } = await supabase
      .from("countdown_timers")
      .select("id, end_time, title")
      .eq("title", "Offseason Curation & Next Draft") 
      .eq("is_active", true)
      .single();

    if (timerError && timerError.code !== "PGRST116") throw new Error(`Database error checking timer: ${timerError.message}`);
    if (!timer) return { success: true, message: "No active postseason timer found. No action taken." };

    const now = new Date();
    const endTime = new Date(timer.end_time);
    console.log(`[RolloverCron] Timer Found: '${timer.title}'. Ends at: ${endTime.toISOString()}`);
    
    if (now >= endTime) {
      console.log(`[RolloverCron] 🚨 Timer has expired! Triggering executeSeasonRollover()...`);
      await logSystemEvent("SeasonRollover", "info", `Cron detected expired timer. Starting rollover pipeline.`);
      
      const rolloverResult = await executeSeasonRollover();
      if (!rolloverResult.success) throw new Error(rolloverResult.error || "Rollover function failed without a specific error.");
      return { success: true, message: "Season rollover executed successfully." };
    } else {
      console.log(`[RolloverCron] ⏳ Timer still ticking. Exiting.`);
      return { success: true, message: `Timer '${timer.title}' has not expired yet.` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RolloverCheck] ❌ Failed to check or execute season rollover:", msg);
    await logSystemEvent("SeasonRollover", "error", `Cron check failed: ${msg}`);
    return { success: false, message: "Failed to process season rollover.", error: msg };
  }
}


/**
 * Admin action to force the Day/Night status of the active season
 */
export async function setSeasonDayNightStatus(
  status: 'day' | 'night' | 'neutral',
  overrideLock: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };

    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!activeSeason) return { success: false, error: "No active season found." };

    const { error } = await supabase
      .from("seasons")
      .update({ 
          day_night_status: status,
          day_night_override: overrideLock 
      })
      .eq("id", activeSeason.id);

    if (error) throw error;
    
    // Optional: Log the lore event!
    const { logSystemEvent } = await import("@/lib/systemLogger");
    await logSystemEvent("AdminAction", "info", `Admin forced Day/Night status to ${status} (Override: ${overrideLock})`);

    return { success: true };
  } catch (error) {
    console.error("Error setting Day/Night status:", error);
    return { success: false, error: String(error) };
  }
}
