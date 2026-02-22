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

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);

  // FIX 2: Implement polling to keep draft status up-to-date
  useEffect(() => {
    const fetchDraftStatus = async () => {
      try {
        const draftStatusResult = await getDraftStatus();
        if (draftStatusResult.status) {
          setDraftStatus(draftStatusResult.status);
        }
      } catch (error) {
        console.error("Failed to refresh draft status:", error);
      }
    };

    // Fetch initial status
    fetchDraftStatus();

    // Set up an interval to fetch every 15 seconds
    const intervalId = setInterval(fetchDraftStatus, 15000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []);


  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const teamsResult = await getTeamsWithDetails();
        if (teamsResult.teams) {
          // FIX 1: Sort teams alphabetically by name to ensure a static order
          const sortedTeams = teamsResult.teams.sort((a, b) => a.name.localeCompare(b.name));
          setTeams(sortedTeams);
        }
      } catch (error) {
        console.error("Failed to load page data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
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

      {/* This widget will now update automatically due to the polling useEffect */}
      <DraftStatusWidget variant="compact" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map((team) => {
          const badge = getTeamDraftBadge(draftStatus, team.id);
          const primaryColor = team.primary_color || "#71717a"; // Default gray
          const secondaryColor = team.secondary_color || "#e4e4e7"; // Default light gray

          return (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className={`group relative hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer h-full flex flex-col ${
                badge === "clock" ? "ring-2 ring-green-500" : badge === "deck" ? "ring-2 ring-yellow-500" : ""
              }`}>
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="relative size-16 flex-shrink-0 flex items-center justify-center">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                      {/* ... Badge logic will now use updated draftStatus ... */}
                    </div>
                    <p className="text-sm text-muted-foreground italic mt-1 line-clamp-2">
                      &ldquo;{team.motto}&rdquo;
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  <div className="flex-grow flex items-center justify-between gap-4 mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="text-center">
                      <p className="text-xs font-semibold text-muted-foreground">RECORD</p>
                      <p className="text-lg font-bold">{team.wins} - {team.losses}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-muted-foreground">LAST PICK</p>
                      {team.last_pick?.image_url ? (
                        <div className="relative size-10 mt-1 group/pick">
                          <img
                            src={team.last_pick.image_url}
                            alt={team.last_pick.card_name}
                            className="size-10 rounded-sm object-cover shadow-md"
                          />
                          {/* FIX 3: Pop-out card image on hover */}
                          <img
                            src={team.last_pick.image_url}
                            alt={team.last_pick.card_name}
                            className="absolute bottom-0 left-0 h-64 w-auto z-10 rounded-lg object-contain shadow-2xl pointer-events-none opacity-0 group-hover/pick:opacity-100 transition-opacity transform-gpu origin-bottom-left"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">-</p>
                      )}
                    </div>
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
