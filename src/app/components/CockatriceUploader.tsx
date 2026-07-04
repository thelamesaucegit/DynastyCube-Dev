//src/app/components/CockatriceUploader.tsx

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Upload, FileCode2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";
import { 
  fetchReplayMetadata, 
  getReplayUploaderData, 
  findMatchIdForTeams, 
  type DbCardMeta, 
  type UploaderTeam 
} from "@/app/actions/replayActions";
import { Phase, Step, type SpectatorStateUpdate, type ClientPlayer, type ClientCard, type ClientZone, type EntityId } from "@/types";

// ============================================================================
// COCKATRICE PROTOBUF SCHEMA (EXPANDED & FLAT HACK)
// ============================================================================
const COCKATRICE_SCHEMA = `
  syntax = "proto2";
  package cockatrice;

  message ServerInfo_Card {
      optional sint32 id = 1 [default = -1];
      optional string name = 2;
  }
  message ServerInfo_User {
      optional string name = 1;
  }
  message ServerInfo_PlayerProperties {
      optional sint32 player_id = 1;
      optional ServerInfo_User user_info = 2;
  }
  message ServerInfo_Zone {
      optional string name = 1;
      optional sint32 type = 2;
      optional bool with_coords = 3;
      optional sint32 card_count = 4;
      repeated ServerInfo_Card card_list = 5;
  }
  message ServerInfo_Player {
      optional ServerInfo_PlayerProperties properties = 1;
      optional string deck_list = 2;
      repeated ServerInfo_Zone zone_list = 3;
  }

  // -- Event Payloads --
  message Event_GameStateChanged {
      repeated ServerInfo_Player player_list = 1;
  }
  message Event_DrawCards {
      optional sint32 number = 1;
      repeated ServerInfo_Card cards = 2;
  }
  message Event_MoveCard {
      optional sint32 card_id = 1 [default = -1];
      optional string card_name = 2;
      optional sint32 target_player_id = 6 [default = -1];
      optional string target_zone = 7;
      optional sint32 new_card_id = 10 [default = -1];
  }
  message Event_CreateToken {
      optional string zone_name = 1;
      optional sint32 card_id = 2;
      optional string card_name = 3;
  }
  message Event_DumpZone {
      optional ServerInfo_PlayerProperties player_properties = 1;
      optional ServerInfo_Zone zone_info = 2;
  }
  message Event_SetCardAttr {
      optional string zone = 1;
      optional sint32 card_id = 2;
      optional string card_attr = 3;
      optional string attr_value = 4;
  }
  message Event_SetCounter {
      optional sint32 counter_id = 1;
      optional sint32 value = 3;
  }
  message Event_SetActivePhase {
      optional sint32 phase = 1;
  }

  // -- Event Wrapper --
  message GameEvent {
      optional sint32 player_id = 1 [default = -1];
      
      optional Event_GameStateChanged ext_game_state_changed = 1005;
      optional Event_MoveCard ext_move_card = 2009;
      optional Event_DrawCards ext_draw_cards = 2005;
      optional Event_CreateToken ext_create_token = 2013;
      optional Event_SetCardAttr ext_set_card_attr = 2014;
      optional Event_SetCounter ext_set_counter = 2003;
      optional Event_SetActivePhase ext_set_active_phase = 2017;
      optional Event_DumpZone ext_dump_zone = 2018;
  }
  
  // -- Top Level Containers --
  message GameEventContainer {
      optional uint32 game_id = 1;
      repeated GameEvent event_list = 2;
      optional uint32 seconds_elapsed = 4;
  }
  message GameReplay {
      optional uint64 replay_id = 1;
      repeated GameEventContainer event_list = 3;
      optional uint32 duration_seconds = 4;
  }
`;

const parsedSchema = protobuf.parse(COCKATRICE_SCHEMA).root;
const GameReplayMessage = parsedSchema.lookupType("cockatrice.GameReplay");

// ============================================================================
// MTG ENUM MAPPERS
// ============================================================================
const PHASE_MAP: Record<number, Phase> = {
    0: Phase.BEGINNING, 1: Phase.BEGINNING, 2: Phase.BEGINNING, 3: Phase.PRECOMBAT_MAIN,
    4: Phase.COMBAT, 5: Phase.COMBAT, 6: Phase.COMBAT, 7: Phase.COMBAT, 8: Phase.COMBAT,
    9: Phase.POSTCOMBAT_MAIN, 10: Phase.ENDING, 11: Phase.ENDING,
};

