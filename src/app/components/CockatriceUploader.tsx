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

import type { SpectatorStateUpdate, ClientPlayer, ClientCard, ClientZone, EntityId, Phase, Step } from "@/types"; // Use your project's types path here

// ============================================================================
// COCKATRICE PROTOBUF SCHEMA (EXPANDED)
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
      repeated ServerInfo_Card card_list = 5;
  }
  message ServerInfo_Player {
      optional ServerInfo_PlayerProperties properties = 1;
      repeated ServerInfo_Zone zone_list = 3;
  }
  
  // -- Event Payloads --
  message Event_GameStateChanged {
      repeated ServerInfo_Player player_list = 1;
  }
  message Event_DrawCards {
      repeated ServerInfo_Card cards = 2;
  }
  message Event_MoveCard {
      optional sint32 card_id = 1;
      optional sint32 new_card_id = 10;
      optional sint32 target_player_id = 6;
      optional string target_zone = 7;
  }
  message Event_CreateToken {
      optional sint32 card_id = 2;
      optional string card_name = 3;
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
  }
  
  // -- Top Level Containers --
  message GameEventContainer {
      repeated GameEvent event_list = 2;
  }
  message GameReplay {
      repeated GameEventContainer event_list = 3;
  }
`;

const parsedSchema = protobuf.parse(COCKATRICE_SCHEMA).root;
const GameReplayMessage = parsedSchema.lookupType("cockatrice.GameReplay");

const extractCardDictionary = (obj: unknown, dict = new Map<number, string>()): Map<number, string> => {
    if (!obj || typeof obj !== 'object') return dict;
    if (Array.isArray(obj)) {
        obj.forEach(item => extractCardDictionary(item, dict));
    } else {
        const record = obj as Record<string, unknown>;
        const idVal = record.id ?? record.card_id;
        const nameVal = record.name ?? record.card_name;
        if (typeof idVal === 'number' && typeof nameVal === 'string' && idVal > 0 && nameVal.trim().length > 0) {
            dict.set(idVal, nameVal);
        }
        Object.values(record).forEach(val => extractCardDictionary(val, dict));
    }
    return dict;
};

const PHASE_MAP: Record<number, Phase> = {
    0: 'UNTAP', 1: 'UPKEEP', 2: 'DRAW', 3: 'MAIN1', 4: 'COMBAT_BEGIN',
    5: 'COMBAT_DECLARE_ATTACKERS', 6: 'COMBAT_DECLARE_BLOCKERS', 7: 'COMBAT_DAMAGE',
    8: 'COMBAT_END', 9: 'MAIN2', 10: 'END', 11: 'CLEANUP',
};

// ============================================================================
// COMPONENT LOGIC
// ============================================================================
export default function CockatriceUploader() {
    // ... (keep all state and useEffect hooks the same)

   // ============================================================================
  // ARGENTUM STATE BUILDER
  // ============================================================================
  const buildArgentumStates = (
      replayObject: Record<string, unknown>, 
      cardDict: Map<number, string>, 
      cardDbMap: Map<string, DbCardMeta>,
      team1Name: string,
      team2Name: string
  ): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      const asEntityId = (id: string): EntityId => id as EntityId;
      
      // THE FIX: We maintain local MUTABLE tracking structures
      const activeCards: Record<string, ClientCard> = {};
      const activeZones: Array<{
          zoneId: { ownerId: EntityId; zoneType: string };
          cardIds: EntityId[];
          size: number;
          isVisible: boolean;
      }> = [];

      // Helper function to assemble a fresh, Readonly snapshot
      const getSnapshotState = (): SpectatorStateUpdate => ({
          gameSessionId: "imported-cor-match",
          player1Id: asEntityId("p1"),
          player2Id: asEntityId("p2"),
          player1Name: team1Name, 
          player2Name: team2Name, 
          currentPhase: "MULLIGAN" as Phase,
          activePlayerId: asEntityId("p1"), // Default to p1
          priorityPlayerId: null, // This is nullable on the outer state
          isReplay: true,
          combat: null,
          gameState: {
              viewingPlayerId: asEntityId("p1"),
              cards: JSON.parse(JSON.stringify(activeCards)),
              zones: JSON.parse(JSON.stringify(activeZones)) as unknown as ClientZone[],
              players: [
                  { 
                      playerId: asEntityId('p1'), name: team1Name, life: 20,
                      poisonCounters: 0, handSize: 0, librarySize: 0, graveyardSize: 0,
                      exileSize: 0, landsPlayedThisTurn: 0, hasLost: false
                  },
                  { 
                      playerId: asEntityId('p2'), name: team2Name, life: 20,
                      poisonCounters: 0, handSize: 0, librarySize: 0, graveyardSize: 0,
                      exileSize: 0, landsPlayedThisTurn: 0, hasLost: false
                  }
              ] as readonly ClientPlayer[],
              currentPhase: "MULLIGAN" as Phase,
              currentStep: "OPENING_HAND" as Step,
              activePlayerId: asEntityId("p1"),      // Non-nullable
              priorityPlayerId: asEntityId("p1"), // Non-nullable, default to active player
              turnNumber: 0, isGameOver: false, winnerId: null, combat: null, gameLog: []
          }
      });

      const rawEventList = (replayObject.event_list || replayObject.eventList) as Array<Record<string, unknown>>;
      if (!rawEventList) return [getSnapshotState()];

      const cockatricePlayerMap = new Map<number, string>();

      // Event Processing Loop...
      for (const container of rawEventList) {
          const events = (container.event_list || container.eventList || []) as Array<Record<string, unknown>>;
          let stateChangedInContainer = false;

          for (const ev of events) {
              if (ev.ext_game_state_changed && cockatricePlayerMap.size === 0) {
                  const stateChange = ev.ext_game_state_changed as Record<string, unknown>;
                  const playerList = (stateChange.player_list || stateChange.playerList) as Array<Record<string, unknown>>;
                  
                  if (playerList) {
                      let pIndex = 1;
                      playerList.forEach(p => {
                          const props = p.properties as Record<string, unknown>;
                          const pId = (props?.player_id ?? props?.playerId) as number;
                          if (props && typeof pId === 'number' && pIndex <= 2) {
                              const mappedId = asEntityId(`p${pIndex}`);
                              cockatricePlayerMap.set(pId, mappedId);
                              ["deck", "hand", "table", "grave", "rfg", "sb"].forEach(zType => {
                                  activeZones.push({
                                      zoneId: { ownerId: mappedId, zoneType: zType === "table" ? "BATTLEFIELD" : zType.toUpperCase() },
                                      cardIds: [], size: 0, isVisible: zType !== "deck"
                                  });
                              });
                              pIndex++;
                          }
                      });
                  }
                  stateChangedInContainer = true;
              }

              if (ev.ext_move_card) {
                  const move = ev.ext_move_card as Record<string, unknown>;
                  const cardId = (move.card_id ?? move.cardId) as number;
                  const newCardId = (move.new_card_id ?? move.newCardId) as number;
                  const targetPlayer = (move.target_player_id ?? move.targetPlayerId) as number;
                  const targetZone = (move.target_zone ?? move.targetZone) as string;
                  
                  const mappedOwner = cockatricePlayerMap.get(targetPlayer);
                  const activeCardId = newCardId > 0 ? newCardId : cardId;
                  
                  if (mappedOwner && activeCardId > 0 && targetZone) {
                      const cardName = cardDict.get(activeCardId) || "Unknown Card";
                      const dbMeta = cardDbMap.get(cardName.toLowerCase());
                      const strCardId = asEntityId(activeCardId.toString());

                      if (!activeCards[strCardId]) {
                          activeCards[strCardId] = { id: strCardId, name: cardName, imageUri: dbMeta?.image_url, manaCost: "", manaValue: 0, typeLine: dbMeta?.card_type || "", subtypes: [], colors: [], oracleText: "", power: null, toughness: null, basePower: null, baseToughness: null, damage: null, keywords: [], counters: {}, isTapped: false, hasSummoningSickness: false, isTransformed: false, isAttacking: false, isBlocking: false, attackingTarget: null, blockingTarget: null, controllerId: asEntityId(mappedOwner), ownerId: asEntityId(mappedOwner), isToken: false, zone: null, attachedTo: null, attachments: [], isFaceDown: false, targets: [] } as unknown as ClientCard;
                      }
                      
                      const targetZoneType = targetZone === "table" ? "BATTLEFIELD" : targetZone.toUpperCase();
                      const zone = activeZones.find(z => z.zoneId.ownerId === mappedOwner && z.zoneId.zoneType === targetZoneType);
                      
                      if (zone && !zone.cardIds.includes(strCardId)) {
                          activeZones.forEach(z => { z.cardIds = z.cardIds.filter(id => id !== strCardId); z.size = z.cardIds.length; });
                          zone.cardIds.push(strCardId);
                          zone.size = zone.cardIds.length;
                      }
                      stateChangedInContainer = true;
                  }
              }
          }
          if (stateChangedInContainer) {
              states.push(getSnapshotState());
          }
      }
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

      console.log("[Uploader] Decoding raw protobuf bytes...");
      const decodedReplay = GameReplayMessage.decode(uint8Array);
      
      const replayObject = GameReplayMessage.toObject(decodedReplay, { 
          enums: String, longs: Number, bytes: Array, defaults: true 
      }) as Record<string, unknown>;

      // 1. Extract Cards
      const cardDictionary = extractCardDictionary(replayObject);
      if (cardDictionary.size === 0) {
        throw new Error("Failed to extract card IDs. The replay may be corrupted.");
      }

      // 2. Fetch Card Image Metadata from Database
      const uniqueNames = Array.from(new Set(cardDictionary.values()));
      console.log(`[Uploader] Fetching rich metadata for ${uniqueNames.length} unique cards...`);
      const { success, cards } = await fetchReplayMetadata(uniqueNames);
      
      if (!success) throw new Error("Failed to fetch card metadata from the database.");
      
      const cardDbMap = new Map<string, DbCardMeta>();
      cards?.forEach(c => cardDbMap.set(c.card_name.toLowerCase(), c));

      // 3. Translate to Argentum State
      const team1 = teams.find(t => t.id === player1TeamId);
      const team2 = teams.find(t => t.id === player2TeamId);
      
      console.log("[Uploader] Compiling Argentum State Machine snapshots...");
      const argentumReplay = buildArgentumStates(
          replayObject, 
          cardDictionary, 
          cardDbMap, 
          team1?.name || "Team 1", 
          team2?.name || "Team 2"
      );

      // 4. Send to API
      console.log(`[Uploader] Saving ${argentumReplay.length} frames to database...`);
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
