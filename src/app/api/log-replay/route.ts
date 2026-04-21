// src/app/api/log-replay/route.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database, Json } from '@/database.types';

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
        const states: Json = await request.json(); // The payload is a JSON array of objects

        if (!matchId || !states || !Array.isArray(states) || states.length === 0) {
            return NextResponse.json({ error: 'Missing x-match-id header or valid payload array' }, { status: 400 });
        }

        const { error: rpcError } = await getSupabaseAdmin().rpc(
            'append_batch_to_match_logs', // Calling our new, correct function
            {
                match_id_to_append: matchId,
                new_states_to_append: states // Passing the array of blueprints and diffs
            }
        );

        if (rpcError) {
            console.error('Supabase batch append RPC error:', rpcError);
            return NextResponse.json({ error: 'Failed to append log batch to database', details: rpcError.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Log batch received and processed successfully' });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('API Error in /api/log-replay:', error);
        // Log the body to see what malformed JSON might have been sent
        // const reqText = await request.text();
        // console.error("Malformed Body:", reqText);
        return NextResponse.json({ error: 'Invalid request body. Ensure it is a valid JSON array.', details: error.message }, { status: 400 });
    }
}
