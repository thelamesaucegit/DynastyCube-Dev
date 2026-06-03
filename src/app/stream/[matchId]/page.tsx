// src/app/stream/[matchId]/page.tsx

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
    ClientCard,
    ClientGameState,
    ClientCombatState, 
    ClientEvent 
} from "@/types";
import { produce, WritableDraft } from 'immer';

interface DbSimMatch {
    argentum_game_states?: ReplayStateItem[];
    game_states?: ReplayStateItem[];
}

function isDiff(item: ReplayStateItem): item is SpectatorStateDiff {
    return (item as SpectatorStateDiff).isDiff === true;
}

/**
 * Constructs a full timeline of game states from an initial blueprint and subsequent diffs.
 * This version correctly performs a deep merge of the nested gameState objects.
 */
function reconstructGameStates(rawStates: ReplayStateItem[]): SpectatorStateUpdate[] {
    if (!rawStates || rawStates.length === 0) return [];
    
    const reconstructed: SpectatorStateUpdate[] = [];
    let currentBlueprint: SpectatorStateUpdate | null = null;

    for (const item of rawStates) {
        if (isDiff(item)) {
            if (!currentBlueprint || reconstructed.length === 0) continue;
            
            const previousState = reconstructed[reconstructed.length - 1]!;
            
            const nextState = produce(previousState, (draft: WritableDraft<SpectatorStateUpdate>) => {
                if (item.combat !== undefined) {
                    draft.combat = item.combat === null ? null : (item.combat as unknown as WritableDraft<ClientCombatState>);
                }
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
                    
                    if (gsd.combat !== undefined) {
                        draft.gameState.combat = gsd.combat === null ? null : (gsd.combat as unknown as WritableDraft<ClientCombatState>);
                    }

                    if (gsd.gameLog && gsd.gameLog.length > 0) {
                        if (!draft.gameState.gameLog) {
                            draft.gameState.gameLog = [];
                        }
                        // Safely type-cast the array push without 'any'
                        draft.gameState.gameLog.push(...(gsd.gameLog as unknown as WritableDraft<ClientEvent>[]));
                    }

                    if (gsd.cards) {
                        Object.entries(gsd.cards).forEach(([cardId, cardUpdate]) => {
                            if (draft.gameState.cards[cardId]) {
                                Object.assign(draft.gameState.cards[cardId]!, cardUpdate);
                            } else {
                                // Safely assign new cards using unknown cast
                                draft.gameState.cards[cardId] = cardUpdate as unknown as WritableDraft<ClientCard>;
                            }
                        });
                    }
                    
                    if (gsd.players) {
                        // Explicitly typing pUpdate to ClientPlayer removes the unused var warning and the 'any'
                        Object.values(gsd.players).forEach((pUpdate: ClientPlayer) => {
                            const index = draft.gameState.players.findIndex(pl => pl.playerId === pUpdate.playerId);
                            if (index !== -1) {
                                Object.assign(draft.gameState.players[index]!, pUpdate);
                            }
                        });
                    }

                    if (gsd.zones) {
                        // Explicitly typing zUpdate to ClientZone removes the 'any'
                        Object.values(gsd.zones).forEach((zUpdate: ClientZone) => {
                            const index = draft.gameState.zones.findIndex(zn => zn.zoneId.ownerId === zUpdate.zoneId.ownerId && zn.zoneId.zoneType === zUpdate.zoneId.zoneType);
                            if (index !== -1) {
                                draft.gameState.zones[index] = zUpdate as unknown as WritableDraft<ClientZone>;
                            } else {
                                draft.gameState.zones.push(zUpdate as unknown as WritableDraft<ClientZone>);
                            }
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
    
    const reconstructedGameStates = reconstructGameStates(rawGameStates);
    const validStates = reconstructedGameStates.filter(s => s?.gameState != null);
    const matchDate = data.match_date;

    const cardNamesToFetch = new Set<string>();
    validStates.forEach((state: SpectatorStateUpdate) => {
        if (state.gameState?.cards) {
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
