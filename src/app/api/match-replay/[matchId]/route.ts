// src/app/api/match-replay/[matchId]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(request: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;

  try {
    const { data, error } = await supabase
      .from('sim_match_states')
      .select('state_data')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Extract just the state_data object from each row
    const states = data.map(row => row.state_data);

    return NextResponse.json(states);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
