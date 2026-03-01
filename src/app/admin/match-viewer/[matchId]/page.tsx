// src/app/admin/match-viewer/[matchId]/page.tsx

import React, { use } from "react";
import MatchReplayClient from "@/app/components/MatchReplayClient";

// This is a Server Component. Its only job is to get the matchId from the URL
// and pass it to the Client Component that will do the heavy lifting.
// It uses the `use` hook to handle promise-based params from Next.js 15.
export default function MatchViewerPage({ params }: { params: Promise<{ matchId: string }> }) {
  // The `use` hook unwraps the Promise-like object for the route parameters.
  const { matchId } = use(params);

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Pass the matchId as a simple string prop to the Client Component */}
      <MatchReplayClient matchId={matchId} />
    </div>
  );
}
