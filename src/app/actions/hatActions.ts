// src/app/actions/hatActions.ts
"use server";

import { cookies } from "next/headers";
import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { createClient as createSupabaseClient } from "@supabase/supabase-js"; // <-- Add this import

const REALLY_COOL_HAT_ID = 1;
const CURSED_WITCH_SKIN_HAT_ID = 2;
const OVERAGE_THRESHOLD = 10;

// The standard client (requires a user session / request scope)
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
  const supabase = await createClient();

  // 1. Get all teams and their total draft spend for the season
  // Note: Adjust the table/column names based on where your draft picks are stored
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
  // Remove hats from teams that exceeded the cap
  for (const [teamId, totalSpend] of Object.entries(teamTotals)) {
    if (totalSpend > theCap) {
      await supabase
        .from('team_hats')
        .delete()
        .match({ team_id: teamId, hat_id: REALLY_COOL_HAT_ID });
    }
  }

  // Award a new Really Cool Hat to the team furthest under the cap
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
  // If the CURRENT wearer finished UNDER the cap, they are cured!
  const { data: currentCursedHat } = await supabase
    .from('team_hats')
    .select('id, team_id, highest_overage')
    .eq('hat_id', CURSED_WITCH_SKIN_HAT_ID)
    .single();

  if (currentCursedHat && teamTotals[currentCursedHat.team_id] <= theCap) {
    await supabase.from('team_hats').delete().eq('id', currentCursedHat.id);
  }

  // Check if a new team inherits the curse
  if (maxOverCap >= OVERAGE_THRESHOLD && furthestOverCapTeam) {
    const currentHighestOverage = currentCursedHat?.highest_overage || 0;

    // If there is no wearer, or the new team exceeded the cap by a LARGER margin
    if (!currentCursedHat || maxOverCap > currentHighestOverage) {
      
      // If someone currently has it, remove it from them and level up the hat
      if (currentCursedHat && currentCursedHat.team_id !== furthestOverCapTeam) {
        await supabase.from('team_hats').delete().eq('id', currentCursedHat.id);
        
        // Level up the global hat
        const { data: globalHat } = await supabase.from('hats').select('hatLevel').eq('hatId', CURSED_WITCH_SKIN_HAT_ID).single();
        if (globalHat) {
          await supabase.from('hats').update({ hatLevel: (globalHat.hatLevel || 1) + 1 }).eq('hatId', CURSED_WITCH_SKIN_HAT_ID);
        }
      }

      // Give it to the new team (or update the current wearer's overage if they broke their own record)
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
 * Call this function during the draft when processing a team's first pick of the season.
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
    return originalCost; // No hats, no changes
  }

  let finalCost = originalCost;

  for (const th of teamHats) {
    const hat = Array.isArray(th.hats) ? th.hats[0] : th.hats;
    if (!hat) continue;

    if (hat.hatId === REALLY_COOL_HAT_ID) {
      // Reduce cost by 1 for every Really Cool Hat they own
      finalCost -= (1 * th.quantity);
    } 
    else if (hat.hatId === CURSED_WITCH_SKIN_HAT_ID) {
      // Increase cost by 1 for each level of the Cursed Hat
      finalCost += (1 * (hat.hatLevel || 1));
    }
  }

  // The Really Cool Hat cannot reduce a card's value below Ç1
  return Math.max(1, finalCost);
}


/**
 * Helper to fetch a team's current hats to display on their profile or draft page.
 */
export async function getTeamHats(teamId: string) {
  const supabase = await createClient();

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
