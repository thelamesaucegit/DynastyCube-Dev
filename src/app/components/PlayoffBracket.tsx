// src/app/components/PlayoffBracket.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getPlayoffData } from "@/app/actions/playoffActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Trophy, CalendarRange } from "lucide-react";

// --- STRICT TYPES FOR SUPABASE DATA ---
export interface PlayoffTeam {
    id: string;
    name: string;
    emoji: string;
    primary_color?: string;
    secondary_color?: string;
}

export interface PlayoffGame {
    id: string;
    status: string;
    winner_team_id?: string;
    match_date: string;
    total_steps?: number;
}

export interface PlayoffMatchup {
    id: string;
    week_number: number;
    is_outcome_final: boolean;
    winner_team_id?: string;
    team1: PlayoffTeam | PlayoffTeam[];
    team2: PlayoffTeam | PlayoffTeam[];
    schedule: PlayoffGame[];
}
// ---------------------------------------

interface PlayoffBracketProps {
    seasonId: string;
    seasonName: string;
}

export function PlayoffBracket({ seasonId, seasonName }: PlayoffBracketProps) {
    const [matchups, setMatchups] = useState<PlayoffMatchup[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBracket = useCallback(async () => {
        if (!seasonId) return;
        const result = await getPlayoffData(seasonId);
        if (result.success) {
            // Safely cast the returned data to our strict interface
            setMatchups(result.matchups as unknown as PlayoffMatchup[]);
        }
        setLoading(false);
    }, [seasonId]);

    useEffect(() => {
        loadBracket();
        // Update every 10 minutes
        const interval = setInterval(loadBracket, 600000);
        return () => clearInterval(interval);
    }, [loadBracket]);

    if (loading || matchups.length === 0) return null;

    // Group matchups by week_number (Rounds) using strict generic Record type
    const roundsMap = matchups.reduce<Record<number, PlayoffMatchup[]>>((acc, match) => {
        if (!acc[match.week_number]) acc[match.week_number] = [];
        acc[match.week_number].push(match);
        return acc;
    }, {});
    const rounds = Object.values(roundsMap);

    // --- SPOILER-FREE CHAMPION DETECTION ---
    const finalMatchup = matchups[matchups.length - 1];
    let champion: PlayoffTeam | null = null;

    if (finalMatchup?.is_outcome_final) {
        // Ensure all games in the final matchup have finished broadcasting
        const streamCaughtUp = finalMatchup.schedule?.every((g: PlayoffGame) => 
            Date.now() > (new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000))
        );
        if (streamCaughtUp) {
            const team1 = Array.isArray(finalMatchup.team1) ? finalMatchup.team1[0] : finalMatchup.team1;
            const team2 = Array.isArray(finalMatchup.team2) ? finalMatchup.team2[0] : finalMatchup.team2;
            champion = finalMatchup.winner_team_id === team1?.id ? team1 : team2;
        }
    }

    return (
        <section className="space-y-6 animate-in fade-in duration-700">
                        {/* --- CHAMPION REVEAL (Rendered ABOVE the bracket if a champion exists) --- */}
            {champion && (
                <Card className="border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-background overflow-hidden">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4">
                        <h2 className="text-xl md:text-3xl font-black tracking-widest text-center text-muted-foreground uppercase mb-6">
                            {seasonName} Champion
                        </h2>
                        
                        {/* CUSTOM DYNAMIC TROPHY IMAGE: 
                            To use season-specific PNGs, name your files like "season-1-trophy.png" in your public/images/trophies folder.
                            Comment out the emoji div below and uncomment this img tag!
                            
                            <img 
                                src={`/images/trophies/${seasonName.toLowerCase().replace(/\s+/g, '-')}-trophy.png`} 
                                alt={`${seasonName} Trophy`} 
                                className="w-24 h-24 md:w-32 md:h-32 mb-6 object-contain drop-shadow-xl" 
                                onError={(e) => { 
                                    // If the specific season PNG isn't found, fallback to a default image
                                    e.currentTarget.src = '/images/trophies/default-trophy.png'; 
                                }}
                            /> 
                        */}
                        <div className="text-7xl md:text-9xl mb-6 drop-shadow-2xl">
                            🏆
                        </div>
                        
                        <div className="text-7xl md:text-8xl mb-4 drop-shadow-xl">
                            {champion.emoji}
                        </div>
                        
                        <h1 
                            className="text-4xl md:text-6xl font-black uppercase text-center tracking-tighter mt-4"
                            style={{ 
                                color: champion.primary_color || '#ffffff', 
                                textShadow: `2px 2px 0px ${champion.secondary_color || '#555555'}, 4px 4px 10px rgba(0,0,0,0.5)` 
                            }}
                        >
                            {champion.name}
                        </h1>
                    </CardContent>
                </Card>
            )}


            {/* --- THE PLAYOFF BRACKET --- */}
            <Card className="border-primary/20 bg-muted/10">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            <h2 className="text-xl font-bold tracking-tight uppercase">Playoff Bracket</h2>
                        </div>
                        <Button variant="outline" size="sm" asChild className="shrink-0">
                            <Link href="/schedule">
                                <CalendarRange className="mr-2 h-4 w-4" />
                                View Full Schedule
                            </Link>
                        </Button>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-center items-center md:items-stretch gap-8 md:gap-12 overflow-x-auto pb-4">
                        {rounds.map((round: PlayoffMatchup[], roundIdx: number) => (
                            <div key={roundIdx} className="flex flex-col justify-center gap-6 min-w-[140px]">
                                {round.map((match: PlayoffMatchup) => {
                                    const team1 = Array.isArray(match.team1) ? match.team1[0] : match.team1;
                                    const team2 = Array.isArray(match.team2) ? match.team2[0] : match.team2;
                                    
                                    // Calculate Safe Wins to protect spoilers
                                    let t1SafeWins = 0;
                                    let t2SafeWins = 0;
                                    
                                    match.schedule?.forEach((game: PlayoffGame) => {
                                        if (game.status === 'completed') {
                                            const broadcastEndTime = new Date(game.match_date).getTime() + (30 * 60000) + ((game.total_steps || 300) * 2000);
                                            if (Date.now() > broadcastEndTime) {
                                                if (game.winner_team_id === team1?.id) t1SafeWins++;
                                                if (game.winner_team_id === team2?.id) t2SafeWins++;
                                            }
                                        }
                                    });

                                    // Determine Elimination (Only if outcome is final AND stream has caught up)
                                    const isFinal = match.is_outcome_final && match.schedule?.every((g: PlayoffGame) => Date.now() > (new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000)));
                                    const t1Eliminated = isFinal && match.winner_team_id !== team1?.id;
                                    const t2Eliminated = isFinal && match.winner_team_id !== team2?.id;

                                    return (
                                        <div key={match.id} className="flex flex-col bg-background border border-border/50 rounded-lg p-3 shadow-sm">
                                            {/* Team 1 */}
                                            <div className={`flex items-center justify-between gap-4 mb-2 ${t1Eliminated ? 'opacity-40 grayscale' : ''}`}>
                                                <span className="text-3xl" title={team1?.name}>{team1?.emoji || '❔'}</span>
                                                <div className="flex gap-0.5 text-xs">
                                                    {Array.from({ length: t1SafeWins }).map((_, i) => <span key={i}>👑</span>)}
                                                </div>
                                            </div>
                                            <div className="h-px bg-border/50 w-full my-1" />
                                            {/* Team 2 */}
                                            <div className={`flex items-center justify-between gap-4 mt-2 ${t2Eliminated ? 'opacity-40 grayscale' : ''}`}>
                                                <span className="text-3xl" title={team2?.name}>{team2?.emoji || '❔'}</span>
                                                <div className="flex gap-0.5 text-xs">
                                                    {Array.from({ length: t2SafeWins }).map((_, i) => <span key={i}>👑</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
