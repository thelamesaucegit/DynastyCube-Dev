// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { notFound } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from './data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';

export const metadata = {
  title: "Match Replay | The Dynasty Cube",
};

// This is the standard, correct signature for an async Next.js page component.
export default async function ReplayPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  // 1. Get the primary data
  const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);

  if (!gameStates || gameStates.length === 0) {
    return notFound();
  }
  
  // 2. Collect all unique card names from the entire replay
  const allCardNames = new Set<string>();
  gameStates.forEach(state => {
    for (const card of Object.values(state.gameState.cards)) {
      allCardNames.add(card.name);
    }
  });
  
  // 3. Fetch all dependent data in parallel for maximum performance
  const [team1, team2, cardDataMap] = await Promise.all([
      getTeamData(team1Id),
      getTeamData(team2Id),
      getCardDataForReplay(Array.from(allCardNames))
  ]);
  
  // 4. Render the client component with all the data it needs
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumReplayPlayer 
        initialGameStates={gameStates} 
        cardDataMap={cardDataMap} 
        team1={team1}
        team2={team2}
      />
    </main>
  );
}
