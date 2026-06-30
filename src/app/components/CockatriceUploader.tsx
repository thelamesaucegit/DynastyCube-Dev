//src/app/components/CockatriceUploader.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Upload, FileCode2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";
import { fetchReplayMetadata, getReplayUploaderData, findMatchIdForTeams, type DbCardMeta, type UploaderTeam } from "@/app/actions/replayActions";

// ============================================================================
// ARGENTUM STATE TYPES 
// ============================================================================
export interface TargetInfo { entityId: string; type: string; }
export interface ZoneId { zoneType: string; ownerId: string; }
export interface CombatGroup { attackerId: string; blockers: string[]; }
export interface CombatState { groups: CombatGroup[]; attackers: string[]; }
export interface ClientPlayer { playerId: string; name: string; life: number; }


export interface CockatriceGameEvent {
    name: string; // The type of event, e.g., "Event_MoveCard", "Event_DrawCards"
    // We will expand this payload as we build out the specific event decoders
    [key: string]: unknown; 
}

export interface CockatriceEventContainer {
    gameId?: number;
    secondsElapsed?: number;
    eventList: CockatriceGameEvent[];
}

export interface CockatriceReplay {
    replayId: number;
    eventList: Uint8Array[]; // The raw bytes we need to decode
}

// 2. Define the extended Protobuf schema
const root = new protobuf.Root();

// Base GameReplay structure
root.define("cockatrice")
    .add(new protobuf.Type("GameReplay")
        .add(new protobuf.Field("replayId", 1, "int32"))
        .add(new protobuf.Field("eventList", 2, "bytes", "repeated"))
    )
    // The container inside each eventList byte array
    .add(new protobuf.Type("GameEventContainer")
        .add(new protobuf.Field("gameId", 1, "int32"))
        .add(new protobuf.Field("secondsElapsed", 2, "int32"))
        .add(new protobuf.Field("eventList", 3, "GameEvent", "repeated"))
    )
    // The generic GameEvent wrapper
    .add(new protobuf.Type("GameEvent")
        .add(new protobuf.Field("name", 1, "string"))
        // Event data is usually packed as bytes or specific fields depending on the Cockatrice version.
        // For standard implementations, they use extensions or a byte payload. 
        // We will define the inner payload field here in Step 2.
    );

// ============================================================================
// COCKATRICE PROTOBUF SCHEMA
// ============================================================================
// We simulate the extensions by embedding them directly as optional fields 
// to make Protobuf.js parsing much easier and strictly typed.
const COCKATRICE_SCHEMA = `
  syntax = "proto2";
  package cockatrice;

  message ServerInfo_Card {
      optional sint32 id = 1 [default = -1];
      optional string name = 2;
  }

  message ServerInfo_PlayerProperties {
      optional string player_name = 1;
      optional string deck_storage_path = 3;
      repeated ServerInfo_Card main_deck = 4;
      repeated ServerInfo_Card sideboard = 5;
  }
  
  message Event_Join {
      optional ServerInfo_PlayerProperties player_properties = 1;
  }

  message GameEvent {
      optional sint32 player_id = 1 [default = -1];
      // We map the extension directly for easier JS consumption
      optional Event_Join ext_join = 1000; 
  }
  
  message GameEventContainer {
      optional sint32 game_id = 1;
      optional int32 seconds_elapsed = 2;
      repeated GameEvent event_list = 3;
  }

  message GameReplay {
      optional uint64 replay_id = 1;
      repeated bytes event_list = 3;
      optional uint32 duration_seconds = 4;
  }
`;

// Parse the schema once globally
const parsedSchema = protobuf.parse(COCKATRICE_SCHEMA);
const GameReplayMessage = parsedSchema.root.lookupType("cockatrice.GameReplay");
const GameEventContainerMessage = parsedSchema.root.lookupType("cockatrice.GameEventContainer");

