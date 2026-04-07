// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { notFound } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from './data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';

export const metadata = {
  title: "Match Replay | The Dynasty Cube",
};

// ========================================================================
// THIS IS THE DEFINITIVE FIX
// We are reverting to the signature your build system expects.
// ========================================================================
export default async function ReplayPage({ params }: { params: Promise<{ matchId: string }> }) {
  // Because `params` is a Promise, we MUST await it to get the value.
  const { matchId } = await params;

  // The rest of the logic is correct as it was.
  const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);

  if (!gameStates || gameStates.length === 0) {
    return notFound();
  }
  
  const allCardNames = new Set<string>();
  gameStates.forEach(state => {
    for (const card of Object.values(state.gameState.cards)) {
      allCardNames.add(card.name);
    }
  });
  
  const [team1, team2, cardDataMap] = await Promise.all([
      getTeamData(team1Id),
      getTeamData(team2Id),
      getCardDataForReplay(Array.from(allCardNames))
  ]);
  
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
