// src/instrumentation.ts
// Runs once when the Next.js server starts (Node.js runtime only).
// Starts a background timer that advances the draft without requiring any browser to be open.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { createAdminClient } = await import("@/lib/supabase");
  const { checkDraftTimer } = await import("@/app/actions/draftSessionActions");

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set — timer won't run server-side.
    console.warn("[DraftTimer] SUPABASE_SERVICE_ROLE_KEY is not set. Background draft timer disabled.");
    return;
  }

  const run = async () => {
    try {
      const result = await checkDraftTimer(adminClient);
      if (result.action !== "none") {
        console.log("[DraftTimer]", result.action, result.message ?? result.error ?? "");
      }
    } catch (err) {
      console.error("[DraftTimer] Unexpected error:", err);
    }
  };

  // Run immediately on startup, then every 60 seconds.
  run();
  setInterval(run, 60_000);

  console.log("[DraftTimer] Background draft timer started (60s interval).");
}
