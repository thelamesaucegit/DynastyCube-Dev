// src/app/components/PlayoffBracket.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getPlayoffData } from "@/app/actions/playoffActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Trophy, CalendarRange } from "lucide-react";

export interface PlayoffTeam {
    id: string;
    name: string;
    emoji: string;
    primary_color?: string | null;
    secondary_color?: string | null;
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
    isDummy?: boolean; // Added for TBD rounds
}

interface PlayoffBracketProps {
    seasonId: string;
    seasonName: string;
}

export function PlayoffBracket({ seasonId, seasonName }: PlayoffBracketProps) {
    const [matchups, setMatchups] = useState<PlayoffMatchup[]>([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [lines, setLines] = useState<React.ReactNode[]>([]);

    const loadBracket = useCallback(async () => {
        if (!seasonId) return;
        const result = await getPlayoffData(seasonId);
        if (result.success) setMatchups(result.matchups as unknown as PlayoffMatchup[]);
        setLoading(false);
    }, [seasonId]);

    useEffect(() => {
        loadBracket();
        const interval = setInterval(loadBracket, 600000);
        return () => clearInterval(interval);
    }, [loadBracket]);

    // Group matchups and PAD FUTURE ROUNDS
    const rounds = React.useMemo(() => {
        if (matchups.length === 0) return [];
        
        const roundsMap = matchups.reduce<Record<number, PlayoffMatchup[]>>((acc, match) => {
            if (!acc[match.week_number]) acc[match.week_number] = [];
            acc[match.week_number].push(match);
            return acc;
        }, {});
        
        const completeRounds = Object.values(roundsMap);
        
        // If we only have Round 1 (e.g. 4 matches), we need to draw Round 2 (2 matches) and Round 3 (1 match)
        if (completeRounds.length > 0) {
            let currentMatchesInRound = completeRounds[completeRounds.length - 1].length;
            let currentWeekNumber = completeRounds[completeRounds.length - 1][0].week_number;
            
            while (currentMatchesInRound > 1) {
                currentMatchesInRound = Math.ceil(currentMatchesInRound / 2);
                currentWeekNumber++;
                
                const dummyMatches = Array.from({ length: currentMatchesInRound }).map((_, i) => ({
                    id: `dummy-${currentWeekNumber}-${i}`,
                    week_number: currentWeekNumber,
                    is_outcome_final: false,
                    team1: [] as PlayoffTeam[],
                    team2: [] as PlayoffTeam[],
                    schedule: [],
                    isDummy: true
                } as PlayoffMatchup));
                
                completeRounds.push(dummyMatches);
            }
        }
        return completeRounds;
    }, [matchups]);

    useEffect(() => {
        if (loading || rounds.length === 0 || !containerRef.current) return;

        const drawLines = () => {
            const newLines: React.ReactNode[] = [];
            const roundColumns = containerRef.current?.querySelectorAll('.bracket-round');
            if (!roundColumns || roundColumns.length < 2) return;

            for (let i = 0; i < roundColumns.length - 1; i++) {
                const currentRound = roundColumns[i];
                const nextRound = roundColumns[i + 1];

                const currentCards = Array.from(currentRound.querySelectorAll('.bracket-card')) as HTMLElement[];
                const nextCards = Array.from(nextRound.querySelectorAll('.bracket-card')) as HTMLElement[];

                const containerRect = containerRef.current!.getBoundingClientRect();

                currentCards.forEach((card, cardIndex) => {
                    const nextCardIndex = Math.floor(cardIndex / 2);
                    const targetCard = nextCards[nextCardIndex];

                    if (targetCard) {
                        const startRect = card.getBoundingClientRect();
                        const endRect = targetCard.getBoundingClientRect();

                        const startX = startRect.right - containerRect.left;
                        const startY = startRect.top + (startRect.height / 2) - containerRect.top;

                        const endX = endRect.left - containerRect.left;
                        const endY = endRect.top + (endRect.height / 2) - containerRect.top;

                        const midX = startX + (endX - startX) / 2;

                        newLines.push(
                            <path
                                key={`line-${i}-${cardIndex}`}
                                d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-border/60"
                                strokeLinejoin="round"
                            />
                        );
                    }
                });
            }
            setLines(newLines);
        };

        setTimeout(drawLines, 100); 
        window.addEventListener('resize', drawLines);
        return () => window.removeEventListener('resize', drawLines);
    }, [rounds, loading]);


    if (loading || matchups.length === 0) return null;

   const finalMatchup = matchups[matchups.length - 1];
    let champion: PlayoffTeam | null = null;

    if (finalMatchup?.is_outcome_final) {
        // 1. Verify this is ACTUALLY the championship round (only 1 match in this week)
        const isChampionshipRound = matchups.filter(m => m.week_number === finalMatchup.week_number).length === 1;
        
        // 2. Safely check schedule array
        const schedule = finalMatchup.schedule || [];
        
        // 3. Ensure we have games, they are all marked completed, AND the broadcast timer has fully elapsed
        const streamCaughtUp = schedule.length > 0 && schedule.every((g: PlayoffGame) => {
            if (g.status !== 'completed') return false;
            
            const broadcastEndTime = new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000);
            return Date.now() > broadcastEndTime;
        });

        // Only crown the winner if ALL conditions are met perfectly
        if (isChampionshipRound && streamCaughtUp) {
            const team1 = Array.isArray(finalMatchup.team1) ? finalMatchup.team1[0] : finalMatchup.team1;
            const team2 = Array.isArray(finalMatchup.team2) ? finalMatchup.team2[0] : finalMatchup.team2;
            champion = finalMatchup.winner_team_id === team1?.id ? team1 : team2;
        }
    }

    return (
        <section className="space-y-6 animate-in fade-in duration-700">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes diagonal-shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
                .animate-shimmer { background-size: 200% auto; animation: diagonal-shimmer 8s linear infinite; }
            `}} />

            {champion && (
                <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-background to-yellow-500/10 overflow-hidden animate-shimmer relative">
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] pointer-events-none" />
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4 relative z-10">
                        <h2 className="text-xl md:text-3xl font-black tracking-widest text-center text-muted-foreground uppercase mb-6 drop-shadow-sm">
                            {seasonName} Champion
                        </h2>
                        <div className="text-7xl md:text-9xl mb-6 drop-shadow-2xl">🏆</div>
                        <div className="text-7xl md:text-8xl mb-4 drop-shadow-xl">{champion.emoji}</div>
                        <h1 
                            className="text-4xl md:text-6xl font-black uppercase text-center tracking-tighter mt-4"
                            style={{ color: champion.primary_color || '#ffffff', textShadow: `2px 2px 0px ${champion.secondary_color || '#555555'}, 4px 4px 10px rgba(0,0,0,0.5)` }}
                        >
                            {champion.name}
                        </h1>
                    </CardContent>
                </Card>
            )}

            <Card className="border-primary/20 bg-muted/10 overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10">
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
                    
                    <div className="relative w-full overflow-x-auto pb-4" ref={containerRef}>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: '100%' }}>
                            {lines}
                        </svg>

                        <div className="flex flex-row justify-center items-stretch gap-12 md:gap-24 relative z-10 mx-auto px-4 min-w-max">
                            {rounds.map((round: PlayoffMatchup[], roundIdx: number) => {
                                const isFinalRound = roundIdx === rounds.length - 1;
                                const roundTitle = isFinalRound ? "Championship" : `Round ${roundIdx + 1}`;

                                return (
                                    <div key={roundIdx} className="bracket-round flex flex-col justify-center gap-8 min-w-[160px]">
                                        <h3 className="text-center font-bold text-xs uppercase tracking-widest text-muted-foreground mb-[-1rem]">
                                            {roundTitle}
                                        </h3>
                                        
                                        {round.map((match: PlayoffMatchup) => {
                                            if (match.isDummy) {
                                                return (
                                                    <div key={match.id} className="bracket-card flex flex-col bg-background/50 border border-dashed border-border/50 rounded-lg p-4 h-[120px] justify-center opacity-50">
                                                        <div className="flex items-center justify-between gap-4 mb-2"><span className="text-xl font-bold text-muted-foreground">TBD</span></div>
                                                        <div className="h-px bg-border/30 w-full my-3" />
                                                        <div className="flex items-center justify-between gap-4 mt-2"><span className="text-xl font-bold text-muted-foreground">TBD</span></div>
                                                    </div>
                                                );
                                            }

                                            const team1 = Array.isArray(match.team1) ? match.team1[0] : match.team1;
                                            const team2 = Array.isArray(match.team2) ? match.team2[0] : match.team2;
                                            
                                            let t1SafeWins = 0; let t2SafeWins = 0;
                                            match.schedule?.forEach((game: PlayoffGame) => {
                                                if (game.status === 'completed') {
                                                    const broadcastEndTime = new Date(game.match_date).getTime() + (30 * 60000) + ((game.total_steps || 300) * 2000);
                                                    if (Date.now() > broadcastEndTime) {
                                                        if (game.winner_team_id === team1?.id) t1SafeWins++;
                                                        if (game.winner_team_id === team2?.id) t2SafeWins++;
                                                    }
                                                }
                                            });

                                            const isFinal = match.is_outcome_final && match.schedule?.every((g: PlayoffGame) => Date.now() > (new Date(g.match_date).getTime() + (30 * 60000) + ((g.total_steps || 300) * 2000)));
                                            const t1Eliminated = isFinal && match.winner_team_id !== team1?.id;
                                            const t2Eliminated = isFinal && match.winner_team_id !== team2?.id;
                                            const t1Winner = isFinal && !t1Eliminated;
                                            const t2Winner = isFinal && !t2Eliminated;

                                            return (
                                                <div key={match.id} className={`bracket-card flex flex-col bg-background border rounded-lg p-4 shadow-sm relative h-[120px] justify-center transition-all ${isFinal ? 'border-border' : 'border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]'}`}>
                                                    <div className={`flex items-center justify-between gap-4 transition-all duration-500 ${t1Eliminated ? 'opacity-30 grayscale' : ''}`}>
                                                        <span className={`text-3xl transition-all ${t1Winner ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] scale-110' : ''}`} title={team1?.name}>{team1?.emoji || '❔'}</span>
                                                        <div className="flex gap-0.5 text-xs">{Array.from({ length: t1SafeWins }).map((_, i) => <span key={i}>👑</span>)}</div>
                                                    </div>
                                                    <div className="h-px bg-border/50 w-full my-3" />
                                                    <div className={`flex items-center justify-between gap-4 transition-all duration-500 ${t2Eliminated ? 'opacity-30 grayscale' : ''}`}>
                                                        <span className={`text-3xl transition-all ${t2Winner ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] scale-110' : ''}`} title={team2?.name}>{team2?.emoji || '❔'}</span>
                                                        <div className="flex gap-0.5 text-xs">{Array.from({ length: t2SafeWins }).map((_, i) => <span key={i}>👑</span>)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
