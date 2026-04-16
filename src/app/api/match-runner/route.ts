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
        
        // --- THIS IS THE FIX ---
        // Correctly destructure all possible fields from the top-level body
        const { 
            team1Id, team2Id, 
            deck1, deck2,
            deck1Override, deck2Override,
            team1AiProfile, team2AiProfile,
            scheduleId: reqScheduleId 
        } = body;
        // --- END FIX ---

        scheduleId = reqScheduleId;

        // The core validation remains the same
        if (!team1Id || !team2Id) {
            return NextResponse.json({ error: "Missing team1Id or team2Id" }, { status: 400 });
        }

        const finalDeck1Content = deck1?.content ?? deck1Override;
        const finalDeck2Content = deck2?.content ?? deck2Override;
        const finalProfile1 = deck1?.aiProfile ?? team1AiProfile;
        const finalProfile2 = deck2?.aiProfile ?? team2AiProfile;

        if (!finalDeck1Content || !finalDeck2Content || !finalProfile1 || !finalProfile2) {
            return NextResponse.json({ error: "Missing deck content or AI profile for one or both players" }, { status: 400 });
        }

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
            })
            .select('id')
            .single();

        if (simErr || !simMatch) {
            throw new Error(`sim_matches insert failed: ${simErr?.message}`);
        }

        const matchId = simMatch.id;

        // 2. Send to sim server
        const simServerUrl = process.env.SIM_SERVER_URL ?? 'http://localhost:3001';
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

        // 3. Conditionally update the schedule table
        if (scheduleId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: schedErr } = await (getSupabaseAdmin() as any)
                .from('schedule')
                .update({ status: 'in_progress', sim_match_id: matchId })
                .eq('id', scheduleId)
                .eq('status', 'validated');

            if (schedErr) {
                console.error(`[match-runner] schedule update failed for ${scheduleId}:`, schedErr);
            }
        }

        return NextResponse.json({ success: true, matchId });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[match-runner] error for schedule ${scheduleId ?? 'manual run'}:`, msg);
        
        if (scheduleId) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             await (getSupabaseAdmin() as any).from('schedule').update({ status: 'validated' }).eq('id', scheduleId);
        }

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
