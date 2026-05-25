// src/app/draft/[sessionId]/live/page.tsx
import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/app/components/LiveDraftBoard';
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

// Ensure this exactly matches the shape returned by the .select() query
interface SupabasePick {
  id: number | string; // Historical IDs are UUID strings, active are numbers
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  oldest_image_url: string | null;
  drafted_at: string; 
  team_id: string;
  color_identity?: string[] | null; // Natively on the historical table!
    teams: { name: string; } | Array<{ name: string; }> | null;
  card_pools?: { color_identity: string[] | null; } | Array<{ color_identity: string[] | null; }> | null; 
}


async function getInitialDraftPicks(sessionId: string): Promise<DraftPick[]> {
  const supabase = await createServerClient();

  // First, check the status of the draft session
  const { data: session } = await supabase
    .from('draft_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  let data = null;
  let error = null;

  // If the draft is COMPLETED, pull from the permanent historical table
  if (session?.status === 'completed') {
    const response = await supabase
      .from('historical_draft_picks') 
      .select(`
        id, pick_number, card_name, card_set, rarity, image_url, oldest_image_url, 
        drafted_at, team_id, color_identity,
        teams ( name )
      `)
      .eq('draft_session_id', sessionId)
      .order('pick_number', { ascending: false });
      
    data = response.data;
    error = response.error;

  } else {
    // If the draft is ACTIVE/PAUSED/SCHEDULED, pull from the active roster
    const response = await supabase
      .from('team_draft_picks') 
      .select(`
        id, pick_number, card_name, card_set, rarity, image_url, oldest_image_url, 
        drafted_at, team_id, color_identity,
        teams ( name ),
        card_pools:card_pool_id ( color_identity )
      `)
      .eq('draft_session_id', sessionId)
      .order('pick_number', { ascending: false });
      
    data = response.data;
    error = response.error;
  }

  if (error || !data) {
    console.error('Error fetching initial draft picks:', error?.message || 'Data was null.');
    return [];
  }
  
  return data.map((pick: SupabasePick) => {
    
    // Safely extract color identity.
    let colorId: string[] = [];
    if (pick.color_identity && Array.isArray(pick.color_identity)) {
        colorId = pick.color_identity;
    } else if (pick.card_pools) {
        if (Array.isArray(pick.card_pools) && pick.card_pools[0]?.color_identity) {
            colorId = pick.card_pools[0].color_identity;
        } else if (!Array.isArray(pick.card_pools) && pick.card_pools.color_identity) {
            colorId = pick.card_pools.color_identity;
        }
    }

    // Safely extract team name whether Supabase returns an array or an object
    let extractedTeamName = 'Unknown Team';
    if (pick.teams) {
        if (Array.isArray(pick.teams) && pick.teams[0]?.name) {
            extractedTeamName = pick.teams[0].name;
        } else if (!Array.isArray(pick.teams) && pick.teams.name) {
            extractedTeamName = pick.teams.name;
        }
    }

    return {
      // Safely parse ID to an integer for the frontend
      id: typeof pick.id === 'string' ? parseInt(pick.id.replace(/\D/g, '').substring(0, 8), 16) || Math.floor(Math.random() * 1000000) : pick.id,
      pick_number: pick.pick_number || 0,
      card_name: pick.card_name || 'Unknown Card',
      card_set: pick.card_set || null,
      rarity: pick.rarity || null,
      image_url: pick.image_url || null,
      oldest_image_url: pick.oldest_image_url || null,
      drafted_at: pick.drafted_at || new Date().toISOString(),
      team_id: pick.team_id || '',
      team_name: extractedTeamName,
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
