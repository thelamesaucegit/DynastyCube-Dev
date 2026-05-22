// src/app/draft/[sessionId]/live/page.tsx

import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/components/LiveDraftBoard';
import { notFound } from 'next/navigation';

export interface DraftPick {
  id: number;
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

interface SupabasePick {
  id: number;
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  oldest_image_url: string | null;
  drafted_at: string; 
  team_id: string;
  teams: {
    name: string;
  } | null;
  card_pools: { color_identity: string[] | null; } | null; 
}

async function getInitialDraftPicks(sessionId: string): Promise<DraftPick[]> {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('team_draft_picks') 
    .select(`
      id,
      pick_number,
      card_name,
      card_set,
      rarity,
      image_url,
      oldest_image_url,
      drafted_at,
      team_id, 
      teams ( name ),
      card_pools:card_pool_id ( color_identity )
    `)
    .eq('draft_session_id', sessionId)
    .order('pick_number', { ascending: false }); // Ensure newest picks are on top!

  if (error || !data) {
    console.error('Error fetching initial draft picks:', error?.message || 'Data was null.');
    return [];
  }
  
  return data.map((pick: any) => {
    // Supabase returns nested objects as arrays or single objects depending on the schema
    const colorId = Array.isArray(pick.card_pools) 
        ? pick.card_pools[0]?.color_identity 
        : pick.card_pools?.color_identity;

    return {
      id: pick.id,
      pick_number: pick.pick_number,
      card_name: pick.card_name,
      card_set: pick.card_set,
      rarity: pick.rarity,
      image_url: pick.image_url,
      oldest_image_url: pick.oldest_image_url,
      drafted_at: pick.drafted_at,
      team_id: pick.team_id,
      team_name: pick.teams?.name || 'Unknown Team',
      color_identity: colorId || [], 
    };
  });
}

export default async function LiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  
  const initialPicks = await getInitialDraftPicks(sessionId);
  if (!initialPicks) {
    notFound();
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Live Draft</h1>
        <p className="text-lg text-gray-400 mt-2">Picks will appear automatically as they happen.</p>
      </div>
      
      <LiveDraftBoard 
        serverPicks={initialPicks} 
        sessionId={sessionId} 
      />
    </div>
  );
}
