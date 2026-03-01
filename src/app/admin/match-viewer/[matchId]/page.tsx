// src/app/admin/match-viewer/[matchId]/page.tsx
import React from 'react';
import MatchReplayClient from '@/app/components/MatchReplayClient'; // We will create this component next

// This is a Server Component. Its only job is to get the matchId from the URL
// and pass it to the Client Component that will do the heavy lifting.
export default function MatchViewerPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Pass the matchId as a simple string prop to the Client Component */}
      <MatchReplayClient matchId={matchId} />
    </div>
  );
}
