// /src/app/admin/pvp-viewer/[matchId]/actions.ts

"use server";

import { createClient } from "@supabase/supabase-js";

export async function getPvpMatchReplayData(replayId: string) {
    console.log(`[PVP Replay Action] 1. Fetching replay data for ID: ${replayId}`);
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

        if (error) {
            console.error(`[PVP Replay Action] ❌ DB Error fetching replay ${replayId}:`, error);
            throw error;
        }

        if (!data) {
            console.error(`[PVP Replay Action] ❌ Replay with ID ${replayId} not found.`);
            throw new Error("Replay not found");
        }

        console.log(`[PVP Replay Action] 2. Successfully fetched data. Type is: ${typeof data.argentum_game_states}`);

        let states = data.argentum_game_states;

        // If the database accidentally saved the JSON as a string, parse it automatically!
        if (typeof states === 'string') {
            console.log(`[PVP Replay Action] 3. Data is a string, attempting to parse...`);
            try {
                states = JSON.parse(states);
                console.log(`[PVP Replay Action] 4. JSON parsed successfully.`);
            } catch (e) {
                console.error("[PVP Replay Action] ❌ Failed to parse stringified JSON:", e);
                states = [];
            }
        }

        return { gameStates: states || [] };
    } catch (error) {
        console.error(`[PVP Replay Action] ❌ Fatal error for replay ${replayId}:`, error);
        return { gameStates: null };
    }
}
