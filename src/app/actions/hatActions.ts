// src/app/actions/hatActions.ts
"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { createClient as createSupabaseClient } from "@supabase/supabase-js"; 

const REALLY_COOL_HAT_ID = 1;
const CURSED_WITCH_SKIN_HAT_ID = 2;
const OVERAGE_THRESHOLD = 10;

// --- NEW: The service client (bypasses cookies & RLS for background jobs) ---
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}
// ----------------------------------------------------------------------------

/**
 * Evaluates team spending at the end of a draft to award or remove hats.
 * Call this function when a Season Draft is marked as completed.
 */
export async function evaluateDraftHats(seasonId: string, theCap: number) {
  // FIXED: Uses your pre-configured zero-argument server client
  const supabase = await createServerClient();

  // 1. Get all teams and their total draft spend for the season
  const { data: draftSpends, error: spendError } = await supabase
    .from('team_draft_picks')
    .select('team_id, cubucks_cost')
    .eq('season_id', seasonId);

  if (spendError || !draftSpends) {
    console.error("Error fetching draft spends:", spendError);
    return { success: false, error: spendError?.message };
  }

  // Calculate total spend per team
  const teamTotals: Record<string, number> = {};
  draftSpends.forEach(pick => {
    teamTotals[pick.team_id] = (teamTotals[pick.team_id] || 0) + (pick.cubucks_cost || 0);
  });

  let furthestUnderCapTeam = null;
  let maxUnderCap = 0;
  let furthestOverCapTeam = null;
  let maxOverCap = 0;

  // 2. Identify the extremes
  for (const [teamId, totalSpend] of Object.entries(teamTotals)) {
    const difference = totalSpend - theCap;

    if (difference < 0) {
      // Under the cap
      const amountUnder = Math.abs(difference);
      if (amountUnder > maxUnderCap) {
        maxUnderCap = amountUnder;
        furthestUnderCapTeam = teamId;
      }
    } else if (difference > 0) {
      // Over the cap
      if (difference > maxOverCap) {
        maxOverCap = difference;
        furthestOverCapTeam = teamId;
      }
    }
  }

  // 3. Process "A Really Cool Hat"
  for (const [teamId, totalSpend] of Object.entries(teamTotals)) {
    if (totalSpend > theCap) {
      await supabase
        .from('team_hats')
        .delete()
        .match({ team_id: teamId, hat_id: REALLY_COOL_HAT_ID });
    }
  }

  if (furthestUnderCapTeam) {
    const { data: existingHat } = await supabase
      .from('team_hats')
      .select('quantity')
      .match({ team_id: furthestUnderCapTeam, hat_id: REALLY_COOL_HAT_ID })
      .single();

    if (existingHat) {
      await supabase
        .from('team_hats')
        .update({ quantity: existingHat.quantity + 1 })
        .match({ team_id: furthestUnderCapTeam, hat_id: REALLY_COOL_HAT_ID });
    } else {
      await supabase
        .from('team_hats')
        .insert({ team_id: furthestUnderCapTeam, hat_id: REALLY_COOL_HAT_ID, quantity: 1 });
    }
  }

  // 4. Process "Cursed Witch-Skin Hat"
  const { data: currentCursedHat } = await supabase
    .from('team_hats')
    .select('id, team_id, highest_overage')
    .eq('hat_id', CURSED_WITCH_SKIN_HAT_ID)
    .single();

  if (currentCursedHat && teamTotals[currentCursedHat.team_id] <= theCap) {
    await supabase.from('team_hats').delete().eq('id', currentCursedHat.id);
  }

  if (maxOverCap >= OVERAGE_THRESHOLD && furthestOverCapTeam) {
    const currentHighestOverage = currentCursedHat?.highest_overage || 0;

    if (!currentCursedHat || maxOverCap > currentHighestOverage) {
      
      if (currentCursedHat && currentCursedHat.team_id !== furthestOverCapTeam) {
        await supabase.from('team_hats').delete().eq('id', currentCursedHat.id);
        
        const { data: globalHat } = await supabase.from('hats').select('hatLevel').eq('hatId', CURSED_WITCH_SKIN_HAT_ID).single();
        if (globalHat) {
          await supabase.from('hats').update({ hatLevel: (globalHat.hatLevel || 1) + 1 }).eq('hatId', CURSED_WITCH_SKIN_HAT_ID);
        }
      }

      await supabase
        .from('team_hats')
        .upsert({ 
          team_id: furthestOverCapTeam, 
          hat_id: CURSED_WITCH_SKIN_HAT_ID, 
          quantity: 1,
          highest_overage: maxOverCap
        }, { onConflict: 'team_id, hat_id' });
    }
  }

  return { success: true };
}

/**
 * Calculates the adjusted cost of a team's FIRST draft pick based on the hats they wear.
 */
export async function applyHatModifier(teamId: string, originalCost: number, adminClient?: AnySupabaseClient): Promise<number> {
  // Use the service client fallback here so cron jobs don't crash!
  const supabase = adminClient ?? createServiceClient();

  const { data: teamHats, error } = await supabase
    .from('team_hats')
    .select(`
      quantity,
      hats ( hatId, hatLevel )
    `)
    .eq('team_id', teamId);

  if (error || !teamHats || teamHats.length === 0) {
    return originalCost; 
  }

  let finalCost = originalCost;

  for (const th of teamHats) {
    const hat = Array.isArray(th.hats) ? th.hats[0] : th.hats;
    if (!hat) continue;

    if (hat.hatId === REALLY_COOL_HAT_ID) {
      finalCost -= (1 * th.quantity);
    } 
    else if (hat.hatId === CURSED_WITCH_SKIN_HAT_ID) {
      finalCost += (1 * (hat.hatLevel || 1));
    }
  }

  return Math.max(1, finalCost);
}

/**
 * Helper to fetch a team's current hats to display on their profile or draft page.
 */
export async function getTeamHats(teamId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('team_hats')
    .select(`
      quantity,
      hats ( hatId, hatName, hatLevel )
    `)
    .eq('team_id', teamId);

  if (error) {
    console.error("Error fetching team hats:", error);
    return [];
  }
  
  return data;
}
