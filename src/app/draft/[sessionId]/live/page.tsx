// src/app/draft/[sessionId]/live/page.tsx

import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/components/LiveDraftBoard';
import { notFound } from 'next/navigation';

// UPDATED: Added 'team_id' to the core DraftPick interface. This is crucial.
export interface DraftPick {
  id: number;
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  team_name: string;
  team_id: string; // <-- ADD THIS PROPERTY
}

interface SupabasePick {
  id: number;
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  team_id: string; // UPDATED: Ensure we select team_id
  teams: { // This comes from the foreign key relationship
    name: string;
  } | null; // Supabase returns a single object for a to-one relationship, not an array
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
      team_id, 
      teams ( name )
    `)
    .eq('draft_session_id', sessionId)
    .returns<SupabasePick[]>();

  if (error || !data) {
    console.error('Error fetching initial draft picks:', error?.message || 'Data was null.');
    return [];
  }

  // This map now correctly constructs the full DraftPick object
  return data.map(pick => ({
    id: pick.id,
    pick_number: pick.pick_number,
    card_name: pick.card_name,
    card_set: pick.card_set,
    rarity: pick.rarity,
    image_url: pick.image_url,
    team_id: pick.team_id, // Pass the team_id through
    team_name: pick.teams?.name || 'Unknown Team',
  }));
}

// The rest of the file remains the same
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
