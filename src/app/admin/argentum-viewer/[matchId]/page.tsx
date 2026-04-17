// src/app/admin/argentum-viewer/[matchId]/page.tsx

// 1. Keep this part as a Client Component for the hooks.
"use client"; 

import React, { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';

import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { Team, ReplayCardData, SpectatorStateUpdate } from '@/types/replay-types';

import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';

// 2. This component does all the client-side work. It expects a simple 'matchId' string.
function ArgentumViewerClient({ matchId }: { matchId: string }) {
  const [data, setData] = useState<{
    gameStates: SpectatorStateUpdate[] | null;
    team1: Team | null;
    team2: Team | null;
    cardDataMap: Record<string, ReplayCardData> | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The hook for responsive sizes is used here.
  const responsiveSizes = useResponsive(); 

  useEffect(() => {
    async function fetchData() {
      try {
        const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);
        
        if (!gameStates || gameStates.length === 0) {
          notFound();
          return;
        }

        const allCardNames = new Set<string>();
        gameStates.forEach(state => {
          if (state.gameState && state.gameState.cards) {
            for (const card of Object.values(state.gameState.cards)) {
              if (card && card.name) {
                 allCardNames.add(card.name);
              }
            }
          }
        });

        const [team1, team2, cardDataMapFromAction] = await Promise.all([
          getTeamData(team1Id),
          getTeamData(team2Id),
          getCardDataForReplay(Array.from(allCardNames))
        ]);

        const cardDataMap: Record<string, ReplayCardData> = Object.fromEntries(cardDataMapFromAction);
        // --- START: DIAGNOSTIC LOGS ---
        console.log("--- 1. Data Fetched in ReplayPageContent ---");
        console.log("Game States Count:", gameStates.length);
        console.log("Team 1:", team1);
        console.log("Team 2:", team2);
        console.log("Card Data Map (first 5 entries):", Object.fromEntries(Object.entries(cardDataMap).slice(0, 5)));
        // --- END: DIAGNOSTIC LOGS ---
        setData({ gameStates, team1, team2, cardDataMap });
      } catch (error) {
        console.error("Failed to fetch replay data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [matchId]);

  if (isLoading) {
    return <div className="text-white p-8 text-center">Loading replay data...</div>;
  }
  
  if (!data) {
    return <div className="text-white p-8 text-center">Failed to load replay.</div>;
  }

  // The provider is now inside the client component, using the calculated sizes.
  return (
    <ResponsiveContext.Provider value={responsiveSizes}>
      <ArgentumReplayPlayer 
        initialGameStates={data.gameStates!} 
        cardDataMap={data.cardDataMap!}
        team1={data.team1}
        team2={data.team2}
      />
    </ResponsiveContext.Provider>
  );
}

// 3. The default export is now a simple, ASYNC Server Component.
// It has NO "use client" directive.
export default async function ReplayPage({ params }: { params: Promise<{ matchId: string }> }) {
  // It performs the one required 'await' operation.
  const { matchId } = await params;

  // It then renders the Client Component, passing the resolved 'matchId' as a simple prop.
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumViewerClient matchId={matchId} />
    </main>
  );
}
