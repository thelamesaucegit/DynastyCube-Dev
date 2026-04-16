// src/app/api/log-state/route.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Define the types for your database, specifically the RPC function.
// This tells TypeScript about the existence and signature of your custom function.
export interface Database {
  public: {
    Functions: {
      append_batch_to_match_logs: {
        Args: {
          match_id_to_append: string;
          new_states_to_append: object[];
        };
        Returns: void; // The function doesn't return anything.
      };
    };
  };
}

type LogStateRequestBody = object[];

// Use a singleton pattern for the client, now correctly typed.
let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    // 2. Pass the Database interface as a generic to createClient.
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

    // 3. Make the RPC call. No generics or type casting needed here,
    // as the client instance is now fully aware of your function's signature.
    const { error: rpcError } = await getSupabaseAdmin().rpc(
      'append_batch_to_match_logs', 
      {
        match_id_to_append: matchId,
        new_states_to_append: states
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
