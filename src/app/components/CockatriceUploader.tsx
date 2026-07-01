//src/app/components/CockatriceUploader.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Upload, FileCode2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as protobuf from "protobufjs";
import { getReplayUploaderData, findMatchIdForTeams, type UploaderTeam } from "@/app/actions/replayActions";

// ============================================================================
// COCKATRICE PROTOBUF SCHEMA (EXACT MATCH)
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
      optional sint32 new_card_id = 10 [default = -1];
  }

  message Event_CreateToken {
      optional string zone_name = 1;
      optional sint32 card_id = 2;
      optional string card_name = 3;
  }

  message GameEvent {
      optional sint32 player_id = 1 [default = -1];
      
      // Extensions explicitly mapped
      optional Event_GameStateChanged ext_game_state_changed = 1005;
      optional Event_MoveCard ext_move_card = 2009;
      optional Event_DrawCards ext_draw_cards = 2005;
      optional Event_CreateToken ext_create_token = 2013;
  }
  
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
        
        if (typeof idVal === 'number' && typeof nameVal === 'string') {
            if (idVal > 0 && nameVal.trim().length > 0) {
                dict.set(idVal, nameVal);
            }
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
          enums: String,
          longs: Number,
          bytes: Array,
          defaults: true 
      }) as Record<string, unknown>;

      const rawEventList = (replayObject.eventList || replayObject.event_list) as Array<Record<string, unknown>>;

      if (!rawEventList || !Array.isArray(rawEventList) || rawEventList.length === 0) {
        throw new Error("Replay file is empty or contains no events.");
      }

      console.log(`[Diagnostic] Sweeping ${rawEventList.length} containers for interesting data...`);
      
      const interestingEvents: Array<Record<string, unknown>> = [];
      
      for (const container of rawEventList) {
          const events = (container.eventList || container.event_list || []) as Array<Record<string, unknown>>;
          for (const ev of events) {
              if (Object.keys(ev).some(k => k !== 'playerId' && k !== 'player_id')) {
                  interestingEvents.push(ev);
              }
          }
      }

      console.log("================ DIAGNOSTIC DUMP ================");
      console.log("Found", interestingEvents.length, "populated events.");
      console.log("First 2 populated events:");
      console.log(JSON.stringify(interestingEvents.slice(0, 2), null, 2));
      console.log("=================================================");

      const cardDict = extractCardDictionary(replayObject);
      console.log(`[Diagnostic] Dictionary extractor ran and found ${cardDict.size} cards.`);
      
      if (cardDict.size > 0) {
        console.log("[Uploader] DICTIONARY DUMP:", Object.fromEntries(cardDict));
        toast.success(`Diagnostic dump complete! Found ${cardDict.size} cards.`);
      } else {
        toast.error("Diagnostic dump complete! Still 0 cards. Check console.");
      }

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
