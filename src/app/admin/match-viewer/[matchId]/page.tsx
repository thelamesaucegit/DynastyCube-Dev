// src/app/admin/match-viewer/[matchId]/page.tsx

import React from 'react';
import { getMatchReplay } from '@/app/actions/adminActions';
import { Card, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { ReplayPlayer } from '@/app/components/admin/ReplayPlayer'; // Import the new Client Component

// This is now a PURE Server Component. It has no "use client" directive.
// Its only job is to fetch data and pass it to a Client Component.
export default async function MatchViewerPage({ params }: { params: Promise<{ matchId: string }> }) {
  
  // Await the params as required by this syntax
  const { matchId } = await params;
  
  // Fetch the data on the server
  const gameStates = await getMatchReplay(matchId);

  // Handle the case where the data could not be fetched or is empty
  if (!gameStates || gameStates.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the replay for match ID: {matchId}. The match may still be in progress, or an error might have occurred during the simulation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // If data is found, render the interactive Client Component and pass the data as props.
  return <ReplayPlayer gameStates={gameStates} matchId={matchId} />;
}
