//src/app/components/CockatriceUploader.tsx

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Upload, FileCode2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";
import { fetchReplayMetadata, getReplayUploaderData, findMatchIdForTeams, type DbCardMeta, type UploaderTeam } from "@/app/actions/replayActions";
import { decompress_lzma_replay } from "@/app/actions/toolActions"; // Assuming the tool is available here
import type { SpectatorStateUpdate } from "@/app/types";

// ============================================================================
// COCKATRICE PROTOBUF SCHEMA
// ============================================================================
const COCKATRICE_SCHEMA = `
  syntax = "proto2";
  package cockatrice;

  message ServerInfo_Card {
      optional sint32 id = 1 [default = -1];
      optional string name = 2;
  }

  message ServerInfo_PlayerProperties {
      optional string player_name = 1;
      repeated ServerInfo_Card main_deck = 4;
      repeated ServerInfo_Card sideboard = 5;
  }
  
  message Event_Join {
      optional ServerInfo_PlayerProperties player_properties = 1;
  }

  message GameEvent {
      optional sint32 player_id = 1 [default = -1];
      extensions 100 to max;
      optional Event_Join ext_join = 1000;
  }
  
  message GameEventContainer {
      optional sint32 game_id = 1;
      optional int32 seconds_elapsed = 2;
      repeated GameEvent event_list = 3;
  }

  message GameReplay {
      optional uint64 replay_id = 1;
      repeated GameEventContainer event_list = 3;
      optional uint32 duration_seconds = 4;
  }
`;

const parsedSchema = protobuf.parse(COCKATRICE_SCHEMA).root;
const GameReplayMessage = parsedSchema.lookupType("cockatrice.GameReplay");

interface ParsedCard { id?: number; name?: string; }
interface ParsedJoinEvent { player_properties?: { main_deck?: ParsedCard[], sideboard?: ParsedCard[] } }
interface ParsedGameEvent { ext_join?: ParsedJoinEvent; }
interface ParsedContainer { event_list?: ParsedGameEvent[]; }
interface ParsedReplay { event_list?: ParsedContainer[]; }


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
      
      // 1. Convert to Base64 to send to Python
      const base64String = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(arrayBuffer))));
      
      console.log("[Uploader] 1. File encoded. Calling Python decompressor...");
      
      // 2. Decompress via Python tool
      const decompressedBase64 = await decompress_lzma_replay(base64String);
      
      if (!decompressedBase64) {
        throw new Error("Decompression failed. The file may be corrupted.");
      }
      
      console.log("[Uploader] 2. Decompression successful. Decoding protobuf...");

      // 3. Decode the returned (decompressed) base64 string back to bytes
      const decodedString = atob(decompressedBase64);
      const uint8Array = new Uint8Array(decodedString.length);
      for (let i = 0; i < decodedString.length; i++) {
          uint8Array[i] = decodedString.charCodeAt(i);
      }

      // 4. Decode the raw protobuf bytes
      const decodedReplay = GameReplayMessage.decode(uint8Array);
      const replayObject = GameReplayMessage.toObject(decodedReplay) as ParsedReplay;
      
      if (!replayObject.event_list || replayObject.event_list.length === 0) {
        throw new Error("Replay file is empty or contains no events after decompression.");
      }

      const cardDictionary = new Map<number, string>();

      for (const eventContainer of replayObject.event_list) {
        if (!eventContainer.event_list) continue;
        for (const gameEvent of eventContainer.event_list) {
            if (gameEvent.ext_join?.player_properties) {
                const properties = gameEvent.ext_join.player_properties;
                if (properties.main_deck) {
                    properties.main_deck.forEach(card => {
                        if (card.id != null && card.name) cardDictionary.set(card.id, card.name);
                    });
                }
                if (properties.sideboard) {
                    properties.sideboard.forEach(card => {
                        if (card.id != null && card.name) cardDictionary.set(card.id, card.name);
                    });
                }
            }
        }
      }

      if (cardDictionary.size === 0) {
        throw new Error("Failed to extract card IDs. The replay file is valid, but no decklists were found inside.");
      }

      toast.success(`Success! Found ${cardDictionary.size} cards.`);
      // The rest of the logic (buildArgentumStates, API call) will be added back here
      // once this step is confirmed to be working.

    } catch (error) {
      console.error("Error in processCorFile:", error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
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
