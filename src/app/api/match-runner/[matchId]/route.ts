// src/app/api/match-runner/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { deck1, deck2 } = body;

  // Initialize a Supabase client for this server-side operation
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  let matchId: string; // Use string for UUID

  try {
    // Step 1: Create the initial match entry in the database to get an ID.
    const player1Info = `${deck1.filename} (AI: ${deck1.aiProfile})`;
    const player2Info = `${deck2.filename} (AI: ${deck2.aiProfile})`;

    const { data: matchData, error: matchError } = await supabase
      .from('sim_matches')
      .insert({ player1_info: player1Info, player2_info: player2Info })
      .select('id')
      .single();

    if (matchError || !matchData) {
      throw new Error(matchError?.message || "Failed to create sim_matches entry.");
    }

    matchId = matchData.id;

    // Step 2: Forward the request to the forgesim server in a "fire-and-forget" manner.
    const simServerUrl = process.env.SIMULATION_SERVER_URL;
    if (!simServerUrl) {
      throw new Error("Simulation server URL is not configured.");
    }
    
    fetch(`${simServerUrl}/start-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, matchId }), // Pass the new matchId
    }).catch(e => {
        console.error("[FORGESIM_FETCH_ERROR]", e);
    });

    // Step 3: Immediately return the matchId to the frontend.
    return NextResponse.json({ matchId: matchId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during orchestration.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
