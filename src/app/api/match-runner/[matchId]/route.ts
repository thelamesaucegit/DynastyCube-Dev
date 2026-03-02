// src/app/api/match-runner/[matchId]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;

  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ error: "Invalid match ID provided." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data, error } = await supabase
      .from('sim_matches')
      .select('winner')
      .eq('id', matchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Specific Supabase code for "Not Found"
        return NextResponse.json({ winner: null, message: "Match pending or not found." });
      }
      throw error;
    }
    
    return NextResponse.json({ winner: data?.winner || null });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown database error occurred.";
    console.error(`[POLL_ERROR] for matchId ${matchId}:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
