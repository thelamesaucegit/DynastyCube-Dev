// src/app/draft/[draftId]/live/page.tsx

import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/components/LiveDraftBoard';
import { notFound } from 'next/navigation';

// Define the data structure for a draft pick.
// This should match what you expect to display.
export interface DraftPick {
  id: number;
  pick_number: number;
  card_name: string;
  card_set: string | null;
  rarity: string | null;
  image_url: string | null;
  team_name: string;
}

// Fetches the initial draft picks when the page is first loaded.
async function getInitialDraftPicks(draftId: string): Promise<DraftPick[]> {
  const supabase = await createServerClient();

  // This query joins draft_picks with teams to get the team name.
  // Adjust the table and column names ('draft_id', 'teams', 'name') as needed.
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      id,
      pick_number,
      card_name,
      card_set,
      rarity,
      image_url,
      teams ( name )
    `)
    .eq('draft_id', draftId) // Make sure you have a 'draft_id' foreign key on your 'draft_picks' table
    .order('pick_number', { ascending: true });

  if (error) {
    console.error('Error fetching initial draft picks:', error.message);
    return [];
  }

  // The join returns `teams: { name: 'Team Name' }`. We flatten this for easier use.
  return data.map(pick => ({
    ...pick,
    team_name: Array.isArray(pick.teams) ? 'Error' : pick.teams?.name || 'Unknown Team',
  }));
}


export default async function LiveDraftPage({ params }: { params: { draftId: string } }) {
  const initialPicks = await getInitialDraftPicks(params.draftId);

  // If there's a problem, show a 404 page.
  if (!initialPicks) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Live Draft</h1>
        <p className="text-lg text-gray-400 mt-2">Picks will appear automatically as they happen.</p>
      </div>
      
      {/* 
        This is the client component. It receives the initial picks from the server
        and will handle fetching all future live updates.
      */}
      <LiveDraftBoard 
        serverPicks={initialPicks} 
        draftId={params.draftId} 
      />
    </div>
  );
}
