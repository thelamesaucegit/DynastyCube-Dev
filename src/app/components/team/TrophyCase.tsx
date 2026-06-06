// src/app/components/team/TrophyCase.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from "@/app/components/ui/card";
import { Loader2 } from "lucide-react";

// --- STRICT INTERFACES ---
interface TrophyTeam {
    name: string;
    emoji: string;
    primary_color?: string | null;
    secondary_color?: string | null;
}

interface EnrichedChampionship {
    season_id: string;
    season_name: string;
    team: TrophyTeam;
}
// -------------------------

interface TrophyCaseProps {
    teamId: string;
}

export function TrophyCase({ teamId }: TrophyCaseProps) {
    const [championships, setChampionships] = useState<EnrichedChampionship[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchChampionships() {
            const supabase = createClient();
            
            // 1. Get all Championship Weeks from the database
            const { data: champWeeks, error: weeksErr } = await supabase
                .from('schedule_weeks')
                .select('season_id, week_number, end_date, seasons(season_name)')
                .eq('is_championship_week', true);

            // 2. Get all matchups where THIS team won
            const { data: teamWins, error: winsErr } = await supabase
                .from('weekly_matchups')
                .select('season_id, week_number')
                .eq('winner_team_id', teamId)
                .eq('is_outcome_final', true);

            // 3. Get the team's visual details
            const { data: teamData } = await supabase
                .from('teams')
                .select('name, emoji, primary_color, secondary_color')
                .eq('id', teamId)
                .single();

            if (weeksErr || winsErr || !champWeeks || !teamWins || !teamData) {
                setLoading(false);
                return;
            }

            const validTrophies: EnrichedChampionship[] = [];
            const now = Date.now();

            // 4. Intersect the two lists!
            for (const win of teamWins) {
                const championshipWeek = champWeeks.find(cw => 
                    cw.season_id === win.season_id && cw.week_number === win.week_number
                );

                if (championshipWeek) {
                    // Anti-Spoiler Check: We only award the trophy if the week's end_date 
                    // (which marks the end of the final broadcast) has safely passed.
                    const isStreamDone = now > new Date(championshipWeek.end_date).getTime();
                    
                    if (isStreamDone) {
                        const seasonObj = Array.isArray(championshipWeek.seasons) 
                            ? championshipWeek.seasons[0] 
                            : championshipWeek.seasons;

                        validTrophies.push({
                            season_id: win.season_id,
                            season_name: (seasonObj as any)?.season_name || "Unknown Season",
                            team: teamData as TrophyTeam
                        });
                    }
                }
            }

            setChampionships(validTrophies);
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
                            {champ.season_name} Champion
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
