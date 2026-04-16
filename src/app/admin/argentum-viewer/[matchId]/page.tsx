// src/app/admin/argentum-viewer/[matchId]/page.tsx

// 1. Convert this page to a Client Component
"use client"; 

import React, { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';

import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { Team, ReplayCardData, SpectatorStateUpdate } from '@/types/replay-types';

// 2. Import the actual context and the hook that provides its value
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';

// A new inner component to handle data fetching after the page is client-side
function ReplayPageContent({ matchId }: { matchId: string }) {
  const [data, setData] = useState<{
    gameStates: SpectatorStateUpdate[] | null;
    team1: Team | null;
    team2: Team | null;
    cardDataMap: Record<string, ReplayCardData> | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        
        setData({ gameStates, team1, team2, cardDataMap });
      } catch (error) {
        console.error("Failed to fetch replay data:", error);
        // Handle error appropriately, maybe show an error message
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

  return (
    <ArgentumReplayPlayer 
      initialGameStates={data.gameStates!} 
      cardDataMap={data.cardDataMap!}
      team1={data.team1}
      team2={data.team2}
    />
  );
}

// The main export is now a wrapper that provides the context
export default function ReplayPage({ params }: { params: { matchId: string } }) {
  // 3. Use the hook to get the responsive sizes
  const responsiveSizes = useResponsive(); 

  return (
    <main className="w-full h-screen bg-gray-800">
      {/* 4. Pass the calculated sizes down using the Provider */}
      <ResponsiveContext.Provider value={responsiveSizes}>
        <ReplayPageContent matchId={params.matchId} />
      </ResponsiveContext.Provider>
    </main>
  );
}