const STEP_MAP: Record<number, Step> = {
    0: Step.UNTAP, 1: Step.UPKEEP, 2: Step.DRAW, 3: Step.PRECOMBAT_MAIN,
    4: Step.BEGIN_COMBAT, 5: Step.DECLARE_ATTACKERS, 6: Step.DECLARE_BLOCKERS,
    7: Step.COMBAT_DAMAGE, 8: Step.END_COMBAT, 9: Step.POSTCOMBAT_MAIN,
    10: Step.END, 11: Step.CLEANUP,
};

// ============================================================================
// DICTIONARY BUILDER
// ============================================================================
const extractCardDictionary = (obj: unknown, dict = new Map<number, string>()): Map<number, string> => {
    if (!obj || typeof obj !== 'object') return dict;
    if (Array.isArray(obj)) {
        obj.forEach(item => extractCardDictionary(item, dict));
    } else {
        const record = obj as Record<string, unknown>;
        const idVal = record.id ?? record.card_id ?? record.cardId ?? record.new_card_id ?? record.newCardId;
        const nameVal = record.name ?? record.card_name ?? record.cardName;
        
        if (typeof idVal === 'number' && typeof nameVal === 'string' && idVal > 0 && nameVal.trim().length > 0) {
            dict.set(idVal, nameVal);
        }
        Object.values(record).forEach(val => extractCardDictionary(val, dict));
    }
    return dict;
};

