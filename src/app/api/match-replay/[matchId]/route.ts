// src/app/api/match-replay/[matchId]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// --- FIX: Use the required Promise-based params type for Next.js 15 compatibility ---
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  
  // --- FIX: Await the promise as required by the syntax ---
  const { matchId } = await params;

  if (!matchId || matchId === 'undefined') {
    return NextResponse.json({ error: "Invalid or missing match ID provided." }, { status: 400 });
  }

  // Use the service key for secure, direct access to the data.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data, error } = await supabase
      .from('sim_matches')
      .select('game_states')
      .eq('id', matchId)
      .single();

    if (error) {
      console.error(`Error fetching replay for match ${matchId}:`, error);
      return NextResponse.json({ error: 'Replay not found or database error.' }, { status: 404 });
    }

    // Return the array of game states directly.
    return NextResponse.json(data?.game_states || []);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error(`[REPLAY_API_ERROR] for matchId ${matchId}:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