// Strictly-typed interfaces for the parsed data
interface ParsedCard { id?: number; name?: string; }
interface ParsedJoinEvent { player_properties?: { main_deck?: ParsedCard[], sideboard?: ParsedCard[] } }
interface ParsedGameEvent { ext_join?: ParsedJoinEvent; }
interface ParsedContainer { event_list?: ParsedGameEvent[]; }




export interface ClientCard {
  entityId: string;
  name: string;
  imageUri?: string;
  cardTypes: string[];
  isTapped: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  power?: number | null;
  toughness?: number | null;
  damage: number;
  attachedTo?: string | null;
  targets: TargetInfo[];
}

export interface ClientZone {
  zoneId: ZoneId;
  cardIds: string[];
  size: number;
  isVisible: boolean;
}

export interface ClientGameState {
  cards: Record<string, ClientCard>;
  zones: ClientZone[];
  players: ClientPlayer[];
  currentPhase: string;
  currentStep: string;
  activePlayerId: string | null;
  priorityPlayerId: string | null;
  turnNumber: number;
  isGameOver: boolean;
  winnerId: string | null;
  combat: CombatState | null;
  gameLog: Array<Record<string, unknown>>;
}

export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: ClientGameState;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  currentPhase: string;
  activePlayerId: string | null;
  priorityPlayerId: string | null;
  isReplay: boolean;
  combat: CombatState | null;
}

