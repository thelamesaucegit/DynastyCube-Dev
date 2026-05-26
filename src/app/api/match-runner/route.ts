// src/app/api/match-runner/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return _supabaseAdmin;
}

export async function POST(request: Request): Promise<NextResponse> {
    let scheduleId: string | undefined;
    try {
        const body = await request.json();
        
        const { 
            team1Id, team2Id, 
            deck1, deck2,
            deck1Override, deck2Override,
            team1AiProfile, team2AiProfile,
            scheduleId: reqScheduleId,
            team1_name, team1_color, team1_seccolor,
            team2_name, team2_color, team2_seccolor
        } = body;

        scheduleId = reqScheduleId;
        
        console.log(`\n[Match-Runner API] 🚀 MATCH RECEIVED! Schedule ID: ${scheduleId}`);
        console.log(`[Match-Runner API] Teams: ${team1_name} vs ${team2_name}`);

        if (!team1Id || !team2Id) {
            console.error(`[Match-Runner API] ❌ Missing Team IDs`);
            return NextResponse.json({ error: "Missing team1Id or team2Id" }, { status: 400 });
        }

        const finalDeck1Content = deck1?.content ?? deck1Override;
        const finalDeck2Content = deck2?.content ?? deck2Override;
        const finalProfile1 = deck1?.aiProfile ?? team1AiProfile;
        const finalProfile2 = deck2?.aiProfile ?? team2AiProfile;

        if (!finalDeck1Content || !finalDeck2Content || !finalProfile1 || !finalProfile2) {
            console.error(`[Match-Runner API] ❌ Missing deck content or AI profile!`);
            return NextResponse.json({ error: "Missing deck content or AI profile" }, { status: 400 });
        }

        console.log(`[Match-Runner API] Inserting into sim_matches...`);

        // 1. Create the sim_matches record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: simMatch, error: simErr } = await (getSupabaseAdmin() as any)
            .from('sim_matches')
            .insert({
                player1_info: `${team1Id} (AI: ${finalProfile1})`,
                player2_info: `${team2Id} (AI: ${finalProfile2})`,
                team1_id: team1Id,
                team2_id: team2Id,
                deck1_list: finalDeck1Content,
                deck2_list: finalDeck2Content,
                team1_name, team1_color, team1_seccolor,
                team2_name, team2_color, team2_seccolor,
            })
            .select('id')
            .single();

        if (simErr || !simMatch) {
            throw new Error(`sim_matches insert failed: ${simErr?.message}`);
        }

        const matchId = simMatch.id;
        console.log(`[Match-Runner API] Successfully created sim_match_id: ${matchId}`);

        // 2. Send to sim server
        const simServerUrl = process.env.SIM_SERVER_URL ?? 'http://localhost:3001';
        console.log(`[Match-Runner API] Pinging ForgeSim Server at: ${simServerUrl}/run-match`);

        const simRes = await fetch(`${simServerUrl}/run-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                matchId, team1Id, team2Id,
                profile1: finalProfile1,
                profile2: finalProfile2,
                deck1: finalDeck1Content,
                deck2: finalDeck2Content,
            }),
        });

        if (!simRes.ok) {
            const errBody = await simRes.text().catch(() => '');
            throw new Error(`Sim server rejected match: HTTP ${simRes.status} ${errBody}`);
        }

        console.log(`[Match-Runner API] ForgeSim accepted the match! Updating schedule status...`);

        // 3. Conditionally update the schedule table
        if (scheduleId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: schedErr } = await (getSupabaseAdmin() as any)
                .from('schedule')
                .update({ status: 'in_progress', sim_match_id: matchId })
                .eq('id', scheduleId)
                .eq('status', 'validated');

            if (schedErr) {
                console.error(`[Match-Runner API] Schedule update failed for ${scheduleId}:`, schedErr);
            }
        }

        console.log(`[Match-Runner API] ✅ Process complete for schedule ${scheduleId}\n`);
        return NextResponse.json({ success: true, matchId });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`\n[Match-Runner API] ❌ ERROR for schedule ${scheduleId ?? 'manual run'}:`, msg);
        
        if (scheduleId) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             await (getSupabaseAdmin() as any).from('schedule').update({ status: 'validated' }).eq('id', scheduleId);
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
