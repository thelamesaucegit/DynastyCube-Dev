// /src/app/api/log-replay/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const matchId = req.headers.get('x-match-id');
    if (!matchId) {
      return NextResponse.json({ error: 'Missing X-Match-ID header' }, { status: 400 });
    }

    const gameStates = await req.json();
    if (!Array.isArray(gameStates)) {
      return NextResponse.json({ error: 'Request body must be a JSON array of game states' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.rpc('overwrite_match_logs', {
      match_id_to_append: matchId,
      new_states_to_append: gameStates,
    });

    if (error) {
      console.error('Supabase RPC error in /log-replay:', error);
      return NextResponse.json({ error: 'Failed to write replay to database', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Replay successfully logged' }, { status: 200 });

  } catch (err) {
    console.error('Error in /log-replay API route:', err);
    let errorMessage = 'An unexpected error occurred.';
    if (err instanceof Error) {
        errorMessage = err.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
