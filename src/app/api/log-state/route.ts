// src/app/api/log-state/route.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Define the arguments for our specific RPC function
type AppendBatchArgs = {
  match_id_to_append: string;
  new_states_to_append: object[];
};

// Use a singleton pattern for the client. No need for the Database generic here.
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return _supabaseAdmin;
}

type LogStateRequestBody = object[];

export async function POST(request: Request) {
  try {
    const matchId = request.headers.get('x-match-id');
    const states = (await request.json()) as LogStateRequestBody;

    if (!matchId || !states || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Missing x-match-id header or state payload array' }, { status: 400 });
    }

    // --- THIS IS THE FIX ---
    // Explicitly assert the type of the 'rpc' method itself.
    // This forces TypeScript to recognize the correct function signature.
    const rpc = getSupabaseAdmin().rpc as (fn: string, args: AppendBatchArgs) => Promise<{ error: Error | null }>;

    const { error: rpcError } = await rpc(
      'append_batch_to_match_logs', 
      {
        match_id_to_append: matchId,
        new_states_to_append: states
      }
    );
    // --- END FIX ---

    if (rpcError) {
      console.error('Supabase batch RPC error:', rpcError);
      return NextResponse.json({ error: 'Failed to write log batch to database', details: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Log batch received and processed successfully' });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('API Error in /api/log-state:', error);
    return NextResponse.json({ error: 'Invalid request body. Ensure it is a valid JSON array.', details: error.message }, { status: 400 });
  }
}
