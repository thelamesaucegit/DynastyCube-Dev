// src/app/components/team/TrophyCase.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from "@/app/components/ui/card";
import { Loader2 } from "lucide-react";

interface TrophyCaseProps {
    teamId: string;
}

export function TrophyCase({ teamId }: TrophyCaseProps) {
    const [championships, setChampionships] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchChampionships() {
            const supabase = createClient();
            
            // 1. Fetch the raw matchups without the complex joins to bypass FK confusion
            const { data: finalMatches, error: matchesError } = await supabase
                .from('weekly_matchups')
                .select('season_id, week_number')
                .eq('winner_team_id', teamId)
                .eq('is_playoff', true)
                .eq('is_outcome_final', true);

            if (matchesError || !finalMatches || finalMatches.length === 0) {
                setLoading(false);
                return;
            }

            // 2. Filter to only the highest week number per season (The actual Championship)
            const seasonWinners = new Map();
            finalMatches.forEach((match: any) => {
                const currentMaxWeek = seasonWinners.get(match.season_id)?.week_number || 0;
                if (match.week_number > currentMaxWeek) {
                    seasonWinners.set(match.season_id, match);
                }
            });

            // 3. Fetch the Season and Team details safely
            const validChampionships = Array.from(seasonWinners.values());
            const enrichedChampionships = [];

            for (const champ of validChampionships) {
                const [{ data: seasonData }, { data: teamData }] = await Promise.all([
                    supabase.from('seasons').select('name').eq('id', champ.season_id).single(),
                    supabase.from('teams').select('name, emoji, primary_color, secondary_color').eq('id', teamId).single()
                ]);

                if (seasonData && teamData) {
                    enrichedChampionships.push({
                        ...champ,
                        season: seasonData,
                        team: teamData
                    });
                }
            }

            setChampionships(enrichedChampionships);
            setLoading(false);
        }

        fetchChampionships();
    }, [teamId]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
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
            {championships.map((champ) => (
                <Card key={champ.season_id} className="border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-background overflow-hidden hover:border-yellow-500/60 transition-colors">
                    <CardContent className="flex flex-col items-center justify-center p-8">
                        <h2 className="text-sm font-bold tracking-widest text-center text-muted-foreground uppercase mb-4">
                            {champ.season.name} Champion
                        </h2>
                        <div className="text-5xl mb-4 drop-shadow-xl">🏆</div>
                        <div className="text-5xl mb-3 drop-shadow-md">{champ.team.emoji}</div>
                        <h1 
                            className="text-2xl font-black uppercase text-center tracking-tighter"
                            style={{ 
                                color: champ.team.primary_color || '#ffffff', 
                                textShadow: `1px 1px 0px ${champ.team.secondary_color || '#555555'}, 2px 2px 5px rgba(0,0,0,0.5)` 
                            }}
                        >
                            {champ.team.name}
                        </h1>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
