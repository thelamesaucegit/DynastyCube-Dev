// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { notFound } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { Team, ReplayCardData } from '@/types/replay-types'; // Assuming you created this file

export const metadata = {
  title: "Match Replay | The Dynasty Cube",
};

export default async function ReplayPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

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
  
  const [team1, team2, cardDataMapFromAction] = await Promise.all([
      getTeamData(team1Id),
      getTeamData(team2Id),
      getCardDataForReplay(Array.from(allCardNames))
  ]);
  
  // ========================================================================
  // THIS IS THE DEFINITIVE FIX
  // Convert the Map object returned by the action into a plain Record object.
  // ========================================================================
  const cardDataMap: Record<string, ReplayCardData> = Object.fromEntries(cardDataMapFromAction);
  
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumReplayPlayer 
        initialGameStates={gameStates} 
        cardDataMap={cardDataMap} // Now passing the correctly typed object
        team1={team1}
        team2={team2}
      />
    </main>
  );
}
