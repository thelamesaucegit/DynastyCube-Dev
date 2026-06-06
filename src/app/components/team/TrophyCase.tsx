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

interface DbSeasonData {
    season_name: string;
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
            console.log(`[TrophyCase DEBUG] 🚀 Starting fetch for Team ID: ${teamId}`);
            const supabase = createClient();
            
            // 1. Get Championship Weeks (FIXED AMBIGUOUS JOIN)
            const { data: champWeeks, error: weeksErr } = await supabase
                .from('schedule_weeks')
                .select('season_id, week_number, end_date, seasons:seasons!schedule_weeks_season_id_fkey(season_name)')
                .eq('is_championship_week', true);

            console.log(`[TrophyCase DEBUG] 1. Championship Weeks Found:`, champWeeks?.length);
            if (weeksErr) console.error(`[TrophyCase DEBUG] Weeks Error:`, weeksErr);

            // 2. Get Team Wins
            const { data: teamWins, error: winsErr } = await supabase
                .from('weekly_matchups')
                .select('id, season_id, week_number')
                .eq('winner_team_id', teamId)
                .eq('is_outcome_final', true);

            console.log(`[TrophyCase DEBUG] 2. Finalized Wins for this Team:`, teamWins?.length);
            if (winsErr) console.error(`[TrophyCase DEBUG] Wins Error:`, winsErr);

            // 3. Get Team Data
            const { data: teamData } = await supabase
                .from('teams')
                .select('name, emoji, primary_color, secondary_color')
                .eq('id', teamId)
                .single();

            if (weeksErr || winsErr || !champWeeks || !teamWins || !teamData) {
                console.log(`[TrophyCase DEBUG] ❌ Aborting early due to missing base data.`);
                setLoading(false);
                return;
            }

            // 4. Intersect
            const championshipMatchups = teamWins.filter(win => 
                champWeeks.some(cw => cw.season_id === win.season_id && cw.week_number === win.week_number)
            );
            console.log(`[TrophyCase DEBUG] 3. Intersected Matchups (Wins that happened in a Champ Week):`, championshipMatchups.length);

            if (championshipMatchups.length === 0) {
                setLoading(false);
                return;
            }

            // 5. Schedules (Stream Delay check)
            const { data: schedules } = await supabase
                .from('schedule')
                .select('weekly_matchup_id, match_date, total_steps')
                .in('weekly_matchup_id', championshipMatchups.map(m => m.id));

            console.log(`[TrophyCase DEBUG] 4. Schedule rows found for these matchups:`, schedules?.length);

            const validTrophies: EnrichedChampionship[] = [];
            const now = Date.now();

            for (const match of championshipMatchups) {
                const championshipWeek = champWeeks.find(cw => cw.season_id === match.season_id && cw.week_number === match.week_number);
                if (!championshipWeek) continue;

                const games = schedules?.filter(s => s.weekly_matchup_id === match.id) || [];
                console.log(`[TrophyCase DEBUG] Matchup ${match.id} has ${games.length} games. Evaluating stream delay...`);

                const streamCaughtUp = games.length > 0 && games.every(g => {
                    const broadcastEndTime = new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000);
                    const isDone = now > broadcastEndTime;
                    console.log(`   -> Game on ${g.match_date}: Ends at ${new Date(broadcastEndTime).toLocaleTimeString()}. Is Done? ${isDone}`);
                    return isDone;
                });

                if (streamCaughtUp || games.length === 0) {
                    console.log(`[TrophyCase DEBUG] ✅ Awarding Trophy for Matchup ${match.id}!`);
                    
                    const seasonObj = (Array.isArray(championshipWeek.seasons) 
                        ? championshipWeek.seasons[0] 
                        : championshipWeek.seasons) as unknown as DbSeasonData | undefined;

                    validTrophies.push({
                        season_id: match.season_id,
                        season_name: seasonObj?.season_name || "Unknown Season",
                        team: teamData as TrophyTeam
                    });
                } else {
                    console.log(`[TrophyCase DEBUG] ⏳ Holding Trophy for Matchup ${match.id} - Stream still pending.`);
                }
            }

            console.log(`[TrophyCase DEBUG] Final Trophies Awarded:`, validTrophies.length);
            setChampionships(validTrophies);
            setLoading(false);
        }

        fetchChampionships();
    }, [teamId]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;

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
