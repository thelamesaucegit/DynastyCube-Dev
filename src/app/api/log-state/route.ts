// src/app/api/log-state/route.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database, Json } from '@/database.types'; // Import Json as well

// Remove the separate LogStateRequestBody type. We will use Json directly.
// type LogStateRequestBody = object[];

let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
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
    
    // --- THIS IS THE FIX ---
    // Cast the result of request.json() directly to Json.
    // The incoming data from the Java logger is a JSON array, which is a valid Json type.
    const states: Json = await request.json();
    // --- END FIX ---

    // We can still perform the array check.
    if (!matchId || !states || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Missing x-match-id header or state payload array' }, { status: 400 });
    }

    const { error: rpcError } = await getSupabaseAdmin().rpc(
      'append_batch_to_match_logs', 
      {
        match_id_to_append: matchId,
        new_states_to_append: states // Now 'states' is correctly typed as Json
      }
    );

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
