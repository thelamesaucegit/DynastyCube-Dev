import { createServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ArgentumLiveStreamPlayer } from "@/app/components/game/ArgentumLiveStreamPlayer";
import { getCardDataForReplay } from "@/app/actions/cardActions";
import type { 
    SpectatorStateUpdate, 
    ReplayCardData, 
    ReplayStateItem, 
    SpectatorStateDiff, 
    ClientPlayer, 
    ClientZone,
    ClientCard // <-- Added ClientCard
} from "@/types";
import { produce } from "immer";

// Define the shape of the database response for the sim match
interface DbSimMatch {
    argentum_game_states?: ReplayStateItem[];
    game_states?: ReplayStateItem[];
}

// Exactly mirroring the reconstruction logic from the normal viewer
function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) return [];
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;

    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) continue;
            
            const previousState = reconstructed[reconstructed.length - 1];
            const nextState = produce(previousState, draft => {
                if (item.combat !== undefined) draft.combat = JSON.parse(JSON.stringify(item.combat));
                if (item.currentPhase !== undefined) draft.currentPhase = item.currentPhase;
                if (item.activePlayerId !== undefined) draft.activePlayerId = item.activePlayerId;
                if (item.priorityPlayerId !== undefined) draft.priorityPlayerId = item.priorityPlayerId;
                
                if (item.gameState) {
                    const gsd = item.gameState;
                    if (gsd.currentPhase !== undefined) draft.gameState.currentPhase = gsd.currentPhase;
                    if (gsd.currentStep !== undefined) draft.gameState.currentStep = gsd.currentStep;
                    if (gsd.activePlayerId !== undefined) draft.gameState.activePlayerId = gsd.activePlayerId;
                    if (gsd.priorityPlayerId !== undefined) draft.gameState.priorityPlayerId = gsd.priorityPlayerId;
                    if (gsd.turnNumber !== undefined) draft.gameState.turnNumber = gsd.turnNumber;
                    if (gsd.isGameOver !== undefined) draft.gameState.isGameOver = gsd.isGameOver;
                    if (gsd.winnerId !== undefined) draft.gameState.winnerId = gsd.winnerId;
                    if (gsd.combat !== undefined) draft.gameState.combat = JSON.parse(JSON.stringify(gsd.combat));
                    if (gsd.gameLog && draft.gameState.gameLog) draft.gameState.gameLog.push(...JSON.parse(JSON.stringify(gsd.gameLog)));
                    if (gsd.cards) Object.assign(draft.gameState.cards, JSON.parse(JSON.stringify(gsd.cards)));
                    
                    if (gsd.players) {
                        // Strictly type the Object.values as ClientPlayer[]
                        Object.values(gsd.players as unknown as Record<string, ClientPlayer>).forEach((p: ClientPlayer) => {
                            const index = draft.gameState.players.findIndex((pl: ClientPlayer) => pl.playerId === p.playerId);
                            if (index !== -1) draft.gameState.players[index] = JSON.parse(JSON.stringify(p));
                        });
                    }
                    if (gsd.zones) {
                        // Strictly type the Object.values as ClientZone[]
                        Object.values(gsd.zones as unknown as Record<string, ClientZone>).forEach((z: ClientZone) => {
                            const index = draft.gameState.zones.findIndex((zn: ClientZone) => zn.zoneId.ownerId === z.zoneId.ownerId && zn.zoneId.zoneType === z.zoneId.zoneType);
                            if (index !== -1) draft.gameState.zones[index] = JSON.parse(JSON.stringify(z));
                        });
                    }
                }
            });
            reconstructed.push(nextState);
        } else {
            currentBlueprint = item as SpectatorStateUpdate;
            reconstructed.push(currentBlueprint);
        }
    }
    return reconstructed;
}

export default async function LiveStreamPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;
    const supabase = await createServerClient();

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

    const simMatchArray = Array.isArray(data.sim_match) ? data.sim_match : [data.sim_match];
    const simMatch = simMatchArray[0] as unknown as DbSimMatch;
    
    const rawGameStates: ReplayStateItem[] = simMatch?.argentum_game_states || simMatch?.game_states || [];
    
    // 1. Inflate the diffs!
    const reconstructedGameStates = reconstructGameStates(rawGameStates);
    const validStates = reconstructedGameStates.filter(s => s?.gameState != null);
 const matchDate = data.match_date;
       // 2. Extract unique card names from the reconstructed arrays
    const cardNamesToFetch = new Set<string>();
    
    validStates.forEach((state: SpectatorStateUpdate) => {
        if (state.gameState?.cards) {
            // Read directly from the master cards dictionary!
            Object.values(state.gameState.cards).forEach((card: ClientCard) => {
                if (card?.name) cardNamesToFetch.add(card.name);
            });
        }
    });


    const cardDataMap = await getCardDataForReplay(Array.from(cardNamesToFetch));

    const serializableCardMap: Record<string, ReplayCardData> = {};
    cardDataMap.forEach((value, key) => {
        serializableCardMap[key] = value;
    });

    return (
        <ArgentumLiveStreamPlayer
            matchId={matchId}
            initialGameStates={validStates}
            cardDataMap={serializableCardMap}
            scheduledMatchDate={matchDate}
        />
    );
}
