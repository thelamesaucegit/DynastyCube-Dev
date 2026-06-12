//src/app/components/CockatriceUploader.tsx

"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Upload, FileCode2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";
import { fetchReplayMetadata } from "@/app/actions/replayActions"; // The server action we just made!

// ============================================================================
// ARGENTUM STATE TYPES 
// ============================================================================
export interface TargetInfo { entityId: string; type: string; }
export interface ZoneId { zoneType: string; ownerId: string; }
export interface CombatGroup { attackerId: string; blockers: string[]; }
export interface CombatState { groups: CombatGroup[]; attackers: string[]; }
export interface ClientPlayer { playerId: string; name: string; life: number; }

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

  // Recursive helper to find all "cardName" or "name" fields in the raw Protobuf JSON
  const extractUniqueCardNames = (obj: any, namesSet = new Set<string>()): string[] => {
    if (!obj) return Array.from(namesSet);
    if (typeof obj === 'object') {
        if (obj.cardName && typeof obj.cardName === 'string') namesSet.add(obj.cardName);
        if (obj.name && typeof obj.name === 'string') namesSet.add(obj.name);
        
        Object.values(obj).forEach(val => extractUniqueCardNames(val, namesSet));
    } else if (Array.isArray(obj)) {
        obj.forEach(item => extractUniqueCardNames(item, namesSet));
    }
    return Array.from(namesSet);
  };

  const processCorFile = async (file: File) => {
    if (!file.name.endsWith('.cor')) {
      toast.error("Invalid file type. Please upload a .cor file.");
      return;
    }

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Load Protobuf Schema
      const root = new protobuf.Root();
      root.define("cockatrice")
          .add(new protobuf.Type("GameReplay")
              .add(new protobuf.Field("replayId", 1, "int32"))
              .add(new protobuf.Field("eventList", 2, "bytes", "repeated"))
          );
      const GameReplayMessage = root.lookupType("cockatrice.GameReplay");
      
      const decodedMessage = GameReplayMessage.decode(uint8Array);
      const replayObject = GameReplayMessage.toObject(decodedMessage, { longs: String, enums: String, bytes: Array });

      // 2. Extract Card Names & Fetch Metadata from card_pools
      const uniqueNames = extractUniqueCardNames(replayObject);
      console.log(`Extracted ${uniqueNames.length} unique card names from replay. Fetching metadata...`);
      
      const { success, cards } = await fetchReplayMetadata(uniqueNames);
      if (!success) throw new Error("Failed to fetch card metadata from the database.");

      const cardDbMap = new Map<string, any>();
      cards?.forEach(c => cardDbMap.set(c.card_name.toLowerCase(), c));

      // 3. Transform to Argentum State Machine
      const argentumReplay = buildArgentumStates(replayObject, cardDbMap);

      if (argentumReplay.length > 0) {
         console.log(`Converted ${argentumReplay.length} states. Uploading to database...`);
         
         // --- THE NEW API CALL ---
         const response = await fetch('/api/pvp-replays', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 argentum_game_states: argentumReplay,
                 original_filename: file.name,
                 // TODO: You can pass match_id, team1_id, etc. here if you have them in the component state!
             })
         });

         const result = await response.json();

         if (!response.ok || !result.success) {
             throw new Error(result.error || "Failed to save the replay to the database.");
         }

         toast.success(`Successfully saved PvP replay to the database!`);
      } else {
         toast.warning("Replay was parsed, but no valid game states were generated.");
      }

    } catch (error) {
      console.error("Error decoding .cor file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse the Cockatrice Replay.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  /**
   * The State Machine Translator
   * Steps through the Cockatrice events, uses our database map to enrich cards, and builds Argentum.
   */
  const buildArgentumStates = (cockatriceData: any, cardDbMap: Map<string, any>): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      
      // Base skeleton
      let currentState: SpectatorStateUpdate = {
          gameSessionId: "imported-cor-match",
          player1Id: "p1", player2Id: "p2",
          player1Name: "Player 1", player2Name: "Player 2",
          currentPhase: "MULLIGAN",
          activePlayerId: null, priorityPlayerId: null,
          isReplay: true,
          combat: null,
          gameState: {
              cards: {}, zones: [], players: [],
              currentPhase: "MULLIGAN", currentStep: "OPENING_HAND",
              activePlayerId: null, priorityPlayerId: null,
              turnNumber: 0, isGameOver: false, winnerId: null, combat: null, gameLog: []
          }
      };

      // Example of enriching a card during the step-through:
      // function createClientCard(cockatriceCardName: string, entityId: string): ClientCard {
      //     const dbMeta = cardDbMap.get(cockatriceCardName.toLowerCase());
      //     return {
      //         entityId: entityId,
      //         name: cockatriceCardName,
      //         imageUri: dbMeta?.image_url || dbMeta?.oldest_image_url || undefined,
      //         cardTypes: dbMeta?.card_type ? dbMeta.card_type.split(' ') : [],
      //         isTapped: false, isAttacking: false, isBlocking: false, damage: 0, targets: []
      //     };
      // }

      // ... Iteration logic over cockatriceData.eventList ...
      
      states.push(JSON.parse(JSON.stringify(currentState))); // Push final state

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
          Upload a binary <code>.cor</code> file. It will be enriched with Dynasty Cube database metadata and converted to an Argentum state.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
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


