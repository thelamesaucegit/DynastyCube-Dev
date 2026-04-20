// /src/app/admin/argentum-viewer/[matchId]/page.tsx

import { notFound } from 'next/navigation';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import type { Team, ReplayCardData, SpectatorStateUpdate } from '@/types/replay-types';
import { SettingsProvider } from '@/contexts/SettingsContext';
import React from 'react'; // Make sure React is imported

// This is a new, dedicated Client Component to wrap everything.
// It uses "use client" and can therefore use client-side hooks.
"use client";
function ArgentumViewerClientWrapper({ data }: { data: any }) {
  const responsiveSizes = useResponsive();

  // Add the console log here to confirm props are received.
  console.log("--- 0. Props Received by Client Wrapper ---");
  console.log("Team 1:", data.team1);
  console.log("Card Data Map exists:", !!data.cardDataMap);

  return (
    <ResponsiveContext.Provider value={responsiveSizes}>
      <SettingsProvider>
        <ArgentumReplayPlayer 
          initialGameStates={data.gameStates}
          cardDataMap={data.cardDataMap}
          team1={data.team1}
          team2={data.team2}
        />
      </SettingsProvider>
    </ResponsiveContext.Provider>
  );
}


// This is now a true, ASYNC SERVER COMPONENT. It has no "use client" directive.
export default async function ReplayPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  // 1. Fetch all data on the server.
  const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);
  const validStates = (gameStates ?? []).filter(s => s?.gameState != null);

  if (validStates.length === 0) {
    notFound();
  }

  const allCardNames = new Set<string>();
  validStates.forEach(state => {
    if (state.gameState.cards) {
      for (const card of Object.values(state.gameState.cards)) {
        if (card && card.name) allCardNames.add(card.name);
      }
    }
  });

  const [team1, team2, cardDataMapFromAction] = await Promise.all([
    getTeamData(team1Id),
    getTeamData(team2Id),
    getCardDataForReplay(Array.from(allCardNames))
  ]);

  const cardDataMap: Record<string, ReplayCardData> = Object.fromEntries(cardDataMapFromAction);
  
  const data = { gameStates: validStates, team1, team2, cardDataMap };

  // 2. Render the Client Component and pass the fetched data as a single prop.
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumViewerClientWrapper data={data} />
    </main>
  );
}
