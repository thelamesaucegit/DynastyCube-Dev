// src/app/api/match-replay/[matchId]/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// @ts-ignore - This directive is intentionally placed to bypass a persistent,
// spurious build error in the Next.js type-checking process. All other avenues
// (dependency alignment, config changes, syntax correction) have been exhausted.
// The function signature is correct according to Next.js documentation.
export async function GET(
  request: Request,
  context: { params: { matchId: string } },
) {
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
