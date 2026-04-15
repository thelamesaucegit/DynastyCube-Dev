//src/app/api/match-runner/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request): Promise<NextResponse> {
    let scheduleId: string | undefined;
    try {
        const body = await request.json();
        scheduleId = body.scheduleId;
        const { team1Id, team2Id, team1AiProfile, team2AiProfile,
                deck1Override, deck2Override, weeklyMatchupId } = body;

        if (!scheduleId || !team1Id || !team2Id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Create the sim_matches record
        const { data: simMatch, error: simErr } = await supabase
            .from('sim_matches')
            .insert({
                player1_info: team1Id,
                player2_info: team2Id,
                team1_id: team1Id,
                team2_id: team2Id,
                deck1_list: deck1Override ?? null,
                deck2_list: deck2Override ?? null,
            })
            .select('id')
            .single();

        if (simErr || !simMatch) {
            throw new Error(`sim_matches insert failed: ${simErr?.message}`);
        }

        const matchId = simMatch.id;

        // 2. Send to sim server — wait for acknowledgement before marking in_progress
        const simServerUrl = process.env.SIM_SERVER_URL ?? 'http://localhost:3001';
        const simRes = await fetch(`${simServerUrl}/run-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                matchId,
                team1Id,
                team2Id,
                profile1: team1AiProfile,
                profile2: team2AiProfile,
                deck1: deck1Override,
                deck2: deck2Override,
            }),
        });

        if (!simRes.ok) {
            const errBody = await simRes.text().catch(() => '');
            throw new Error(`Sim server rejected match: HTTP ${simRes.status} ${errBody}`);
        }

        // 3. Only NOW mark in_progress — sim server confirmed it accepted the job
        const { error: schedErr } = await supabase
            .from('schedule')
            .update({
                status: 'in_progress',
                sim_match_id: matchId,
            })
            .eq('id', scheduleId)
            .eq('status', 'validated'); // safety: don't overwrite if something else changed it

        if (schedErr) {
            console.error(`[match-runner] schedule update failed for ${scheduleId}:`, schedErr);
            // Non-fatal: the forge is running, server.ts will complete it
        }

        return NextResponse.json({ success: true, matchId });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[match-runner] error for schedule ${scheduleId}:`, msg);
        // Return 500 so the edge function knows to revert to 'scheduled'
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
