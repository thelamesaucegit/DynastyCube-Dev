// src/app/teams/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import { DraftStatusWidget, getTeamDraftBadge } from "@/app/components/DraftStatusWidget";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { getTeamsWithDetails, type TeamWithDetails } from "@/app/actions/teamActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions";
import { getActiveDraftSession } from "@/app/actions/draftSessionActions"; // Import the action

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);
  const [seasonPhase, setSeasonPhase] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [teamsResult, seasonResult, sessionResult] = await Promise.all([
          getTeamsWithDetails(),
          getCurrentSeason(),
          getActiveDraftSession(), // Fetch the active session
        ]);
        
        // Process teams
        if (teamsResult.teams) {
          const sortedTeams = teamsResult.teams.sort((a, b) => a.name.localeCompare(b.name));
          setTeams(sortedTeams);
        }
        
        // Process season
        if (seasonResult.season) {
          setSeasonPhase(seasonResult.season.phase);
        }
        
        // THIS IS THE FIX: Use the session ID to get the correct draft status
        const sessionId = sessionResult.session?.id;
        if (sessionId) {
          const draftStatusResult = await getDraftStatus(sessionId);
          if (draftStatusResult.status) {
            setDraftStatus(draftStatusResult.status);
          }
        } else {
          // Handle case where there is no active draft
          const draftStatusResult = await getDraftStatus();
           if (draftStatusResult.status) {
            setDraftStatus(draftStatusResult.status);
          }
        }

      } catch (error) {
        console.error("Failed to load page data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();

    // Set up polling for draft status
    const intervalId = setInterval(async () => {
      try {
        const sessionResult = await getActiveDraftSession();
        const sessionId = sessionResult.session?.id;
        const draftStatusResult = await getDraftStatus(sessionId);
        if (draftStatusResult.status) {
          setDraftStatus(draftStatusResult.status);
        }
      } catch (error) {
        console.error("Failed to refresh draft status:", error);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

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
          <p className="text-muted-foreground mt-1">Meet the teams of the Dynasty Cube League</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="size-5" />
          <span className="text-sm font-medium">{teams.length} Teams</span>
        </div>
      </div>
      
      <DraftStatusWidget variant="compact" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {teams.map((team) => {
          const badge = getTeamDraftBadge(draftStatus, team.id);
          const primaryColor = team.primary_color || "#71717a";
          const secondaryColor = team.secondary_color || "#e4e4e7";

          return (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className={`group relative hover:shadow-xl hover:z-50 transition-all hover:-translate-y-1 cursor-pointer h-full flex flex-col ${
                badge === "clock" ? "ring-2 ring-green-500" : badge === "deck" ? "ring-2 ring-yellow-500" : ""
              }`}>
                <CardHeader className="flex flex-col items-center text-center gap-2 pb-2">
                  <div className="relative size-16 flex-shrink-0 flex items-center justify-center mb-2">
                    <div
                      className="absolute size-16 rounded-full"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <div
                      className="absolute size-14 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
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
                    
                    <div className="text-center w-full">
                      <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-1">RECORD</p>
                      <p className="text-xl font-bold">{team.wins} - {team.losses}</p>
                    </div>
                    
                    {seasonPhase === "draft" && (
                      <div className="text-center border-t border-border/50 pt-4 w-full">
                        <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-2">LAST PICK</p>
                        
                        {team.last_pick?.image_url ? (
                          <div className="relative size-12 mx-auto group/pick">
                            <img
                              src={team.last_pick.image_url}
                              alt={team.last_pick.card_name}
                              className="size-12 rounded-sm object-cover shadow-sm relative z-10"
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 group-hover/pick:opacity-100 transition-opacity duration-200 z-[100]">
                              <img
                                src={team.last_pick.image_url}
                                alt={team.last_pick.card_name}
                                className="h-72 w-auto max-w-none rounded-lg object-contain shadow-2xl drop-shadow-2xl"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" className="w-full mt-auto" tabIndex={-1}>
                    View Team Profile
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
