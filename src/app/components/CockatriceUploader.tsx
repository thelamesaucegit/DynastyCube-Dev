//src/app/components/CockatriceUploader.tsx

"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Upload, FileCode2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";

// ============================================================================
// ARGENTUM STATE TYPES (Mapped perfectly from ArgentumData.java)
// ============================================================================
export interface TargetInfo {
  entityId: string;
  type: string;
}

export interface ZoneId {
  zoneType: string;
  ownerId: string;
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface ClientCard {
  entityId: string;
  name: string;
  imageUri?: string;
  cardTypes: string[];
  isTapped: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  power?: number;
  toughness?: number;
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

export interface ClientPlayer {
  playerId: string;
  name: string;
  life: number;
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

  const processCorFile = async (file: File) => {
    if (!file.name.endsWith('.cor')) {
      toast.error("Invalid file type. Please upload a .cor file.");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Read the raw binary data
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 2. Load the Cockatrice Protobuf Schema
      // NOTE: In a production environment, you should download the exact `game_replay.proto` 
      // from the Cockatrice GitHub, place it in your `public/` folder, and load it via:
      // await protobuf.load("/game_replay.proto");
      
      // For this implementation, we will use a dynamically constructed minimal Root 
      // to extract the EventList payload based on standard Cockatrice schemas.
      const root = new protobuf.Root();
      root.define("cockatrice")
          .add(new protobuf.Type("GameReplay")
              .add(new protobuf.Field("replayId", 1, "int32"))
              .add(new protobuf.Field("eventList", 2, "bytes", "repeated"))
          );

      const GameReplayMessage = root.lookupType("cockatrice.GameReplay");
      
      // 3. Decode the Binary!
      // This will throw if the binary format is completely malformed
      const decodedMessage = GameReplayMessage.decode(uint8Array);
      const replayObject = GameReplayMessage.toObject(decodedMessage, {
          longs: String,
          enums: String,
          bytes: Array
      });

      console.log("Successfully unpacked .cor Protobuf:", replayObject);

      // 4. Transform to Argentum State Machine
      const argentumReplay = buildArgentumStates(replayObject);

      if (argentumReplay.length > 0) {
         console.log("Final Argentum Replay Payload:", argentumReplay);
         toast.success(`Successfully converted ${argentumReplay.length} game states!`);
         // TODO: POST this `argentumReplay` array to your database or Simulation API!
      }

    } catch (error) {
      console.error("Error decoding .cor file:", error);
      toast.error("Failed to parse the Cockatrice Replay. Ensure it is a valid .cor file.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * The State Machine Translator
   * Steps through the dumb UI events of Cockatrice and builds the Smart Argentum state.
   */
  const buildArgentumStates = (cockatriceData: any): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      
      // Base skeleton initialized
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

      // TODO: Iterate over cockatriceData.eventList
      // Because Cockatrice event lists are deeply nested extensions, you will need 
      // to map the internal byte payloads to things like "MoveCard", "SetLife", etc.
      // Every time you detect a phase change or a major action, push a deep copy of `currentState` to `states`.
      
      // Example placeholder push:
      states.push(JSON.parse(JSON.stringify(currentState)));

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
          Upload a binary <code>.cor</code> file to automatically unpack and translate it into an Argentum-compatible JSON history.
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
              <p className="font-bold tracking-widest uppercase text-sm">Translating to Argentum...</p>
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

