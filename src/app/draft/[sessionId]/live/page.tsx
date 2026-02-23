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
  team_name: string;
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
      teams ( name )
    `)
    .eq('draft_session_id', sessionId)
    .order('pick_number', { ascending: true });

  if (error) {
    console.error('Error fetching initial draft picks:', error.message);
    return [];
  }

  return data.map(pick => ({
    id: pick.id,
    pick_number: pick.pick_number,
    card_name: pick.card_name,
    card_set: pick.card_set,
    rarity: pick.rarity,
    image_url: pick.image_url,
    // This logic correctly processes the 'teams' object from Supabase...
    // ...and assigns the result to the 'team_name' property as required by the interface.
    team_name: Array.isArray(pick.teams) ? 'Error' : pick.teams?.name || 'Unknown Team',
  }));
}


// Apply the same Promise pattern to the page props
export default async function LiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
  // Await the params to get the sessionId
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
        // Pass the resolved sessionId to the client component
        sessionId={sessionId} 
      />
    </div>
  );
}
