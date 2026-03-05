// src/app/api/match-runner/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // --- MODIFIED: Destructure the new team IDs from the request body ---
  const body = await request.json();
  const { deck1, deck2, team1Id, team2Id } = body;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  let matchId: string;

  try {
    // --- MODIFIED: The insert operation now includes team1_id and team2_id ---
    const { data: matchData, error: matchError } = await supabase
      .from('sim_matches')
      .insert({ 
        player1_info: `${deck1.filename} (AI: ${deck1.aiProfile})`, 
        player2_info: `${deck2.filename} (AI: ${deck2.aiProfile})`,
        team1_id: team1Id,
        team2_id: team2Id,
      })
      .select('id')
      .single();

    if (matchError || !matchData) {
      throw new Error(matchError?.message || "Failed to create sim_matches entry.");
    }

    matchId = matchData.id;

    // The rest of the logic for forwarding to forgesim remains the same.
    // The forgesim worker does not need to know about the teams, only the orchestrator does.
    const simServerUrl = process.env.SIMULATION_SERVER_URL;
    if (!simServerUrl) {
      throw new Error("Simulation server URL is not configured.");
    }
    
    fetch(`${simServerUrl}/start-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // We only forward the original body, not the team IDs
      body: JSON.stringify({ deck1, deck2, matchId }),
    }).catch((e: unknown) => {
        let message = "An unknown error occurred while contacting the simulation server.";
        if (e instanceof Error) message = e.message;
        console.error("[FORGESIM_FETCH_ERROR]", message);
    });

    return NextResponse.json({ matchId: matchId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during orchestration.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
