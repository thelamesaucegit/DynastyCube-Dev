//src/app/components/HistoricalDraftBoard.tsx

"use client";

import { CardPreview } from "@/app/components/CardPreview";

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

    const isKeeper = pick.pick_source === 'keeper';

  
  // FIX: Explicitly structure the object to satisfy the expected interface without using 'any'
  const cardDataForImage = { 
      card_name: pick.card_name, 
      image_url: pick.image_url, 
      oldest_image_url: pick.oldest_image_url 
  };

  const imageUrl = getCardImageUrl(cardDataForImage, useOldestArt);
  const cardPreviewData = cardDataForImage;
  
  if (size === 'large') {
    return (
      <div className="transition-all duration-300 transform hover:scale-105">
        <CardPreview card={cardPreviewData}>
          <ColorIdentityGlow colors={pick.color_identity}>
            <div className="bg-gray-800 rounded-lg shadow-lg p-2">
              <div className="flex justify-between items-center mb-2 text-xs">
                
                <span className={`font-bold text-white px-2 py-1 rounded ${isKeeper ? 'bg-amber-600' : 'bg-blue-600'}`}>
                  {isKeeper ? 'KEEPER' : `#${pick.pick_number}`}
                </span>

                
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
        </CardPreview>
      </div>
    );
  }

  return (
    <div className="rounded-md w-full flex flex-col items-stretch [&>*]:w-full [&>*]:block">
      <CardPreview card={cardPreviewData}>
        <div className="w-full block">
          <ColorIdentityGlow colors={pick.color_identity}>
              <div className="bg-gray-800/80 rounded-sm p-1 flex flex-col items-center justify-center h-[3.5rem] w-full overflow-hidden">
                  <p className="text-[11px] xl:text-xs text-center text-gray-200 font-semibold leading-tight line-clamp-2 w-full break-words whitespace-normal" title={pick.card_name}>
                      {pick.card_name}
                  </p>
<p className={`text-[9px] xl:text-[10px] text-center mt-0.5 shrink-0 ${isKeeper ? 'text-amber-500 font-bold tracking-widest' : 'text-gray-400'}`}>
                      {isKeeper ? 'KEEPER' : `P: ${pick.pick_number}`}
                  </p>
              </div>
          </ColorIdentityGlow>
        </div>
      </CardPreview>
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
            <div className="space-y-1.5 flex-grow w-full flex flex-col items-stretch overflow-hidden">
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

  // --- NEW AGGRESSIVE BROWSER LOGGING ---
  console.log("[HistoricalDraftBoard] Component mounted!");
  console.log(`[HistoricalDraftBoard] Received sessionId: ${sessionId}`);
  console.log(`[HistoricalDraftBoard] Received serverPicks count: ${serverPicks?.length}`);
  if (serverPicks?.length > 0) {
      console.log("[HistoricalDraftBoard] Sample pick 1:", serverPicks[0]);
  }
  // --------------------------------------

  useEffect(() => {
    const fetchDraftOrder = async () => {
      console.log("[HistoricalDraftBoard] Fetching draft order...");
      const { draftOrder: fetchedOrder, error } = await getDraftBoardData(sessionId);
      if (error) console.error("[HistoricalDraftBoard] Failed to fetch draft order:", error);
      else {
          console.log(`[HistoricalDraftBoard] Fetched ${fetchedOrder?.length} teams for draft order.`);
          setDraftOrder(fetchedOrder);
      }
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

      {serverPicks.length === 0 && (
          <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg text-center my-8">
              <h3 className="text-xl font-bold text-red-400 mb-2">No Draft Data Found</h3>
              <p className="text-gray-300">The server returned 0 picks for this draft session ({sessionId}). Check your terminal logs to see if the database query failed.</p>
          </div>
      )}

 {serverPicks.length > 0 && viewMode === 'list' && (
        <ListView picks={serverPicks.filter(p => p.card_name !== 'SKIPPED')} />
      )}
      {serverPicks.length > 0 && viewMode === 'team' && draftOrder.length > 0 && <TeamView picks={serverPicks} draftOrder={draftOrder} />}
      {serverPicks.length > 0 && viewMode === 'team' && draftOrder.length === 0 && <div className="text-center text-muted-foreground py-8">Loading teams...</div>}
    </div>
  );
}
