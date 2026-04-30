// src/app/components/LiveDraftBoard.tsx

"use client";

import { useEffect, useState, useMemo, FC } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { getDraftBoardData } from "@/app/actions/liveDraftActions";
import type { DraftOrderTeam } from "@/app/actions/liveDraftActions";
import type { DraftPick } from "@/app/draft/[sessionId]/live/page";
import { ColorIdentityGlow } from './ColorIdentityGlow'; 
import { Button } from "@/app/components/ui/button";
import { List, Columns } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ViewMode = 'list' | 'team';

// MODIFIED: 'small' card now applies the glow correctly
const DraftCard: FC<{ pick: DraftPick; isNewest: boolean; size: 'large' | 'small' }> = ({ pick, isNewest, size }) => {
  const { useOldestArt } = useSettings();
  const imageUrl = getCardImageUrl(pick, useOldestArt);
  const cardClasses = "transition-all duration-500";

  if (size === 'large') {
    return (
      <div className={`transform hover:scale-105 ${isNewest ? "animate-fade-in-down" : ""}`}>
        <ColorIdentityGlow colors={pick.color_identity}>
          <div className={`bg-gray-800 rounded-lg shadow-lg p-2 ${cardClasses}`}>
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-bold text-white bg-blue-600 px-2 py-1 rounded">#{pick.pick_number}</span>
              <span className="font-semibold text-gray-300 truncate">{pick.team_name}</span>
            </div>
            <Image src={imageUrl || '/placeholder-card.png'} alt={pick.card_name} width={745} height={1040} sizes="100vw" className="w-full h-auto rounded-md shadow-md" />
            <h3 className="font-semibold text-center text-sm text-gray-100 mt-2 truncate">{pick.card_name}</h3>
          </div>
        </ColorIdentityGlow>
      </div>
    );
  }

  // Small card for team view - CORRECTED LOGIC
  return (
    <div className={`rounded-md ${isNewest ? "ring-2 ring-green-400" : ""}`}>
        <ColorIdentityGlow colors={pick.color_identity} className="!p-1.5 !rounded-md">
            <div className={`bg-gray-800/80 rounded-sm`}>
                <p className="text-xs text-center text-gray-200 truncate font-semibold">{pick.card_name}</p>
                <p className="text-[10px] text-center text-gray-400">P: {pick.pick_number}</p>
            </div>
        </ColorIdentityGlow>
    </div>
  );
};


// MODIFIED: ListView now has corrected responsive grid classes
const ListView: FC<{ picks: DraftPick[], newestPickId: number | null }> = ({ picks, newestPickId }) => {
  const newestPick = picks.length > 0 ? picks[0] : null;
  const historicalPicks = picks.slice(1);
  
  // CONFIGURABLE: Change this value to 3 or 4 to test
  const mobileGridCols = 3; 

  return (
    <div className="space-y-8">
      {newestPick && (
        <div className="max-w-xs mx-auto">
          <DraftCard key={newestPick.id} pick={newestPick} isNewest={newestPick.id === newestPickId} size="large" />
        </div>
      )}
      {historicalPicks.length > 0 && (
         <>
          <div className="relative text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700" /></div><div className="relative flex justify-center"><span className="bg-background px-2 text-sm text-muted-foreground">Draft History</span></div></div>
          
          {/* CORRECTED RESPONSIVE GRID LOGIC */}
          <div className={`grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`}>
            {historicalPicks.map((pick) => (
              <DraftCard key={pick.id} pick={pick} isNewest={false} size="large" />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TeamView: FC<{ picks: DraftPick[], draftOrder: DraftOrderTeam[], newestPickId: number | null }> = ({ picks, draftOrder, newestPickId }) => {
  const picksByTeam = useMemo(() => {
    const grouped: Record<string, DraftPick[]> = {};
    for (const team of draftOrder) { if (team.team_id) grouped[team.team_id] = []; }
    for (const pick of picks) { if (pick.team_id && grouped[pick.team_id]) { grouped[pick.team_id].push(pick); } }
    for (const teamId in grouped) { grouped[teamId].sort((a, b) => a.pick_number - b.pick_number); }
    return grouped;
  }, [picks, draftOrder]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-4">
      {draftOrder.map(teamEntry => {
        const team = teamEntry.team;
        if (!team) return null;
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

interface LiveDraftBoardProps {
  serverPicks: DraftPick[];
  sessionId: string;
}

export default function LiveDraftBoard({ serverPicks, sessionId }: LiveDraftBoardProps) {
  const [picks, setPicks] = useState<DraftPick[]>(serverPicks);
  const [draftOrder, setDraftOrder] = useState<DraftOrderTeam[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newestPickId, setNewestPickId] = useState<number | null>(null);

  useEffect(() => {
    const fetchDraftOrder = async () => {
      const { draftOrder: fetchedOrder, error } = await getDraftBoardData(sessionId);
      if (error) console.error("Failed to fetch draft order:", error);
      else setDraftOrder(fetchedOrder);
    };
    if (sessionId) fetchDraftOrder();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`draft-updates-${sessionId}`)
      .on('broadcast', { event: 'new_pick' }, async ({ payload }) => {
        
        // --- NEW: FETCH MISSING DATA FOR REAL-TIME PICK ---
        let colorIdentity: string[] | null = [];
        let teamName = payload.team_name || 'Unknown Team';
        
        // 1. Fetch color_identity from card_pools
        if (payload.card_pool_id) {
            const { data: cardPoolData } = await supabase
                .from('card_pools')
                .select('color_identity')
                .eq('id', payload.card_pool_id)
                .single();
            colorIdentity = cardPoolData?.color_identity || [];
        }
        
        // 2. Fetch team name if it wasn't on the payload (it often isn't)
        if (teamName === 'Unknown Team') {
            const { data: teamData } = await supabase.from('teams').select('name').eq('id', payload.team_id).single();
            teamName = teamData?.name || 'Unknown Team';
        }

        const newPick: DraftPick = {
          id: payload.id,
          pick_number: payload.pick_number,
          card_name: payload.card_name,
          card_set: payload.card_set,
          rarity: payload.rarity,
          image_url: payload.image_url,
          oldest_image_url: payload.oldest_image_url,
          drafted_at: payload.drafted_at,
          team_id: payload.team_id,
          team_name: teamName, // Use fetched name
          color_identity: colorIdentity, // Use fetched color identity
        };
        
        if (!newPick.id || !newPick.team_id) {
          console.warn("Received a pick with missing data, cannot process.", newPick);
          return;
        }

        setPicks(currentPicks => {
          if (currentPicks.some(p => p.id === newPick.id)) return currentPicks;
          return [newPick, ...currentPicks];
        });
        setNewestPickId(newPick.id);
        setTimeout(() => setNewestPickId(null), 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const sortedPicks = useMemo(() => {
    return [...picks].sort((a, b) => new Date(b.drafted_at).getTime() - new Date(a.drafted_at).getTime());
  }, [picks]);

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
      {viewMode === 'list' && <ListView picks={sortedPicks} newestPickId={newestPickId} />}
      {viewMode === 'team' && draftOrder.length > 0 && <TeamView picks={picks} draftOrder={draftOrder} newestPickId={newestPickId} />}
    </div>
  );
}
