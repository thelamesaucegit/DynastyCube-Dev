// src/app/teams/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";
import { DraftStatusWidget, getTeamDraftBadge } from "@/app/components/DraftStatusWidget";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";

const teams = [
  { id: "shards", name: "Alara Shards", href: "/teams/shards", emoji: "🌟", motto: "Why not both?", color: "bg-purple-500" },
  { id: "creeps", name: "Innistrad Creeps", href: "/teams/creeps", emoji: "🧟", motto: "Graveyard, Gatekeep, Girlboss", color: "bg-indigo-500" },
  { id: "ninja", name: "Kamigawa Ninja", href: "/teams/ninja", emoji: "⛩", motto: "Omae wa mou shindeiru.", color: "bg-red-500" },
  { id: "changelings", name: "Lorwyn Changelings", href: "/teams/changelings", emoji: "👽", motto: "Expect the unexpected", color: "bg-cyan-500" },
  { id: "guildpact", name: "Ravnica Guildpact", href: "/teams/guildpact", emoji: "🔗", motto: "A Championship is won and lost before ever entering the battlefield", color: "bg-blue-500" },
  { id: "dragons", name: "Tarkir Dragons", href: "/teams/dragons", emoji: "🐲", motto: "No cost too great", color: "bg-pink-500" },
  { id: "demigods", name: "Theros Demigods", href: "/teams/demigods", emoji: "🌞", motto: "The Fates will decide", color: "bg-yellow-500" },
  { id: "hedrons", name: "Zendikar Hedrons", href: "/teams/hedrons", emoji: "💠", motto: "Good Vibes, No Escape", color: "bg-green-500" },
];

export default function TeamsPage() {
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null);

  useEffect(() => {
    getDraftStatus().then((result) => setDraftStatus(result.status));
  }, []);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">Meet the teams of the Dynasty Cube League</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="size-5" />
          <span className="text-sm font-medium">{teams.length} Teams</span>
        </div>
      </div>

      {/* Draft Status Banner */}
      <DraftStatusWidget variant="compact" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map((team) => {
          const badge = getTeamDraftBadge(draftStatus, team.id);

          return (
            <Link key={team.name} href={team.href}>
              <Card className={`hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer h-full ${
                badge === "clock" ? "ring-2 ring-green-500/40" : badge === "deck" ? "ring-2 ring-yellow-500/40" : ""
              }`}>
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className={`size-16 rounded-full flex items-center justify-center flex-shrink-0 ${team.color}`}>
                    <span className="text-3xl">{team.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                      {badge === "clock" && (
                        <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 text-xs gap-1">
                          <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                          On the Clock
                        </Badge>
                      )}
                      {badge === "deck" && (
                        <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-xs">
                          On Deck
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground italic mt-1 line-clamp-2">
                      &ldquo;{team.motto}&rdquo;
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" tabIndex={-1}>
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
