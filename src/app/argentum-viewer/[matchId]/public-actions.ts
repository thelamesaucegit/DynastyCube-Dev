// src/app/argentum-viewer/[matchId]/public-actions.ts
"use server";

import { createClient } from "@supabase/supabase-js";

export async function getPublicMatchReplayData(matchId: string) {
    // 1. Initialize Supabase with the SERVICE_ROLE_KEY to bypass RLS
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    try {
        // 2. Fetch the replay states. 
        // We select both argentum and legacy game_states just in case.
        const { data, error } = await supabase
            .from('sim_matches')
            .select('argentum_game_states, game_states')
            .eq('id', matchId)
            .single();

        if (error) throw error;
        if (!data) throw new Error("Match not found");

        // Prefer the newer argentum states if they exist
        const states = data.argentum_game_states || data.game_states || [];
        
        return { gameStates: states };
    } catch (error) {
        console.error("[Public Viewer] Error fetching replay:", error);
        return { gameStates: null };
    }
}
