// src/app/teams/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

const teams = [
  { name: "Alara Shards", href: "/teams/shards", emoji: "🌟", motto: "Why not both?", color: "bg-purple-500" },
  { name: "Innistrad Creeps", href: "/teams/creeps", emoji: "🧟", motto: "Graveyard, Gatekeep, Girlboss", color: "bg-indigo-500" },
  { name: "Kamigawa Ninja", href: "/teams/ninja", emoji: "⛩", motto: "Omae wa mou shindeiru.", color: "bg-red-500" },
  { name: "Lorwyn Changelings", href: "/teams/changelings", emoji: "👽", motto: "Expect the unexpected", color: "bg-cyan-500" },
  { name: "Ravnica Guildpact", href: "/teams/guildpact", emoji: "🔗", motto: "A Championship is won and lost before ever entering the battlefield", color: "bg-blue-500" },
  { name: "Tarkir Dragons", href: "/teams/dragons", emoji: "🐲", motto: "No cost too great", color: "bg-pink-500" },
  { name: "Theros Demigods", href: "/teams/demigods", emoji: "🌞", motto: "The Fates will decide", color: "bg-yellow-500" },
  { name: "Zendikar Hedrons", href: "/teams/hedrons", emoji: "💠", motto: "Good Vibes, No Escape", color: "bg-green-500" },
];

export default function TeamsPage() {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map((team) => (
          <Link key={team.name} href={team.href}>
            <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer h-full">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className={`size-16 rounded-full flex items-center justify-center flex-shrink-0 ${team.color}`}>
                  <span className="text-3xl">{team.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl">{team.name}</CardTitle>
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
        ))}
      </div>
    </div>
  );
}
