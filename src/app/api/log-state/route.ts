// src/app/api/log-state/route.ts (FINAL, TYPE-SAFE VERSION)
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabaseAdmin;
}

// ============================================================================
// 1. DEFINE A STRONG TYPE FOR OUR PAYLOADS
// ============================================================================

// A game state update is a JSON object. We can use a generic but type-safe Record.
type GameStateUpdate = Record<string, unknown>;

// ============================================================================
// 2. IN-MEMORY QUEUE AND DEBOUNCER (NOW TYPE-SAFE)
// ============================================================================

// The queue now expects an array of our strongly-typed GameStateUpdate objects.
const matchQueues = new Map<string, GameStateUpdate[]>();
const isProcessing = new Map<string, boolean>();
const DEBOUNCE_TIME = 2000;

async function processQueue(matchId: string) {
  const queue = matchQueues.get(matchId);
  if (!queue || queue.length === 0) {
    isProcessing.set(matchId, false);
    return;
  }

  const statesToProcess = [...queue];
  matchQueues.set(matchId, []); // Clear the queue

  console.log(`[Queue Worker] Processing ${statesToProcess.length} states for match ${matchId}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getSupabaseAdmin() as any).rpc('append_to_match_logs_batch', {
      match_id_to_append: matchId,
      new_states_to_append: statesToProcess
  });

  if (error) {
    console.error(`[Queue Worker] Supabase batch RPC error for ${matchId}:`, error);
  } else {
    console.log(`[Queue Worker] Successfully appended ${statesToProcess.length} states for match ${matchId}`);
  }

  setTimeout(() => processQueue(matchId), DEBOUNCE_TIME);
}

// ============================================================================
// 3. TYPE-SAFE API ROUTE
// ============================================================================

export async function POST(request: Request) {
  try {
    const matchId = request.headers.get('x-match-id');
    
    // Type the incoming payload from the request.
    const states: GameStateUpdate[] = await request.json();

    if (!matchId) {
      return NextResponse.json({ error: 'Missing X-Match-ID header' }, { status: 400 });
    }
    
    // Validate that the payload is actually an array.
    if (!Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: 'Request body must be a non-empty array of game states' }, { status: 400 });
    }

    if (!matchQueues.has(matchId)) {
      matchQueues.set(matchId, []);
    }
    matchQueues.get(matchId)!.push(...states);

    if (!isProcessing.get(matchId)) {
      isProcessing.set(matchId, true);
      setTimeout(() => processQueue(matchId), 50); 
    }

    return NextResponse.json({ message: 'Batch queued successfully' });

  } catch (err: unknown) { // <-- Use 'unknown' for type-safe error handling
    console.error('[API /log-state] General error:', err);
    
    // Perform a type check to safely access the error message
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    
    return NextResponse.json({ error: 'Invalid request', details: errorMessage }, { status: 400 });
  }
}
