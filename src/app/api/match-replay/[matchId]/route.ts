// src/app/api/match-replay/[matchId]/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  // Corrected: The context.params object is synchronous for API routes.
  context: { params: { matchId: string } },
) {
  // Corrected: Destructure matchId directly without 'await'.
  const { matchId } = context.params;

  if (!matchId || matchId === 'undefined') {
    return NextResponse.json({ error: "Invalid or missing match ID provided for replay." }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data, error } = await supabase
      .from("sim_match_states")
      .select("state_data")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const states = data ? data.map((row) => row.state_data).filter(Boolean) : [];
    
    return NextResponse.json(states);

  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred while fetching replay data.";
    
    console.error(`[REPLAY_ERROR] for matchId ${matchId}:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
