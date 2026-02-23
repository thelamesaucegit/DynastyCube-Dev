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

// UPDATED: Function name and parameter changed to 'sessionId'
async function getInitialDraftPicks(sessionId: string): Promise<DraftPick[]> {
  const supabase = await createServerClient();

  // UPDATED: Querying the correct table 'team_draft_picks'
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
    // UPDATED: Filtering by the correct column 'draft_session_id'
    .eq('draft_session_id', sessionId)
    .order('pick_number', { ascending: true });

  if (error) {
    console.error('Error fetching initial draft picks:', error.message);
    return [];
  }

  return data.map(pick => ({
    ...pick,
    team_name: Array.isArray(pick.teams) ? 'Error' : pick.teams?.name || 'Unknown Team',
  }));
}

// UPDATED: The parameter is now correctly 'sessionId'
export default async function LiveDraftPage({ params }: { params: { sessionId: string } }) {
  // UPDATED: Passing the correct parameter to the fetch function
  const initialPicks = await getInitialDraftPicks(params.sessionId);

  if (!initialPicks) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Live Draft</h1>
        <p className="text-lg text-gray-400 mt-2">Picks will appear automatically as they happen.</p>
      </div>
      
      {/* UPDATED: Passing the correct prop 'sessionId' to the client component */}
      <LiveDraftBoard 
        serverPicks={initialPicks} 
        sessionId={params.sessionId} 
      />
    </div>
  );
}
