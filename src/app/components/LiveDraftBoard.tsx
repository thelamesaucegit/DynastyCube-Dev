// src/app/components/LiveDraftBoard.tsx

'use client';

import { useEffect, useState, useMemo, FC } from 'react';
import { getDraftBoardData } from '@/app/actions/liveDraftActions';
import type { DraftOrderTeam } from '@/app/actions/liveDraftActions'; // UPDATED: Import new type
import type { DraftPick } from '@/app/draft/[sessionId]/live/page';
import { Button } from '@/app/components/ui/button';
import { List, Columns } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define a type for the view mode
type ViewMode = 'list' | 'team';

// ============================================================================
// DRAFT CARD SUB-COMPONENT
// ============================================================================
const DraftCard: FC<{ pick: DraftPick; isNewest: boolean; size: 'large' | 'small' }> = ({ pick, isNewest, size }) => {
  if (size === 'large') {
    return (
      <div className={cn(
        "bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 transition-all duration-500",
        isNewest ? "col-span-full animate-fade-in-down border-green-500/50 ring-2 ring-green-500/50" : "transform hover:scale-105"
      )}>
        <div className="flex justify-between items-center mb-2 text-xs">
          <span className="font-bold text-white bg-blue-600 px-2 py-1 rounded">#{pick.pick_number}</span>
          <span className="font-semibold text-gray-300 truncate">{pick.team_name}</span>
        </div>
        <img 
          src={pick.image_url || '/placeholder-card.png'} 
          alt={pick.card_name} 
          className="w-full rounded-md shadow-md"
          loading="lazy"
        />
        <h3 className="font-semibold text-center text-sm text-gray-100 mt-2 truncate">{pick.card_name}</h3>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-gray-800/80 border border-gray-700/50 rounded-md p-1.5 transition-all duration-500",
      isNewest ? "animate-fade-in border-green-500/80 ring-1 ring-green-500/80" : ""
    )}>
      <p className="text-xs text-center text-gray-200 truncate font-semibold">{pick.card_name}</p>
      <p className="text-[10px] text-center text-gray-400">P: {pick.pick_number}</p>
    </div>
  );
};

// ============================================================================
// TEAM VIEW SUB-COMPONENT
// ============================================================================
const TeamView: FC<{ picks: DraftPick[], draftOrder: DraftOrderTeam[], newestPickId: number | null }> = ({ picks, draftOrder, newestPickId }) => {
  const picksByTeam = useMemo(() => {
    const grouped: Record<string, DraftPick[]> = {};
    for (const team of draftOrder) {
      if (team.team_id) grouped[team.team_id] = [];
    }
    for (const pick of picks) {
      if (pick.team_id && grouped[pick.team_id]) {
        grouped[pick.team_id].push(pick);
      }
    }
    for (const teamId in grouped) {
      grouped[teamId].sort((a, b) => a.pick_number - b.pick_number);
    }
    return grouped;
  }, [picks, draftOrder]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-4">
      {draftOrder.map(teamEntry => {
        const team = teamEntry.team;
        if (!team) return null;

        // UPDATED: Using your exact logo rendering logic
        const primaryColor = team.primary_color || "#71717a";
        const secondaryColor = team.secondary_color || "#e4e4e7";

        return (
          <div key={team.id} className="w-40 sm:w-48 flex-shrink-0 bg-gray-900/50 rounded-lg p-2">
            <div className="text-center pb-2 mb-2 border-b border-gray-700 flex flex-col items-center">
              <div className="relative size-12 flex-shrink-0 flex items-center justify-center mb-1">
                <div className="absolute size-12 rounded-full" style={{ backgroundColor: secondaryColor }} />
                <div className="absolute size-10 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span className="relative text-2xl drop-shadow-md">{team.emoji}</span>
              </div>
              <p className="text-xs font-bold truncate w-full">{team.name}</p>
            </div>
            <div className="space-y-1.5">
              {(picksByTeam[team.id] || []).map(pick => (
                <DraftCard key={pick.id} pick={pick} isNewest={pick.id === newestPickId} size="small" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ============================================================================
// MAIN LIVE DRAFT BOARD COMPONENT
// ============================================================================
interface LiveDraftBoardProps {
  serverPicks: DraftPick[];
  sessionId: string;
}

export default function LiveDraftBoard({ serverPicks, sessionId }: LiveDraftBoardProps) {
  const [picks, setPicks] = useState<DraftPick[]>(serverPicks);
  const [draftOrder, setDraftOrder] = useState<DraftOrderTeam[]>([]); // UPDATED
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newestPickId, setNewestPickId] = useState<number | null>(null);

  useEffect(() => {
    const fetchDraftOrder = async () => {
      const { draftOrder: fetchedOrder, error } = await getDraftBoardData();
      if (error) {
        console.error("Failed to fetch draft order:", error);
      } else {
        setDraftOrder(fetchedOrder);
      }
    };
    fetchDraftOrder();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`/api/draft-stream/${sessionId}`);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const newPick: DraftPick & { team_id: string } = {
          id: payload.id,
          pick_number: payload.pick_number,
          card_name: payload.card_name,
          card_set: payload.card_set,
          rarity: payload.rarity,
          image_url: payload.image_url,
          team_name: payload.team_name || 'Unknown Team',
          team_id: payload.team_id,
        };

        if (!newPick.team_id) {
          console.warn("Received a pick without a team_id, cannot place in team view.", newPick);
        }

        setPicks(currentPicks => {
          if (currentPicks.some(p => p.id === newPick.id)) return currentPicks;
          return [newPick, ...currentPicks];
        });
        setNewestPickId(newPick.id);
        setTimeout(() => setNewestPickId(null), 3000);
      } catch (error) {
        console.error('Failed to parse incoming event data:', event.data, error);
      }
    };
    eventSource.onerror = (err) => console.error('EventSource encountered an error:', err);
    return () => {
      console.log('Closing EventSource connection.');
      eventSource.close();
    };
  }, [sessionId]);

  const sortedPicks = useMemo(() => {
    return [...picks].sort((a, b) => b.pick_number - a.pick_number);
  }, [picks]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="inline-flex items-center rounded-md bg-gray-800 p-1">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={cn("flex items-center gap-2", viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700')}>
            <List className="size-4" /> List
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode('team')} className={cn("flex items-center gap-2", viewMode === 'team' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700')}>
            <Columns className="size-4" /> By Team
          </Button>
        </div>
      </div>
      {viewMode === 'list' && <ListView picks={sortedPicks} newestPickId={newestPickId} />}
      {viewMode === 'team' && draftOrder.length > 0 && <TeamView picks={picks} draftOrder={draftOrder} newestPickId={newestPickId} />}
    </div>
  );
}
