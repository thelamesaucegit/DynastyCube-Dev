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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!player1TeamId || !player2TeamId) {
        toast.error("Please select both competing teams before uploading.");
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

      const root = new protobuf.Root();
      root.define("cockatrice")
          .add(new protobuf.Type("GameReplay")
              .add(new protobuf.Field("replayId", 1, "int32"))
              .add(new protobuf.Field("eventList", 2, "bytes", "repeated"))
          );
      const GameReplayMessage = root.lookupType("cockatrice.GameReplay");
      const decodedMessage = GameReplayMessage.decode(uint8Array);
      const replayObject = GameReplayMessage.toObject(decodedMessage, { longs: String, enums: String, bytes: Array });

      const uniqueNames = extractUniqueCardNames(replayObject);
      const { success, cards } = await fetchReplayMetadata(uniqueNames);
      if (!success) throw new Error("Failed to fetch card metadata from the database.");

      const cardDbMap = new Map<string, DbCardMeta>();
      cards?.forEach(c => cardDbMap.set(c.card_name.toLowerCase(), c));

      // 3. Transform to Argentum State Machine
      const argentumReplay = buildArgentumStates(replayObject, cardDbMap);

      if (argentumReplay.length > 0) {
     const team1 = teams.find(t => t.id === player1TeamId);
         const team2 = teams.find(t => t.id === player2TeamId)

         const response = await fetch('/api/pvp-replays', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 argentum_game_states: argentumReplay,
                 original_filename: file.name,
                 match_id: matchId,
                 team1_id: team1?.id,
                 team2_id: team2?.id,
                 team1_name: team1?.name,
                 team1_color: team1?.primary_color,
                 team1_seccolor: team1?.secondary_color,
                 team2_name: team2?.name,
                 team2_color: team2?.primary_color,
                 team2_seccolor: team2?.secondary_color,
             })
         });

         const result = await response.json();
         if (!response.ok || !result.success) throw new Error(result.error || "Failed to save the replay.");
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const buildArgentumStates = (cockatriceData: any, cardDbMap: Map<string, DbCardMeta>): SpectatorStateUpdate[] => {
      const states: SpectatorStateUpdate[] = [];
      const currentState: SpectatorStateUpdate = {
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
          {team1Id && team2Id && (
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



