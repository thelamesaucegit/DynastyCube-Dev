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
 try {
    // Get the Match ID from the custom header.
    const matchId = request.headers.get('x-match-id');
    // The body is now an array of state objects.
    const states = await request.json();

    if (!matchId || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Missing X-Match-ID header or valid states array payload' }, { status: 400 });
    }

    // The queue and debounce logic remains the same, but it now queues the entire batch.
    if (!matchQueues.has(matchId)) {
      matchQueues.set(matchId, []);
    }
    // Add all states from the incoming batch to our server-side queue.
    matchQueues.get(matchId)!.push(...states);

    if (!isProcessing.get(matchId)) {
      isProcessing.set(matchId, true);
      setTimeout(() => processQueue(matchId), 50); 
    }

    return NextResponse.json({ message: 'Batch queued successfully' });

  } catch (err: any) {
    console.error('[API /log-state] Batch processing error:', err);
    return NextResponse.json({ error: 'Invalid batch request', details: err.message }, { status: 400 });
  }
}
