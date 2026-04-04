// src/app/api/match-runner/[matchId]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Using the Promise-based params type as required by your build environment.
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  // Awaiting the promise as required.
  const { matchId } = await params;

  if (!matchId || matchId === 'undefined') {
    return NextResponse.json({ error: "Invalid or missing match ID provided." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    // --- FIX: Select BOTH 'winner' and 'game_states' to prevent the race condition ---
    const { data, error } = await supabase
      .from('sim_matches')
      .select('winner, game_states')
      .eq('id', matchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Row not found, match is pending
        // --- FIX: Return the full expected response shape so the frontend doesn't crash ---
        return NextResponse.json({ winner: null, isReplayReady: false });
      }
      throw error; // For other unexpected DB errors
    }
    
    // --- FIX: Calculate the isReplayReady flag ---
    // The replay is ready only if the game_states array exists and is not empty.
    const isReplayReady = !!(data?.game_states && Array.isArray(data.game_states) && data.game_states.length > 0);

    // --- FIX: Return both winner and the isReplayReady flag ---
    return NextResponse.json({ 
      winner: data?.winner || null,
      isReplayReady: isReplayReady 
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown database error occurred.";
    console.error(`[POLL_ERROR] for matchId ${matchId}:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
