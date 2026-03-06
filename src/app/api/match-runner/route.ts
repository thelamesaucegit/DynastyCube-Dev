// src/app/api/match-runner/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { format } from 'date-fns';

export async function POST(request: Request) {
  const body = await request.json();
  const { deck1, deck2, team1Id, team2Id, player1DeckName, player2DeckName } = body;

  if (
    !deck1 || !deck1.content || !deck1.aiProfile ||
    !deck2 || !deck2.content || !deck2.aiProfile ||
    !team1Id || !team2Id
  ) {
    return NextResponse.json({ error: "Invalid or incomplete request body. All deck and team information is required." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  let matchId: string;

  try {
    // ---
    // NEW: Fetch season and generate unique deck names based on your requested syntax.
    // ---
    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select('season_number')
      .eq('is_active', true)
      .single();

    if (seasonError || !seasonData) {
        throw new Error(seasonError?.message || "Could not determine the active season.");
    }

    const team1Name = deck1.content.match(/Name=(.*)/)?.[1] || "TEAM1";
    const team2Name = deck2.content.match(/Name=(.*)/)?.[1] || "TEAM2";

    const seasonPrefix = `S${seasonData.season_number}`;
    const dateStamp = format(new Date(), 'yyyyMMddHH');
    const team1Trunc = team1Name.substring(0, 4).toUpperCase();
    const team2Trunc = team2Name.substring(0, 4).toUpperCase();

    const uniqueId = `${seasonPrefix}-${team1Trunc}-vs-${team2Trunc}-${dateStamp}`;
    const uniqueFilename1 = `${uniqueId}-p1.dck`;
    const uniqueFilename2 = `${uniqueId}-p2.dck`;
    
    // The insert operation now includes the full decklists for persistence.
    const { data: matchData, error: matchError } = await supabase
      .from('sim_matches')
      .insert({
        player1_info: `${team1Name} (AI: ${deck1.aiProfile})`,
        player2_info: `${team2Name} (AI: ${deck2.aiProfile})`,
        team1_id: team1Id,
        team2_id: team2Id,
        deck1_list: deck1.content, // Persist the decklist
        deck2_list: deck2.content, // Persist the decklist
      })
      .select('id')
      .single();

    if (matchError || !matchData) {
      throw new Error(matchError?.message || "Failed to create sim_matches entry.");
    }
    matchId = matchData.id;

    const simServerUrl = process.env.SIMULATION_SERVER_URL;
    if (!simServerUrl) {
      throw new Error("Simulation server URL is not configured.");
    }
    
    // ---
    // NEW: The payload to the sidecar server now uses the generated unique filenames.
    // ---
    const sidecarPayload = {
        deck1: { ...deck1, filename: uniqueFilename1 },
        deck2: { ...deck2, filename: uniqueFilename2 },
        matchId,
    };

    fetch(`${simServerUrl}/start-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sidecarPayload),
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
