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
            
            // 1. Fetch all matchups where this team is the finalized winner
            const { data: teamWins, error: winsError } = await supabase
                .from('weekly_matchups')
                .select('id, season_id, week_number')
                .eq('winner_team_id', teamId)
                .eq('is_outcome_final', true);

            if (winsError || !teamWins || teamWins.length === 0) {
                setLoading(false);
                return;
            }

            // 2. Fetch all Schedule Weeks designated explicitly as Championships
            const { data: champWeeks, error: champError } = await supabase
                .from('schedule_weeks')
                .select('season_id, week_number, seasons(season_name)')
                .eq('is_championship_week', true);

            if (champError || !champWeeks || champWeeks.length === 0) {
                setLoading(false);
                return;
            }

            // 3. Intersect the data: Find the wins that occurred during a Championship Week
            const championshipMatchups = teamWins.filter(win => 
                champWeeks.some(cw => cw.season_id === win.season_id && cw.week_number === win.week_number)
            );

            if (championshipMatchups.length === 0) {
                setLoading(false);
                return;
            }

            // 4. Fetch the schedule games for these specific matchups to verify stream delays
            const { data: schedules } = await supabase
                .from('schedule')
                .select('weekly_matchup_id, match_date, total_steps')
                .in('weekly_matchup_id', championshipMatchups.map(m => m.id));

            // 5. Fetch Team details for styling
            const { data: teamData } = await supabase
                .from('teams')
                .select('name, emoji, primary_color, secondary_color')
                .eq('id', teamId)
                .single();

            // 6. Build the final array, applying the spoiler-free stream delay check
            const enrichedChampionships: EnrichedChampionship[] = [];

            for (const match of championshipMatchups) {
                const games = schedules?.filter(s => s.weekly_matchup_id === match.id) || [];
                
                // Ensure ALL games in the championship match have finished broadcasting
                const streamCaughtUp = games.length > 0 && games.every(g => {
                    const broadcastEndTime = new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000);
                    return Date.now() > broadcastEndTime;
                });

                // If there are no games found (legacy data) or the stream has finished, award the trophy!
                if (streamCaughtUp || games.length === 0) {
                    const cw = champWeeks.find(cw => cw.season_id === match.season_id && cw.week_number === match.week_number);
                    const seasonData = Array.isArray(cw?.seasons) ? cw?.seasons[0] : cw?.seasons;
                    
                    enrichedChampionships.push({
                        season_id: match.season_id,
                        season_name: seasonData?.season_name || "Unknown Season",
                        team: teamData as TrophyTeam
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
                            {champ.season_name} Champion
                        </h2>
                        
                        {/* CUSTOM DYNAMIC TROPHY IMAGE:
                            <img src={`/images/trophies/${champ.season_name.toLowerCase().replace(/\s+/g, '-')}-trophy.png`} alt={`${champ.season_name} Trophy`} className="w-24 h-24 mb-6 object-contain drop-shadow-xl" onError={(e) => e.currentTarget.src = '/images/trophies/default-trophy.png'} />
                        */}
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
