// src/app/api/match-runner/[matchId]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;

  if (!matchId || matchId === 'undefined') {
    return NextResponse.json({ error: "Invalid or missing match ID provided." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data, error } = await supabase
      .from('sim_matches')
      .select('winner, game_states')
      .eq('id', matchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ winner: null, isReplayReady: false });
      }
      throw error; 
    }
    
    const isReplayReady = !!(data?.game_states && Array.isArray(data.game_states) && data.game_states.length > 0);

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

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await context.params;
    return NextResponse.json({ error: `Method Not Allowed. Use GET to poll match status for ${matchId}` }, { status: 405 });
}
