// /src/app/admin/argentum-viewer/[matchId]/page.tsx

"use client";
import React, { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { Team, ReplayCardData, SpectatorStateUpdate } from '@/types/replay-types';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';

function ArgentumViewerClient({ matchId }: { matchId: string }) {
  const [data, setData] = useState<{
    gameStates: SpectatorStateUpdate[] | null;
    team1: Team | null;
    team2: Team | null;
    cardDataMap: Record<string, ReplayCardData> | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

export default function ReplayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  return (
    <main className="w-full h-screen bg-gray-800">
      <ArgentumViewerClient matchId={matchId} />
    </main>
  );
}
