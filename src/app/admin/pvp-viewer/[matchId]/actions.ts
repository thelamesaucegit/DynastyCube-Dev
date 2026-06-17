// src/app/admin/pvp-viewer/[matchId]/actions.ts
"use server";

import { createClient } from "@supabase/supabase-js";

export async function getPvpMatchReplayData(replayId: string) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    try {
        const { data, error } = await supabase
            .from('pvp_replays')
            .select('argentum_game_states')
            .eq('id', replayId)
            .single();

        if (error) throw error;
        if (!data) throw new Error("Replay not found");

        let states = data.argentum_game_states;

        // If the database accidentally saved the JSON as a string, parse it automatically!
        if (typeof states === 'string') {
            try {
                states = JSON.parse(states);
            } catch (e) {
                console.error("[PvP Viewer] Failed to parse stringified JSON:", e);
                states = [];
            }
        }

        return { gameStates: states || [] };
    } catch (error) {
        console.error("[PvP Viewer] Error fetching replay:", error);
        return { gameStates: null };
    }
}
