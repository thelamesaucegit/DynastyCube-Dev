// src/app/api/log-state/route.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database } from '@/lib/database.types'; // Adjust the path if needed

// Type for the incoming request body
type LogStateRequestBody = object[];

// Use a singleton pattern for the client, now correctly typed with our custom Database interface.
let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    // Pass the Database interface as a generic to createClient.
    _supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return _supabaseAdmin;
}

export async function POST(request: Request) {
  try {
    const matchId = request.headers.get('x-match-id');
    const states = (await request.json()) as LogStateRequestBody;

    if (!matchId || !states || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Missing x-match-id header or state payload array' }, { status: 400 });
    }

    // --- THIS IS THE FIX ---
    // The client is now fully aware of your function's signature.
    // No generics, assertions, or 'any' are needed here.
    // TypeScript will automatically validate the function name and arguments.
    const { error: rpcError } = await getSupabaseAdmin().rpc(
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
