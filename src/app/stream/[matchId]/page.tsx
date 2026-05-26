//src/app/stream/[matchId]/page.tsx

import { createServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ArgentumLiveStreamPlayer } from "@/app/components/game/ArgentumLiveStreamPlayer";
import { getCardDataForReplay } from "@/app/actions/cardActions";

export default async function LiveStreamPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;
    const supabase = await createServerClient();

    // 1. Fetch the match data AND the scheduled date!
    const { data, error } = await supabase
        .from('schedule')
        .select(`
            match_date,
            sim_match:sim_matches!sim_match_id (
                id,
                argentum_game_states,
                game_states
            )
        `)
        .eq('sim_match_id', matchId)
        .single();

    if (error || !data || !data.sim_match) {
        notFound();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simMatch = data.sim_match as any;
    const gameStates = simMatch.argentum_game_states || simMatch.game_states || [];
    const matchDate = data.match_date;

    // 2. Extract unique card names to fetch mapping data
    const cardNamesToFetch = new Set<string>();
    gameStates.forEach((state: any) => {
        if (state.gameState?.zones) {
            Object.values(state.gameState.zones).forEach((zone: any) => {
                if (Array.isArray(zone)) {
                    zone.forEach((card: any) => {
                        if (card?.name) cardNamesToFetch.add(card.name);
                    });
                }
            });
        }
    });

    const cardDataMap = await getCardDataForReplay(Array.from(cardNamesToFetch));

    // Convert Map to Record for Client Component serialization
    const serializableCardMap: Record<string, any> = {};
    cardDataMap.forEach((value, key) => {
        serializableCardMap[key] = value;
    });

    return (
        <ArgentumLiveStreamPlayer
            initialGameStates={gameStates}
            cardDataMap={serializableCardMap}
            scheduledMatchDate={matchDate}
        />
    );
}