// ============================================================================
// COMPONENT LOGIC
// ============================================================================
export default function CockatriceUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [teams, setTeams] = useState<UploaderTeam[]>([]);
  const [player1TeamId, setPlayer1TeamId] = useState<string>("");
  const [player2TeamId, setPlayer2TeamId] = useState<string>("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);

  useEffect(() => {
      const loadContext = async () => {
          const res = await getReplayUploaderData();
          if (res.success) {
              setTeams(res.teams);
              setActiveWeekId(res.activeWeekId);
              if (res.userTeamId) setPlayer1TeamId(res.userTeamId);
          }
      };
      loadContext();
  }, []);

  useEffect(() => {
      const findMatch = async () => {
          if (player1TeamId && player2TeamId && activeWeekId) {
              setIsSearchingMatch(true);
              const res = await findMatchIdForTeams(player1TeamId, player2TeamId, activeWeekId);
              setMatchId(res.matchId);
              setIsSearchingMatch(false);
          } else {
              setMatchId(null);
          }
      };
      findMatch();
  }, [player1TeamId, player2TeamId, activeWeekId]);

  // ============================================================================
  // ARGENTUM STATE BUILDER
  // ============================================================================
  type Mutable<T> = { -readonly [P in keyof T]: T[P] };

  const buildArgentumStates = (
      replayObject: Record<string, unknown>, 
      cardDict: Map<number, string>, 
      cardDbMap: Map<string, DbCardMeta>,
      team1Name: string,
      team2Name: string
  ): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      const asEntityId = (id: string): EntityId => id as EntityId;
      
      const activeCards: Record<string, Mutable<ClientCard>> = {};
      const activeZones: Array<{
          zoneId: { ownerId: EntityId; zoneType: string };
          cardIds: EntityId[];
          size: number;
          isVisible: boolean;
      }> = [];
      const activePlayers: Mutable<ClientPlayer>[] = [
          { playerId: asEntityId('p1'), name: team1Name, life: 20, poisonCounters: 0, handSize: 0, librarySize: 0, graveyardSize: 0, exileSize: 0, landsPlayedThisTurn: 0, hasLost: false },
          { playerId: asEntityId('p2'), name: team2Name, life: 20, poisonCounters: 0, handSize: 0, librarySize: 0, graveyardSize: 0, exileSize: 0, landsPlayedThisTurn: 0, hasLost: false }
      ];

      let currentTurn = 1;
      let currentPhase: Phase = Phase.BEGINNING;
      let currentStep: Step = Step.UNTAP;
      let activePlayerId: EntityId = asEntityId("p1");

      const getSnapshotState = (): SpectatorStateUpdate => ({
          gameSessionId: "imported-cor-match",
          player1Id: asEntityId("p1"),
          player2Id: asEntityId("p2"),
          player1Name: team1Name, 
          player2Name: team2Name, 
          currentPhase: currentPhase,
          activePlayerId: activePlayerId,
          priorityPlayerId: null,
          isReplay: true,
          combat: null,
          gameState: {
              viewingPlayerId: asEntityId("p1"),
              cards: JSON.parse(JSON.stringify(activeCards)) as Record<EntityId, ClientCard>,
              zones: JSON.parse(JSON.stringify(activeZones)) as unknown as ClientZone[],
              players: JSON.parse(JSON.stringify(activePlayers)) as unknown as ClientPlayer[],
              currentPhase: currentPhase,
              currentStep: currentStep,
              activePlayerId: activePlayerId,
              priorityPlayerId: activePlayerId,
              turnNumber: currentTurn,
              isGameOver: false,
              winnerId: null,
              combat: null,
              gameLog: []
          }
      });

      const rawEventList = (replayObject.eventList || replayObject.event_list) as Array<Record<string, unknown>>;
      if (!rawEventList) return [getSnapshotState()];

      const cockatricePlayerMap = new Map<number, string>();

      // === DIAGNOSTIC COUNTERS ===
      let moveCardCount = 0;
      let dumpZoneCount = 0;
      let drawCardsCount = 0;
      let createTokenCount = 0;
      let firstFewDumpZones: unknown[] = [];

      console.log("[Diagnostic] --- STARTING EVENT LOOP ---");

      for (const container of rawEventList) {
          const events = (container.eventList || container.event_list || []) as Array<Record<string, unknown>>;
          let stateChangedInContainer = false;

          for (const ev of events) {
              const playerId = (ev.playerId ?? ev.player_id) as number;
              
              // Diagnostic gathering
              if (ev.extDumpZone || ev.ext_dump_zone) {
                  dumpZoneCount++;
                  if (firstFewDumpZones.length < 3) firstFewDumpZones.push(ev.extDumpZone || ev.ext_dump_zone);
              }
              if (ev.extDrawCards || ev.ext_draw_cards) drawCardsCount++;
              if (ev.extCreateToken || ev.ext_create_token) createTokenCount++;

              // 1. GameStateChanged
              if (ev.extGameStateChanged || ev.ext_game_state_changed) {
                  const stateChange = (ev.extGameStateChanged || ev.ext_game_state_changed) as Record<string, unknown>;
                  const playerList = (stateChange.playerList || stateChange.player_list) as Array<Record<string, unknown>>;
                  
                  if (playerList && cockatricePlayerMap.size === 0) {
                      let pIndex = 1;
                      playerList.forEach(p => {
                          const props = p.properties as Record<string, unknown>;
                          const pId = (props?.player_id ?? props?.playerId) as number;
                          if (props && typeof pId === 'number' && pIndex <= 2) {
                              const mappedId = `p${pIndex}`;
                              cockatricePlayerMap.set(pId, mappedId);
                              
                              ["deck", "hand", "table", "grave", "rfg", "sb"].forEach(zType => {
                                  activeZones.push({
                                      zoneId: { ownerId: asEntityId(mappedId), zoneType: zType === "table" ? "BATTLEFIELD" : zType.toUpperCase() },
                                      cardIds: [], size: 0, isVisible: zType !== "deck"
                                  });
                              });
                              pIndex++;
                          }
                      });
                  }
                  stateChangedInContainer = true;
              }

              // 2. SetActivePhase
              if (ev.extSetActivePhase || ev.ext_set_active_phase) {
                  const phaseChange = (ev.extSetActivePhase || ev.ext_set_active_phase) as Record<string, unknown>;
                  const newPhase = phaseChange.phase as number;
                  if (typeof newPhase === 'number') {
                      if (newPhase === 0) currentTurn++; 
                      currentPhase = PHASE_MAP[newPhase] || currentPhase;
                      currentStep = STEP_MAP[newPhase] || currentStep;
                      
                      const mappedOwner = cockatricePlayerMap.get(playerId);
                      if (mappedOwner) activePlayerId = asEntityId(mappedOwner);
                      stateChangedInContainer = true;
                  }
              }

              // 3. SetCounter
              if (ev.extSetCounter || ev.ext_set_counter) {
                  const counterChange = (ev.extSetCounter || ev.ext_set_counter) as Record<string, unknown>;
                  const pId = cockatricePlayerMap.get(counterChange.counter_id as number ?? -1);
                  const playerToUpdate = activePlayers.find(p => p.playerId === pId);
                  if (playerToUpdate && typeof counterChange.value === 'number') {
                      playerToUpdate.life = counterChange.value; 
                      stateChangedInContainer = true;
                  }
              }

              // 4. SetCardAttr
              if (ev.extSetCardAttr || ev.ext_set_card_attr) {
                  const attrChange = (ev.extSetCardAttr || ev.ext_set_card_attr) as Record<string, unknown>;
                  if (attrChange.card_attr === 'tapped' && attrChange.card_id) {
                      const card = activeCards[(attrChange.card_id as number).toString()];
                      if (card) {
                          card.isTapped = attrChange.attr_value === '1'; 
                          stateChangedInContainer = true;
                      }
                  }
              }

              // 5. MoveCard
              if (ev.extMoveCard || ev.ext_move_card) {
                  moveCardCount++;
                  const move = (ev.extMoveCard || ev.ext_move_card) as Record<string, unknown>;
                  const cardId = (move.cardId ?? move.card_id) as number;
                  const newCardId = (move.newCardId ?? move.new_card_id) as number;
                  const targetPlayer = (move.targetPlayerId ?? move.target_player_id) as number;
                  const targetZone = (move.targetZone ?? move.target_zone) as string;
                  
                  const mappedOwner = cockatricePlayerMap.get(targetPlayer);
                  const activeCardId = newCardId > 0 ? newCardId : cardId;
                  
                  if (!mappedOwner) {
                      console.warn(`[Diagnostic] MoveCard ignored: TargetPlayer ${targetPlayer} not in cockatricePlayerMap!`, move);
                  } else if (activeCardId <= 0) {
                      console.warn(`[Diagnostic] MoveCard ignored: activeCardId is <= 0!`, move);
                  } else if (!targetZone) {
                      console.warn(`[Diagnostic] MoveCard ignored: missing targetZone!`, move);
                  }

                  if (mappedOwner && activeCardId > 0 && targetZone) {
                      const cardName = cardDict.get(activeCardId) || cardDict.get(cardId) || "Unknown Card";
                      const dbMeta = cardDbMap.get(cardName.toLowerCase());
                      const strCardId = asEntityId(activeCardId.toString());

                      if (!activeCards[strCardId as string]) {
                          activeCards[strCardId as string] = {
                              id: strCardId, name: cardName, imageUri: dbMeta?.image_url,
                              cardTypes: dbMeta?.card_type?.split(" ") || [], manaCost: "", manaValue: 0,
                              typeLine: dbMeta?.card_type || "", subtypes: [], colors: [], oracleText: "",
                              power: null, toughness: null, basePower: null, baseToughness: null, damage: null,
                              keywords: [], counters: {}, isTapped: false, hasSummoningSickness: false,
                              isTransformed: false, isAttacking: false, isBlocking: false, attackingTarget: null,
                              blockingTarget: null, controllerId: asEntityId(mappedOwner), ownerId: asEntityId(mappedOwner),
                              isToken: false, zone: null, attachedTo: null, attachments: [], isFaceDown: false, targets: []
                          } as unknown as Mutable<ClientCard>;
                      }

                      const targetZoneType = targetZone === "table" ? "BATTLEFIELD" : targetZone.toUpperCase();
                      const zone = activeZones.find(z => z.zoneId.ownerId === mappedOwner && z.zoneId.zoneType === targetZoneType);
                      
                      if (zone) {
                          if (!zone.cardIds.includes(strCardId)) {
                              // Clean up old zones
                              activeZones.forEach(z => { 
                                  z.cardIds = z.cardIds.filter(id => id !== strCardId); 
                                  z.size = z.cardIds.length; 
                              });
                              zone.cardIds.push(strCardId);
                              zone.size = zone.cardIds.length;
                          }
                          stateChangedInContainer = true;
                      } else {
                          console.warn(`[Diagnostic] MoveCard failed to place in zone: Could not find zone mapping for Owner: ${mappedOwner}, ZoneType: ${targetZoneType}`);
                      }
                  }
              }
          }

          if (stateChangedInContainer) {
              states.push(getSnapshotState());
          }
      }

      console.log(`[Diagnostic] Event Totals - MoveCard: ${moveCardCount}, DumpZone: ${dumpZoneCount}, DrawCards: ${drawCardsCount}, CreateToken: ${createTokenCount}`);
      console.log(`[Diagnostic] Final activeCards count: ${Object.keys(activeCards).length}`);
      console.log(`[Diagnostic] DumpZone Samples:`, JSON.stringify(firstFewDumpZones, null, 2));

      if (states.length === 0) {
          states.push(getSnapshotState());
      }
      return states;
  };

  // ============================================================================
  // UPLOADER PROCESS
  // ============================================================================
  const processCorFile = async (file: File) => {
    if (!player1TeamId || !player2TeamId) { toast.error("Please select both teams."); return; }
    if (player1TeamId === player2TeamId) { toast.error("Teams must be different."); return; }
    if (!file.name.endsWith('.cor')) { toast.error("Invalid file type."); return; }

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log("[Diagnostic] Decoding raw protobuf bytes...");
      const decodedReplay = GameReplayMessage.decode(uint8Array);
      
      const replayObject = GameReplayMessage.toObject(decodedReplay, { 
          enums: String, longs: Number, bytes: Array, defaults: true 
      }) as Record<string, unknown>;

      const cardDictionary = extractCardDictionary(replayObject);
      if (cardDictionary.size === 0) {
        throw new Error("Failed to extract card IDs. The replay may be corrupted.");
      }

      console.log(`[Diagnostic] Dictionary Mapping:`, Object.fromEntries(cardDictionary));

      const uniqueNames = Array.from(new Set(cardDictionary.values()));
      console.log(`[Diagnostic] Fetching rich metadata for ${uniqueNames.length} unique cards...`);
      const { success, cards } = await fetchReplayMetadata(uniqueNames);
      if (!success) throw new Error("Failed to fetch card metadata from the database.");
      
      const cardDbMap = new Map<string, DbCardMeta>();
      cards?.forEach(c => cardDbMap.set(c.card_name.toLowerCase(), c));

      const team1 = teams.find(t => t.id === player1TeamId);
      const team2 = teams.find(t => t.id === player2TeamId);
      
      const argentumReplay = buildArgentumStates(
          replayObject, cardDictionary, cardDbMap, 
          team1?.name || "Team 1", team2?.name || "Team 2"
      );

      console.log(`[Diagnostic] Finished assembling ${argentumReplay.length} snapshots. Preparing to upload.`);

      const response = await fetch('/api/pvp-replays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              argentum_game_states: argentumReplay,
              original_filename: file.name,
              match_id: matchId,
              team1_id: team1?.id, team2_id: team2?.id,
              team1_name: team1?.name, team1_color: team1?.primary_color, team1_seccolor: team1?.secondary_color,
              team2_name: team2?.name, team2_color: team2?.primary_color, team2_seccolor: team2?.secondary_color
          })
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to save the replay.");

      toast.success(`Successfully mapped ${cardDictionary.size} cards and saved ${argentumReplay.length} frames!`);
    } catch (error) {
      console.error("Error decoding .cor file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse the Cockatrice Replay.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-md border-border/50">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
                <FileCode2 className="size-6 text-emerald-500" />
                Import Cockatrice Replay
            </CardTitle>
            <CardDescription>
                Select the competing teams, then upload a <code>.cor</code> file.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Player 1 (You)</label>
                        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={player1TeamId} onChange={(e) => setPlayer1TeamId(e.target.value)}>
                            <option value="" disabled>Select Team...</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Player 2 (Opponent)</label>
                        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={player2TeamId} onChange={(e) => setPlayer2TeamId(e.target.value)}>
                            <option value="" disabled>Select Team...</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
                {player1TeamId && player2TeamId && (
                    <div className="bg-muted/30 p-3 rounded-md border text-sm flex items-center gap-2">
                        {isSearchingMatch ? (<><Loader2 className="size-4 animate-spin text-muted-foreground" /> Searching schedule...</>) 
                        : matchId ? (<><CheckCircle2 className="size-4 text-emerald-500" /> Linked to active weekly match!</>) 
                        : (<><AlertCircle className="size-4 text-amber-500" /> No active match found. Will upload unlinked.</>)}
                    </div>
                )}
            </div>
            <div 
              className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-200 ease-in-out cursor-pointer group 
                ${isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-muted-foreground/30 hover:border-emerald-500/50 hover:bg-emerald-500/5"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processCorFile(e.dataTransfer.files[0]);
              }}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && processCorFile(e.target.files[0])} accept=".cor" className="hidden" />
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="size-10 animate-spin" />
                        <p className="font-bold tracking-widest uppercase text-sm">Decoding & Enriching...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-background p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="size-8 text-muted-foreground group-hover:text-emerald-500" />
                        </div>
                        <p className="font-bold text-foreground mb-1 text-center">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground text-center">Cockatrice Replay Files (.cor)</p>
                    </>
                )}
            </div>
        </CardContent>
    </Card>
  );
}
