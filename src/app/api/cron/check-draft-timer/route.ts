// src/app/api/cron/check-draft-timer/route.ts
// Manual trigger endpoint for the draft timer check.
// The background timer in src/instrumentation.ts runs automatically every 60 seconds.
// Call this endpoint to force an immediate check, e.g. for debugging.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { checkDraftTimer } from "@/app/actions/draftSessionActions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Optional: protect with a secret header to prevent public abuse
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const adminClient = createAdminClient();
    const result = await checkDraftTimer(adminClient);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Cron] check-draft-timer error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
