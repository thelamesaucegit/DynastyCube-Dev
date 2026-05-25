//src/app/draft/[sessionId]/live/page.tsx

import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/app/components/LiveDraftBoard';
import { notFound } from 'next/navigation';
import { logSystemEvent } from '@/lib/systemLogger'; // <-- ADDED LOGGER

export interface DraftPick {
  id: string | number; // Updated to safely support UUIDs and numbers
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  oldest_image_url: string | null;
  drafted_at: string; 
  team_name: string;
  team_id: string;
  color_identity: string[] | null; 
}

async function getInitialDraftPicks(sessionId: string): Promise<DraftPick[]> {
  const supabase = await createServerClient();

  const { data: session, error: sessionError } = await supabase
    .from('draft_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
      await logSystemEvent("DraftBoardLoad", "error", `Failed to fetch session status for ${sessionId}`, { error: sessionError.message });
  }

  let data = null;
  let error = null;

  // 1. Fetch Teams manually to completely bypass any Supabase schema cache relationship errors
  const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, name');
  if (teamsError) {
      await logSystemEvent("DraftBoardLoad", "error", `Failed to fetch teams mapping.`, { error: teamsError.message });
  }
  const teamMap = new Map((teamsData || []).map(t => [t.id, t.name]));

  // 2. Fetch the picks without the tricky team join
  if (session?.status === 'completed') {
    const response = await supabase
      .from('historical_draft_picks') 
      .select(`
        id, pick_number, card_name, card_set, rarity, image_url, oldest_image_url, 
        drafted_at, team_id, color_identity
      `)
      .eq('draft_session_id', sessionId)
      .order('pick_number', { ascending: false });
      
    data = response.data;
    error = response.error;
    
    if (error) {
        await logSystemEvent("DraftBoardLoad", "error", `Failed to fetch historical picks for ${sessionId}`, { error: error.message });
    } else {
        await logSystemEvent("DraftBoardLoad", "info", `Successfully loaded ${data?.length || 0} historical picks for ${sessionId}`);
    }
  } else {
    const response = await supabase
      .from('team_draft_picks') 
      .select(`
        id, pick_number, card_name, card_set, rarity, image_url, oldest_image_url, 
        drafted_at, team_id, color_identity,
        card_pools:card_pool_id ( color_identity )
      `)
      .eq('draft_session_id', sessionId)
      .order('pick_number', { ascending: false });
      
    data = response.data;
    error = response.error;
    
    if (error) {
        await logSystemEvent("DraftBoardLoad", "error", `Failed to fetch active picks for ${sessionId}`, { error: error.message });
    } else {
        await logSystemEvent("DraftBoardLoad", "info", `Successfully loaded ${data?.length || 0} active picks for ${sessionId}`);
    }
  }

  if (error || !data) return [];
  
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((pick: any) => {
    
    // Safely extract color identity, guaranteeing it is a string array!
    let colorId: string[] = [];
    if (Array.isArray(pick.color_identity)) {
        colorId = pick.color_identity.filter(Boolean); // Filter out any null/undefined entries
    } else if (pick.card_pools) {
        if (Array.isArray(pick.card_pools) && Array.isArray(pick.card_pools[0]?.color_identity)) {
            colorId = pick.card_pools[0].color_identity.filter(Boolean);
        } else if (!Array.isArray(pick.card_pools) && Array.isArray(pick.card_pools.color_identity)) {
            colorId = pick.card_pools.color_identity.filter(Boolean);
        }
    }

    return {
      id: pick.id, // Passes UUID or number safely directly to the UI
      pick_number: pick.pick_number || 0,
      card_name: pick.card_name || 'Unknown Card',
      card_set: pick.card_set || null,
      rarity: pick.rarity || null,
      image_url: pick.image_url || null,
      oldest_image_url: pick.oldest_image_url || null,
      drafted_at: pick.drafted_at || new Date().toISOString(),
      team_id: pick.team_id || '',
      team_name: teamMap.get(pick.team_id) || 'Unknown Team', // Mapped perfectly in memory
      color_identity: colorId, 
    };
  });
}

export default async function LiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  
  const initialPicks = await getInitialDraftPicks(sessionId);
  if (!initialPicks) {
    notFound();
  }
  
  // Create a unique key based on the session ID and the total number of picks.
  // This guarantees that if the draft flips to "completed" and loads the historical array (which might
  // be exactly the same size, but from a different table), the UI board forces a complete redraw!
  const boardKey = `${sessionId}-${initialPicks.length}`;
  
  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Live Draft</h1>
        <p className="text-lg text-gray-400 mt-2">Picks will appear automatically as they happen.</p>
      </div>
      
      <LiveDraftBoard 
        key={boardKey} 
        serverPicks={initialPicks} 
        sessionId={sessionId} 
      />
    </div>
  );
}
