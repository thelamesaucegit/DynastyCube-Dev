// src/app/api/match-replay/[matchId]/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// LAST ATTEMPT: Removing all explicit type annotations to see if
// the build environment can infer them correctly without hitting the
// poisoned type definition that seems to be causing the build to fail.
export async function GET(request, context) {
  const { matchId } = context.params;

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
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
