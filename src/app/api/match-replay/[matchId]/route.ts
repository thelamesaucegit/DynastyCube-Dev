// src/app/api/match-replay/[matchId]/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// The type for the second argument is defined for the whole context object.
export async function GET(
  request: Request,
  context: { params: { matchId: string } },
) {
  // The matchId is destructured inside the function body.
  const { matchId } = context.params;

  try {
    const { data, error } = await supabase
      .from("sim_match_states")
      .select("state_data")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const states = data.map((row) => row.state_data);
    return NextResponse.json(states);
  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
