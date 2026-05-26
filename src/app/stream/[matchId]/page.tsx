import { createServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ArgentumLiveStreamPlayer } from "@/app/components/game/ArgentumLiveStreamPlayer";
import { getCardDataForReplay } from "@/app/actions/cardActions";
import type { SpectatorStateUpdate, ReplayCardData } from "@/types";

// Define the shape of the database response for the sim match
interface DbSimMatch {
    argentum_game_states?: SpectatorStateUpdate[];
    game_states?: SpectatorStateUpdate[];
}

// Define the shape of the card zones to safely iterate over them
interface CardInZone {
    name?: string;
}

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

    // Safely cast the returned data without using 'any'
    const simMatchArray = Array.isArray(data.sim_match) ? data.sim_match : [data.sim_match];
    const simMatch = simMatchArray[0] as unknown as DbSimMatch;
    
    const gameStates: SpectatorStateUpdate[] = simMatch?.argentum_game_states || simMatch?.game_states || [];
    const matchDate = data.match_date;

    // 2. Extract unique card names to fetch mapping data
    const cardNamesToFetch = new Set<string>();
    
        gameStates.forEach((state: SpectatorStateUpdate) => {
        if (state.gameState?.zones) {
            // Safely cast through unknown first to bridge the gap between Array and Record types
            const zones = state.gameState.zones as unknown as Record<string, CardInZone[]>;
            
            Object.values(zones).forEach((zone: CardInZone[]) => {
                if (Array.isArray(zone)) {
                    zone.forEach((card: CardInZone) => {
                        if (card?.name) cardNamesToFetch.add(card.name);
                    });
                }
            });
        }
    });


    const cardDataMap = await getCardDataForReplay(Array.from(cardNamesToFetch));

    // Convert Map to Record for Client Component serialization using the strict ReplayCardData type
    const serializableCardMap: Record<string, ReplayCardData> = {};
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
