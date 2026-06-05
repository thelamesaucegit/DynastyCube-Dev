// src/app/components/team/TrophyCase.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from "@/app/components/ui/card";
import { Loader2 } from "lucide-react";

// --- STRICT INTERFACES FOR SUPABASE DATA ---
interface ChampionshipTeam {
    name: string;
    emoji: string;
    primary_color?: string | null;
    secondary_color?: string | null;
}

interface ChampionshipSeason {
    name: string;
}

interface ChampionshipMatch {
    season_id: string;
    week_number: number;
    season: ChampionshipSeason | ChampionshipSeason[];
    team: ChampionshipTeam | ChampionshipTeam[];
}
// -------------------------------------------

interface TrophyCaseProps {
    teamId: string;
}

export function TrophyCase({ teamId }: TrophyCaseProps) {
    const [championships, setChampionships] = useState<ChampionshipMatch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchChampionships() {
            const supabase = createClient();
            
            // 1. Find all weekly matchups that are playoffs, finalized, and this team won
            const { data: finalMatches, error: matchesError } = await supabase
                .from('weekly_matchups')
                .select(`
                    season_id,
                    week_number,
                    season:seasons!season_id(name),
                    team:teams!winner_team_id(name, emoji, primary_color, secondary_color)
                `)
                .eq('winner_team_id', teamId)
                .eq('is_playoff', true)
                .eq('is_outcome_final', true);

            if (matchesError) {
                console.error("Error fetching championships:", matchesError);
                setLoading(false);
                return;
            }

            // STRICT TYPING FIX: Cast the raw DB response to our interface array
            const typedMatches = (finalMatches || []) as unknown as ChampionshipMatch[];

            // 2. We only want the FINAL match of the playoffs for each season
            // So we group by season and take the highest week number
            const seasonWinners = new Map<string, ChampionshipMatch>();
            
            typedMatches.forEach((match: ChampionshipMatch) => {
                const currentMaxWeek = seasonWinners.get(match.season_id)?.week_number || 0;
                if (match.week_number > currentMaxWeek) {
                    seasonWinners.set(match.season_id, match);
                }
            });

            setChampionships(Array.from(seasonWinners.values()));
            setLoading(false);
        }

        fetchChampionships();
    }, [teamId]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (championships.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                <div className="text-6xl mb-4 opacity-50 grayscale">🏆</div>
                <h3 className="text-xl font-bold mb-2">No Championships Yet</h3>
                <p>This team is still fighting for their first Dynasty Cube title!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-700">
            {championships.map((champ) => {
                const team = Array.isArray(champ.team) ? champ.team[0] : champ.team;
                const season = Array.isArray(champ.season) ? champ.season[0] : champ.season;
                const seasonName = season?.name || "Unknown Season";

                return (
                    <Card key={champ.season_id} className="border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-background overflow-hidden hover:border-yellow-500/60 transition-colors">
                        <CardContent className="flex flex-col items-center justify-center p-8">
                            <h2 className="text-sm font-bold tracking-widest text-center text-muted-foreground uppercase mb-4">
                                {seasonName} Champion
                            </h2>
                            
                            {/* CUSTOM DYNAMIC TROPHY IMAGE */}
                            <div className="text-5xl mb-4 drop-shadow-xl">
                                🏆
                            </div>
                            
                            <div className="text-5xl mb-3 drop-shadow-md">
                                {team?.emoji}
                            </div>
                            
                            <h1 
                                className="text-2xl font-black uppercase text-center tracking-tighter"
                                style={{ 
                                    color: team?.primary_color || '#ffffff', 
                                    textShadow: `1px 1px 0px ${team?.secondary_color || '#555555'}, 2px 2px 5px rgba(0,0,0,0.5)` 
                                }}
                            >
                                {team?.name}
                            </h1>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
