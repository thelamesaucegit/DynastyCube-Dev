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

    // Supabase returns an array, but the `state_data` in each object
    // might be null if the column is empty. We need to handle that.
    const states = data ? data.map((row) => row.state_data).filter(Boolean) : [];
    return NextResponse.json(states);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
