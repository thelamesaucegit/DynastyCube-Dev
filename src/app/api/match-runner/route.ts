// src/app/api/match-runner/[matchId]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(request: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;

  try {
    const { data, error } = await supabase
      .from('sim_matches')
      .select('winner')
      .eq('id', matchId)
      .single();

    if (error) throw error;

    return NextResponse.json({ winner: data?.winner || null });
  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
