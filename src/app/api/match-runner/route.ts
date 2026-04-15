// src/app/api/match-runner/route.ts

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
        
        // Destructure all possible fields from both manual and scheduled runs
        const { 
            team1Id, team2Id, 
            deck1, deck2, // For manual runs
            deck1Override, deck2Override, // For scheduled runs
            team1AiProfile, team2AiProfile, // Scheduled runs might use this name
            scheduleId: reqScheduleId // From scheduled runs
        } = body;

        scheduleId = reqScheduleId;

        // --- THIS IS THE FIX ---
        // The core fields are team IDs and decks. scheduleId is now optional.
        if (!team1Id || !team2Id) {
            return NextResponse.json({ error: "Missing team1Id or team2Id" }, { status: 400 });
        }

        // Determine the correct deck content and AI profiles
        const finalDeck1Content = deck1?.content ?? deck1Override;
        const finalDeck2Content = deck2?.content ?? deck2Override;
        const finalProfile1 = deck1?.aiProfile ?? team1AiProfile;
        const finalProfile2 = deck2?.aiProfile ?? team2AiProfile;

        if (!finalDeck1Content || !finalDeck2Content || !finalProfile1 || !finalProfile2) {
            return NextResponse.json({ error: "Missing deck content or AI profile for one or both players" }, { status: 400 });
        }
        // --- END FIX ---

        // 1. Create the sim_matches record (this is common to both flows)
        const { data: simMatch, error: simErr } = await supabase
            .from('sim_matches')
            .insert({
                player1_info: `${team1Id} (AI: ${finalProfile1})`, // Store consistent info
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

        // 2. Trigger the simulation server
        const simServerUrl = process.env.SIM_SERVER_URL ?? 'http://localhost:3001';
        const simRes = await fetch(`${simServerUrl}/run-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                matchId,
                team1Id,
                team2Id,
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

        // 3. Conditionally update the schedule table ONLY if a scheduleId was provided
        if (scheduleId) {
            const { error: schedErr } = await supabase
                .from('schedule')
                .update({
                    status: 'in_progress',
                    sim_match_id: matchId,
                })
                .eq('id', scheduleId)
                .eq('status', 'validated'); // Safety check

            if (schedErr) {
                // Log the error but don't fail the request, as the sim is running
                console.error(`[match-runner] schedule update failed for ${scheduleId}:`, schedErr);
            }
        }

        return NextResponse.json({ success: true, matchId });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[match-runner] error for schedule ${scheduleId ?? 'manual run'}:`, msg);
        
        // If a scheduleId was provided, attempt to revert its status
        if (scheduleId) {
             await supabase
                .from('schedule')
                .update({ status: 'validated' }) // Revert to validated so it can be retried
                .eq('id', scheduleId);
        }

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