// ============================================================================
// COMPONENT LOGIC
// ============================================================================
export default function CockatriceUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
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



   const processCorFile = async (file: File) => {
    if (!player1TeamId || !player2TeamId) {
        toast.error("Please select both teams before uploading.");
        return;
    }
    if (player1TeamId === player2TeamId) {
        toast.error("The two competing teams cannot be the same.");
        return;
    }
    if (!file.name.endsWith('.cor')) {
      toast.error("Invalid file type. Please upload a .cor file.");
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Decode the top-level GameReplay message
      const decodedReplay = GameReplayMessage.decode(uint8Array);
      const replayObject = GameReplayMessage.toObject(decodedReplay, { bytes: Array }) as { event_list?: number[][] };

      if (!replayObject.event_list || replayObject.event_list.length === 0) {
        throw new Error("Replay file is empty or contains no events.");
      }

      const cardDictionary = new Map<number, string>();

      // 2. Double-Decode: Iterate through each byte array and decode it into a GameEventContainer
      for (const containerBytes of replayObject.event_list) {
          const containerBuffer = new Uint8Array(containerBytes);
          const decodedContainer = GameEventContainerMessage.decode(containerBuffer);
          const eventContainer = GameEventContainerMessage.toObject(decodedContainer) as ParsedContainer;
          
          if (!eventContainer.event_list) continue;
          
          // 3. Iterate through the actual GameEvents
          for (const gameEvent of eventContainer.event_list) {
              if (gameEvent.ext_join?.player_properties) {
                  const properties = gameEvent.ext_join.player_properties;
                  
                  // 4. Extract card names to build the dictionary
                  if (properties.main_deck) {
                      properties.main_deck.forEach((card) => {
                          if (card.id != null && card.name) cardDictionary.set(card.id, card.name);
                      });
                  }
                  if (properties.sideboard) {
                      properties.sideboard.forEach((card) => {
                          if (card.id != null && card.name) cardDictionary.set(card.id, card.name);
                      });
                  }
              }
          }
      }

      console.log(`[Uploader] 📚 Dictionary built! Found ${cardDictionary.size} unique cards/tokens.`);
      
      if (cardDictionary.size === 0) {
          throw new Error("Failed to extract card IDs from the replay. The file may be corrupted or an unsupported version.");
      }

      // Success!
      toast.success(`Successfully mapped ${cardDictionary.size} cards from the decklists! Check the console.`);

      // (We will add the fetchReplayMetadata and buildArgentumStates calls back here in Step 2)

    } catch (error) {
      console.error("Error decoding .cor file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse the Cockatrice Replay.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
    
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
 const buildArgentumStates = (cockatriceData: any, cardDbMap: Map<string, DbCardMeta>): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      const currentState: SpectatorStateUpdate = {
          gameSessionId: "imported-cor-match",
          player1Id: "p1",
          player2Id: "p2",
          player1Name: "Player 1", // This will be replaced by the API
          player2Name: "Player 2", // This will be replaced by the API
          currentPhase: "MULLIGAN",
          activePlayerId: null,
          priorityPlayerId: null,
          isReplay: true,
          combat: null,
          gameState: {
              cards: {},
              zones: [],
              players: [
                  { playerId: 'p1', name: 'Player 1', life: 20 },
                  { playerId: 'p2', name: 'Player 2', life: 20 }
              ],
              currentPhase: "MULLIGAN",
              currentStep: "OPENING_HAND",
              activePlayerId: null,
              priorityPlayerId: null,
              turnNumber: 0,
              isGameOver: false,
              winnerId: null,
              combat: null,
              gameLog: []
          }
      };

      // Push the initial empty state
      states.push(JSON.parse(JSON.stringify(currentState)));

      if (!cockatriceData?.eventList) {
          return states;
      }
      
      // THIS IS WHERE YOU NEED TO IMPLEMENT THE CORE LOGIC
      // Loop through each event in the Cockatrice replay
      for (const eventBytes of cockatriceData.eventList) {
          // You will need to decode each event from its byte format
          // This typically involves another protobuf definition for individual events
          // like "MoveCardEvent", "TapCardEvent", "ChangePhaseEvent", etc.
          
          // ---- PSEUDO-CODE for what needs to happen inside the loop ----
          
          // 1. Decode the eventBytes to get the event type and data
          // const decodedEvent = YourEventDecoder(eventBytes);

          // 2. Create a deep copy of the last known state to modify
          // currentState = JSON.parse(JSON.stringify(states[states.length - 1]));
          
          // 3. Use a switch statement to handle each event type
          // switch (decodedEvent.type) {
          //    case 'GameStartEvent':
          //        // Populate initial player life, library zones, etc.
          //        break;
          //    case 'MoveCardEvent':
          //        // Find the card in currentState.gameState.cards
          //        // Update its zone, or add it if it's new
          //        // This is where you would use the cardDbMap to enrich with image URLs
          //        break;
          //    case 'TapCardEvent':
          //        // Update the isTapped property of the card
          //        break;
          //    case 'ChangePhaseEvent':
          //        // Update the currentPhase and currentStep
          //        break;
          //    // ... etc. for all other cockatrice events
          // }

          // 4. Push the new, updated state to the states array
          // states.push(currentState);
      }

      // For now, we return the initial state to confirm the pipeline works
      // Once the loop is implemented, you will return all generated states.
      return states;
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
        
        {/* --- NEW TEAM SELECTOR UI --- */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Player 1 (You)</label>
                  <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={player1TeamId}
                      onChange={(e) => setPlayer1TeamId(e.target.value)}
                  >
                      <option value="" disabled>Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Player 2 (Opponent)</label>
                  <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={player2TeamId}
                      onChange={(e) => setPlayer2TeamId(e.target.value)}
                  >
                      <option value="" disabled>Select Team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
              </div>
          </div>

          {/* MATCH STATUS INDICATOR */}
          {player1TeamId && player2TeamId && (
              <div className="bg-muted/30 p-3 rounded-md border text-sm flex items-center gap-2">
                  {isSearchingMatch ? (
                      <><Loader2 className="size-4 animate-spin text-muted-foreground" /> Searching schedule...</>
                  ) : matchId ? (
                      <><CheckCircle2 className="size-4 text-emerald-500" /> Linked to active weekly match!</>
                  ) : (
                      <><AlertCircle className="size-4 text-amber-500" /> No active match found. Will upload unlinked.</>
                  )}
              </div>
          )}
        </div>

        {/* FILE UPLOAD ZONE */}
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



