//src/app/draft/[sessionId]/live/page.tsx

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { createServerClient } from '@/lib/supabase';
import LiveDraftBoard from '@/app/components/LiveDraftBoard';
import HistoricalDraftBoard from '@/app/components/HistoricalDraftBoard';
import { notFound } from 'next/navigation';
import { logSystemEvent } from '@/lib/systemLogger';

export interface DraftPick {
  id: string | number; 
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

// Now returns an object so the frontend knows which component to load!
async function getInitialDraftPicks(sessionId: string): Promise<{ picks: DraftPick[], isCompleted: boolean }> {
  const supabase = await createServerClient();

  console.log(`[Page.tsx] Loading draft board for session: ${sessionId}`);

  const { data: session, error: sessionError } = await supabase
    .from('draft_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
      console.error(`[Page.tsx] CRITICAL ERROR: Could not find session status!`, sessionError);
  } else {
      console.log(`[Page.tsx] Draft status is: ${session?.status}`);
  }

  const isCompleted = session?.status === 'completed';

  let data = null;
  let error = null;

  const { data: teamsData } = await supabase.from('teams').select('id, name');
  const teamMap = new Map((teamsData || []).map(t => [t.id, t.name]));

  if (isCompleted) {
    console.log(`[Page.tsx] Fetching from historical_draft_picks...`);
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
        console.error(`[Page.tsx] ERROR fetching historical picks:`, error);
    } else {
        console.log(`[Page.tsx] SUCCESS: Fetched ${data?.length} rows from historical_draft_picks!`);
    }
  } else {
    console.log(`[Page.tsx] Fetching from active team_draft_picks...`);
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
        console.error(`[Page.tsx] ERROR fetching active picks:`, error);
    } else {
        console.log(`[Page.tsx] SUCCESS: Fetched ${data?.length} rows from active team_draft_picks!`);
    }
  }

  if (error || !data) return { picks: [], isCompleted };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedPicks = data.map((pick: any) => {
    let colorId: string[] = [];
    if (Array.isArray(pick.color_identity)) {
        colorId = pick.color_identity.filter(Boolean);
    } else if (pick.card_pools) {
        if (Array.isArray(pick.card_pools) && Array.isArray(pick.card_pools[0]?.color_identity)) {
            colorId = pick.card_pools[0].color_identity.filter(Boolean);
        } else if (!Array.isArray(pick.card_pools) && Array.isArray(pick.card_pools.color_identity)) {
            colorId = pick.card_pools.color_identity.filter(Boolean);
        }
    }

    return {
      id: pick.id,
      pick_number: pick.pick_number || 0,
      card_name: pick.card_name || 'Unknown Card',
      card_set: pick.card_set || null,
      rarity: pick.rarity || null,
      image_url: pick.image_url || null,
      oldest_image_url: pick.oldest_image_url || null,
      drafted_at: pick.drafted_at || new Date().toISOString(),
      team_id: pick.team_id || '',
      team_name: teamMap.get(pick.team_id) || 'Unknown Team',
      color_identity: colorId, 
    };
  });

  return { picks: mappedPicks, isCompleted };
}

export default async function LiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  
  const { picks: initialPicks, isCompleted } = await getInitialDraftPicks(sessionId);
  if (!initialPicks) {
    notFound();
  }
  
   return (
    <div key={`draft-page-${sessionId}`} className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {isCompleted ? "Draft History" : "Live Draft"}
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          {isCompleted 
            ? "This draft has concluded. Here are the final results." 
            : "Picks will appear automatically as they happen."}
        </p>
      </div>
      
      {/* Conditionally render the correct board type! */}
      {isCompleted ? (
        <HistoricalDraftBoard serverPicks={initialPicks} sessionId={sessionId} />
      ) : (
        <LiveDraftBoard serverPicks={initialPicks} sessionId={sessionId} />
      )}
    </div>
  );
}
