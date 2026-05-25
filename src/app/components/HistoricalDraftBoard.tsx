//src/app/components/HistoricalDraftBoard.tsx

"use client";

import { useEffect, useState, useMemo, FC } from "react";
import Image from "next/image";
import { getDraftBoardData } from "@/app/actions/liveDraftActions";
import type { DraftOrderTeam } from "@/app/actions/liveDraftActions";
import type { DraftPick } from "@/app/draft/[sessionId]/live/page";
import { ColorIdentityGlow } from './ColorIdentityGlow';
import { Button } from "@/app/components/ui/button";
import { List, Columns } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

type ViewMode = 'list' | 'team';

const DraftCard: FC<{ pick: DraftPick; size: 'large' | 'small' }> = ({ pick, size }) => {
  const { useOldestArt } = useSettings();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageUrl = getCardImageUrl(pick as any, useOldestArt);

  if (size === 'large') {
    return (
      <div className="transition-all duration-300 transform hover:scale-105">
        <ColorIdentityGlow colors={pick.color_identity}>
          <div className="bg-gray-800 rounded-lg shadow-lg p-2">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-bold text-white bg-blue-600 px-2 py-1 rounded">#{pick.pick_number}</span>
              <span className="font-semibold text-gray-300 truncate">{pick.team_name}</span>
            </div>
            <Image 
                src={imageUrl || '/images/placeholder-card.png'} 
                alt={pick.card_name} 
                width={745} 
                height={1040} 
                sizes="100vw" 
                className="w-full h-auto rounded-md shadow-md" 
            />
            <h3 className="font-semibold text-center text-sm text-gray-100 mt-2 truncate">{pick.card_name}</h3>
          </div>
        </ColorIdentityGlow>
      </div>
    );
  }

  return (
    <div className="rounded-md">
        <ColorIdentityGlow colors={pick.color_identity} className="!p-1 !rounded-md">
            <div className="bg-gray-800/80 rounded-sm p-1 flex flex-col justify-center min-h-[3rem]">
                <p className="text-[11px] xl:text-xs text-center text-gray-200 font-semibold leading-tight line-clamp-2" title={pick.card_name}>
                    {pick.card_name}
                </p>
                <p className="text-[9px] xl:text-[10px] text-center text-gray-400 mt-0.5">P: {pick.pick_number}</p>
            </div>
        </ColorIdentityGlow>
    </div>
  );
};

const ListView: FC<{ picks: DraftPick[] }> = ({ picks }) => {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {picks.map((pick) => (
          <DraftCard key={pick.id} pick={pick} size="large" />
        ))}
      </div>
    </div>
  );
};

const TeamView: FC<{ picks: DraftPick[], draftOrder: DraftOrderTeam[] }> = ({ picks, draftOrder }) => {
  const picksByTeam = useMemo(() => {
    const grouped: Record<string, DraftPick[]> = {};
    for (const team of draftOrder) { if (team.team_id) grouped[team.team_id] = []; }
    for (const pick of picks) { if (pick.team_id && grouped[pick.team_id]) { grouped[pick.team_id].push(pick); } }
    for (const teamId in grouped) { grouped[teamId].sort((a, b) => a.pick_number - b.pick_number); }
    return grouped;
  }, [picks, draftOrder]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pb-4">
      {draftOrder.map(teamEntry => {
        const team = teamEntry.team;
        if (!team) return null;
        const primaryColor = team.primary_color || "#71717a";
        const secondaryColor = team.secondary_color || "#e4e4e7";

        return (
          <div key={team.id} className="bg-gray-900/50 rounded-lg p-1.5 xl:p-2 flex flex-col">
            <div className="text-center pb-2 mb-2 border-b border-gray-700 flex flex-col items-center">
              <div className="relative size-10 xl:size-12 flex-shrink-0 flex items-center justify-center mb-1">
                <div className="absolute size-10 xl:size-12 rounded-full" style={{ backgroundColor: secondaryColor }} />
                <div className="absolute size-8 xl:size-10 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span className="relative text-lg xl:text-2xl drop-shadow-md">{team.emoji}</span>
              </div>
              <p className="text-[11px] xl:text-xs font-bold leading-tight text-center break-words w-full">
                {team.name}
              </p>
            </div>
            <div className="space-y-1.5 flex-grow">
              {(picksByTeam[team.id] || []).map(pick => (
                <DraftCard key={pick.id} pick={pick} size="small" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function HistoricalDraftBoard({ serverPicks, sessionId }: { serverPicks: DraftPick[], sessionId: string }) {
  const [draftOrder, setDraftOrder] = useState<DraftOrderTeam[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    const fetchDraftOrder = async () => {
      const { draftOrder: fetchedOrder, error } = await getDraftBoardData(sessionId);
      if (error) console.error("Failed to fetch draft order:", error);
      else setDraftOrder(fetchedOrder);
    };
    if (sessionId) fetchDraftOrder();
  }, [sessionId]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="inline-flex items-center rounded-md bg-gray-800 p-1">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={`flex items-center gap-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
            <List className="size-4" /> List
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode('team')} className={`flex items-center gap-2 ${viewMode === 'team' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
            <Columns className="size-4" /> By Team
          </Button>
        </div>
      </div>

      {viewMode === 'list' && <ListView picks={serverPicks} />}
      {viewMode === 'team' && draftOrder.length > 0 && <TeamView picks={serverPicks} draftOrder={draftOrder} />}
      {viewMode === 'team' && draftOrder.length === 0 && <div className="text-center text-muted-foreground py-8">Loading teams...</div>}
    </div>
  );
}
