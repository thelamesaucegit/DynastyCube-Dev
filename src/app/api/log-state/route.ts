// src/app/api/log-state/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return _supabaseAdmin;
}

// The Java logger sends an ARRAY of states.
type LogStateRequestBody = object[];

export async function POST(request: Request) {
  try {
    const matchId = request.headers.get('x-match-id');
    const states = (await request.json()) as LogStateRequestBody;

    if (!matchId || !states || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Missing x-match-id header or state payload array' }, { status: 400 });
    }

    // --- THIS IS THE FIX ---
    // Make a SINGLE RPC call to the new batch-append function,
    // passing the entire array of states at once.
    const { error: rpcError } = await getSupabaseAdmin().rpc('append_batch_to_match_logs', {
      match_id_to_append: matchId,
      new_states_to_append: states // Pass the whole array
    });

    if (rpcError) {
      console.error('Supabase batch RPC error:', rpcError);
      return NextResponse.json({ error: 'Failed to write log batch to database', details: rpcError.message }, { status: 500 });
    }
    // --- END FIX ---

    return NextResponse.json({ message: 'Log batch received and processed successfully' });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('API Error in /api/log-state:', error);
    // This now more accurately reflects the possible error from request.json()
    return NextResponse.json({ error: 'Invalid request body. Ensure it is a valid JSON array.', details: error.message }, { status: 400 });
  }
}
