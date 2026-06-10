// src/app/teams/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";
import { DraftStatusWidget, getTeamDraftBadge } from "@/app/components/DraftStatusWidget";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { getTeamsWithDetails, type TeamWithDetails } from "@/app/actions/teamActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions";

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);
  const [seasonPhase, setSeasonPhase] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsResult, seasonResult] = await Promise.all([
        getTeamsWithDetails(),
        getCurrentSeason(),
      ]);

      if (teamsResult.teams) {
        const sortedTeams = teamsResult.teams.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sortedTeams);
      }
      
      if (seasonResult.season) {
        const phase = seasonResult.season.phase;
        setSeasonPhase(phase);
        
        if (phase === 'draft') {
          const draftStatusResult = await getDraftStatus();
          if (draftStatusResult.status) {
            setDraftStatus(draftStatusResult.status);
          }
        } else {
          setDraftStatus(null); 
        }
      }
    } catch (error) {
      console.error("Failed to load page data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="size-5" />
          <span className="text-sm font-medium">{teams.length} Teams</span>
        </div>
      </div>
      
      {seasonPhase === 'draft' && <DraftStatusWidget variant="compact" />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {teams.map((team) => {
          const badge = getTeamDraftBadge(draftStatus, team.id);
          const primaryColor = team.primary_color || "#71717a";
          const secondaryColor = team.secondary_color || "#e4e4e7";
          const isEliminated = team.is_escaped;

          return (
            <Link key={team.short_name} href={`/teams/${team.short_name}`}>
              <Card className={`group relative transition-all cursor-pointer h-full flex flex-col overflow-hidden ${
                badge === "clock" ? "ring-2 ring-green-500" : badge === "deck" ? "ring-2 ring-yellow-500" : ""
              } ${!isEliminated ? "hover:shadow-xl hover:z-50 hover:-translate-y-1" : ""}`}>
                
                {/* --- PARTY TIME LAYER --- */}
                {isEliminated && (
                  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                     <span className="absolute top-2 left-2 text-4xl rotate-12 opacity-90 drop-shadow-md">🎉</span>
                     <span className="absolute bottom-16 right-2 text-3xl -rotate-12 opacity-90 drop-shadow-md">🥳</span>
                     <span className="absolute top-1/2 left-4 text-4xl rotate-45 opacity-90 drop-shadow-md">🎈</span>
                     <span className="absolute top-4 right-6 text-2xl opacity-90 drop-shadow-md">✨</span>
                     <span className="absolute bottom-4 left-1/3 text-3xl opacity-90 drop-shadow-md">🎊</span>
                     {/* Subtle dark wash so text remains legible */}
                     <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
                  </div>
                )}
                
                {/* Wrap the content in a div that takes the 40% fade if eliminated */}
                <div className={`flex flex-col h-full relative z-10 ${isEliminated ? 'opacity-40 grayscale-[0.3]' : ''}`}>
                  <CardHeader className="flex flex-col items-center text-center gap-2 pb-2">
                    <div className="relative size-16 flex-shrink-0 flex items-center justify-center mb-2">
                      <div className="absolute size-16 rounded-full" style={{ backgroundColor: secondaryColor }} />
                      <div className="absolute size-14 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <span className="relative text-3xl drop-shadow-lg">{team.emoji}</span>
                    </div>
                    <CardTitle className="text-xl leading-none">{team.name}</CardTitle>
                    
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full mt-1">
                      <Users className="size-3" />
                      <span>{team.member_count} Members</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic mt-2 line-clamp-2">
                      &ldquo;{team.motto}&rdquo;
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col w-full">
                    <div className="flex-grow flex flex-col items-center justify-center gap-4 mb-4 p-4 rounded-lg bg-muted/30 w-full border border-border/50">
                      <div className="text-center w-full group/record relative">
                          <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-1 sm:cursor-help">RECORD</p>
                          <p className="text-xl font-bold sm:cursor-help">{Math.floor(team.wins)} - {Math.floor(team.losses)}</p>
                          
                          <p className="text-[10px] text-muted-foreground mt-1 sm:hidden">
                            ({team.game_wins}W - {team.game_losses}L games)
                          </p>
                          <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded shadow-xl border opacity-0 group-hover/record:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                              <p className="font-bold border-b border-border mb-1">Tiebreaker Detail</p>
                              <p>{team.game_wins}W - {team.game_losses}L in Individual Games</p>
                          </div>
                      </div>
                      {seasonPhase === "draft" && (
                        <div className="text-center border-t border-border/50 pt-4 w-full">
                          <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-2">LAST PICK</p>
                          {team.last_pick?.image_url ? (
                            <div className="relative size-12 mx-auto group/pick">
                              <Image
                                src={team.last_pick.image_url}
                                alt={team.last_pick.card_name}
                                width={48}
                                height={48}
                                className="size-12 rounded-sm object-cover shadow-sm relative z-10"
                              />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 group-hover/pick:opacity-100 transition-opacity duration-200 z-[100]">
                                <Image
                                  src={team.last_pick.image_url}
                                  alt={team.last_pick.card_name}
                                  width={206}
                                  height={288}
                                  className="rounded-lg object-contain shadow-2xl drop-shadow-2xl"
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">-</p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button variant={isEliminated ? "secondary" : "outline"} className="w-full mt-auto" tabIndex={-1}>
                      View Team Profile
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </CardContent>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
