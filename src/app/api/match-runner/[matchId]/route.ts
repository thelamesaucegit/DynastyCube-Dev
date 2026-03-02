// src/app/api/match-runner/[matchId]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Reverting to the Promise-based params type to match your specific Next.js 15 build environment.
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  // Awaiting the promise as required by your build configuration.
  const { matchId } = await params;

  if (!matchId || matchId === 'undefined') {
    return NextResponse.json({ error: "Invalid or missing match ID provided." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data, error } = await supabase
      .from('sim_matches')
      .select('winner')
      .eq('id', matchId)
      .single();

    if (error) {
      // This is expected if the match is pending. Return null so the frontend continues polling.
      if (error.code === 'PGRST116') { // Specific Supabase code for "Row not found"
        return NextResponse.json({ winner: null });
      }
      // For other DB errors, throw them to be caught below.
      throw error;
    }
    
    return NextResponse.json({ winner: data?.winner || null });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown database error occurred.";
    console.error(`[POLL_ERROR] for matchId ${matchId}:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
