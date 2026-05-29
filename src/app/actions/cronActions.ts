// src/app/actions/cronActions.ts
"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { executeSeasonRollover } from "./seasonActions";
import { advancePlayoffBracket } from "./weeklyMatchupActions";
import { logSystemEvent } from "@/lib/systemLogger";

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * Main cron handler, runs every minute. Checks for completed weeks or playoffs.
 */
export async function handleAdvanceWeekCron() {
  const supabase = createAdminClient();
  
  // 1. Find the active season
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('id, phase')
    .eq('is_active', true)
    .single();

  if (!activeSeason) {
    return { status: "skipped", details: "No active season." };
  }

  // We only care about 'season' or 'playoffs' phase for this cron
  if (activeSeason.phase !== 'season' && activeSeason.phase !== 'playoffs') {
      return { status: "skipped", details: `Season in ${activeSeason.phase} phase.` };
  }

  // 2. Find the current or most recently completed week
  const { data: latestWeek } = await supabase
    .from('schedule_weeks')
    .select('id, end_date, is_playoff_week')
    .eq('season_id', activeSeason.id)
    .lte('start_date', new Date().toISOString())
    .order('start_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestWeek) {
    return { status: "skipped", details: "No current week found for active season." };
  }

  // 3. Check if the week has ended
  const now = new Date();
  const weekEnd = new Date(latestWeek.end_date);

  if (now > weekEnd) {
    // 4. Check if all matches in that week are 'completed'
    const { count, error } = await supabase
      .from('schedule')
      .select('*', { count: 'exact', head: true })
      .eq('week_id', latestWeek.id)
      .not('status', 'eq', 'completed');

    if (error) {
        await logSystemEvent('CronError', 'error', 'Failed to check match statuses for week advance', { weekId: latestWeek.id, error: error.message });
        return { status: "error", details: "DB error checking match status." };
    }

    // If there are 0 non-completed matches, it's time to advance!
    if (count === 0) {
      await logSystemEvent('CronAdvance', 'info', `All matches for week ${latestWeek.id} complete. Advancing playoffs/season.`);
      
      // This function now handles both regular season and playoff advancement, including the final transition to offseason
      await advancePlayoffBracket(latestWeek.id, supabase);

      return { status: "processed", details: `Advanced from week ${latestWeek.id}.` };
    }
  }

  return { status: "skipped", details: "Current week has not concluded or matches are pending." };
}


/**
 * Cron handler for the offseason timer. Runs every minute.
 */
export async function handleOffseasonRolloverCron(): Promise<{ status: string; details: string; }> {
    const supabase = createAdminClient();

    // Find the active offseason timer
    const { data: timer, error } = await supabase
        .from('countdown_timers')
        .select('id, end_time')
        .eq('is_active', true)
        .ilike('title', '%Offseason%') // Target our specific timer
        .single();

    if (error || !timer) {
        return { status: 'skipped', details: 'No active offseason timer found.' };
    }

    // Check if the timer has expired
    const now = new Date();
    const endTime = new Date(timer.end_time);

    if (now >= endTime) {
        await logSystemEvent('CronRollover', 'info', 'Offseason timer expired. Initiating season rollover.');
        
        // Deactivate the timer first to prevent re-runs
        await supabase.from('countdown_timers').update({ is_active: false }).eq('id', timer.id);

        // Execute the grand rollover function!
        await executeSeasonRollover();

        return { status: 'processed', details: 'Season rollover executed.' };
    }

    return { status: 'skipped', details: 'Offseason timer has not yet expired.' };
}
