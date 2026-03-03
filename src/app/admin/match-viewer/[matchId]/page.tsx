// src/app/admin/match-viewer/[matchId]/page.tsx

import React from 'react';
import { getMatchReplay } from '@/app/actions/adminActions';
import ReplayViewer from '@/app/components/admin/ReplayViewer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { AlertTriangle } from 'lucide-react';

// This is now a React Server Component, which is more efficient for data fetching.
export default async function MatchViewerPage({ params }: { params: { matchId: string } }) {
  
  const { matchId } = params;
  const gameStates = await getMatchReplay(matchId);

  if (!gameStates || gameStates.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-10">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>Replay Data Not Found</CardTitle>
          <CardDescription>
            Could not load the replay for match ID: {matchId}. The match may still be in progress, or an error might have occurred.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Replay: {matchId}</CardTitle>
        <CardDescription>Review the turn-by-turn events of the simulated match.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* The ReplayViewer is a Client Component that receives the data as a prop */}
        <ReplayViewer gameStates={gameStates} />
      </CardContent>
    </Card>
  );
}
