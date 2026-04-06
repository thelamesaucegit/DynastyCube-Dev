// src/app/api/log-state/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface LogStateRequestBody {
  matchId: string;
  state: object;
}

export async function POST(request: Request) {
  // LOG 1: Log that the endpoint was hit.
  console.log('[API /log-state] Received a POST request.');

  try {
    const body = (await request.json()) as LogStateRequestBody;
    const { matchId, state } = body;

    // LOG 2: Log the received payload to ensure it's not empty or malformed.
    console.log(`[API /log-state] Parsed payload for matchId: ${matchId}`);

    if (!matchId || !state) {
      console.error('[API /log-state] Validation failed: Missing matchId or state.');
      return NextResponse.json({ error: 'Missing matchId or state payload' }, { status: 400 });
    }

    // LOG 3: Log that we are about to call the database function.
    console.log(`[API /log-state] Calling Supabase RPC 'append_to_match_logs' for matchId: ${matchId}`);

    const { error } = await supabase.rpc('append_to_match_logs', {
        match_id_to_append: matchId,
        new_state_to_append: state
    });

    if (error) {
      // LOG 4: Log the specific database error if it occurs.
      console.error('[API /log-state] Supabase RPC error:', error);
      return NextResponse.json({ error: 'Failed to write log to database', details: error.message }, { status: 500 });
    }

    // LOG 5: Log success.
    console.log(`[API /log-state] Successfully processed log for matchId: ${matchId}`);
    return NextResponse.json({ message: 'Log received and processed successfully' });

  } catch (err: unknown) {
    // LOG 6: Log if the incoming request body isn't valid JSON.
    const error = err as Error;
    console.error('[API /log-state] Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request body', details: error.message }, { status: 400 });
  }
}
