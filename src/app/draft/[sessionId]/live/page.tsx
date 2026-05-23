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
    
    // Safely extract color identity. If it's historical, it's native. If it's active, we might need the join fallback.
    let colorId: string[] | null = pick.color_identity || null;
    
    if (!colorId && pick.card_pools) {
        if (Array.isArray(pick.card_pools)) {
            colorId = pick.card_pools[0]?.color_identity || null;
        } else {
            colorId = pick.card_pools.color_identity || null;
        }
    }

    // Safely extract team name whether Supabase returns an array or an object
    let extractedTeamName = 'Unknown Team';
    if (pick.teams) {
        if (Array.isArray(pick.teams)) {
            extractedTeamName = pick.teams[0]?.name || 'Unknown Team';
        } else {
            extractedTeamName = pick.teams.name || 'Unknown Team';
        }
    }

    return {
      // Force ID to number to satisfy the frontend DraftPick interface, or change the interface to accept strings
      id: typeof pick.id === 'string' ? parseInt(pick.id.replace(/\D/g, '').substring(0, 8)) || 0 : pick.id,
      pick_number: pick.pick_number,
      card_name: pick.card_name,
      card_set: pick.card_set,
      rarity: pick.rarity,
      image_url: pick.image_url,
      oldest_image_url: pick.oldest_image_url,
      drafted_at: pick.drafted_at,
      team_id: pick.team_id,
      team_name: extractedTeamName, // Use safely extracted name
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
