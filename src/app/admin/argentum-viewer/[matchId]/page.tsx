// /src/app/admin/argentum-viewer/[matchId]/page.tsx

// 1. "use client" MUST BE at the top of the file that uses hooks.
"use client"; 

import React, { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation'; // Keep useParams
import { ArgentumReplayPlayer } from '@/app/components/game/ArgentumReplayPlayer';
import { getMatchReplayData, getTeamData } from '@/app/admin/argentum-viewer/data-actions';
import { getCardDataForReplay } from '@/app/actions/cardActions';
import type { Team, ReplayCardData, SpectatorStateUpdate } from '@/types/replay-types';
import { ResponsiveContext } from '@/components/game/board/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { SettingsProvider } from '@/contexts/SettingsContext';

// 2. The page itself will be the top-level client component.
export default function ReplayPage() {
  // Use client-side hooks to get params and screen size.
  const params = useParams();
  const matchId = params.matchId as string;
  const responsiveSizes = useResponsive();
  
  const [data, setData] = useState<{
    gameStates: SpectatorStateUpdate[] | null;
    team1: Team | null;
    team2: Team | null;
    cardDataMap: Record<string, ReplayCardData> | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // We can now safely use a client-side hook like useEffect to fetch data.
    if (!matchId) return;

    async function fetchData() {
      // Re-add diagnostic logs here to trace the data fetching
      console.log("--- 1. Fetching data for matchId:", matchId, "---");
      try {
        const { gameStates, team1Id, team2Id } = await getMatchReplayData(matchId);
        const validStates = (gameStates ?? []).filter(s => s?.gameState != null);

        if (validStates.length === 0) {
          console.error("No valid game states found for this match.");
          setData(null); // Explicitly set data to null to trigger "Failed to load"
          return;
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

        console.log("--- 2. Data fetch successful ---");
        console.log("Game States Count:", validStates.length);
        console.log("Team 1:", team1?.name);
        console.log("Card Data Map exists:", !!cardDataMap);

        setData({ gameStates: validStates, team1, team2, cardDataMap });
      } catch (error) {
        console.error("Failed to fetch replay data:", error);
        setData(null); // Set data to null on error
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

  // Provide all contexts at the top level here.
  return (
    <main className="w-full h-screen bg-gray-800">
      <ResponsiveContext.Provider value={responsiveSizes}>
        <SettingsProvider>
          <ArgentumReplayPlayer 
            initialGameStates={data.gameStates!} 
            cardDataMap={data.cardDataMap!}
            team1={data.team1}
            team2={data.team2}
          />
        </SettingsProvider>
      </ResponsiveContext.Provider>
    </main>
  );
}
