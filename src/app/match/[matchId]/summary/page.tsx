import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { PlayCircle, Trophy, Swords, Home } from 'lucide-react';

interface SummaryPageProps {
    params: Promise<{ matchId: string }>;
}

export default async function MatchSummaryPage({ params }: SummaryPageProps) {
    const { matchId } = await params;
    const supabase = await createServerClient();

    // Fetch the match details, the weekly matchup context, and both teams
    const { data: match, error } = await supabase
        .from('schedule')
        .select(`
            id, status, winner_team_id, sim_match_id, match_date,
            team1:teams!team1_id(id, name, emoji),
            team2:teams!team2_id(id, name, emoji),
            weekly_matchup:weekly_matchups(id, sim_team1_wins, sim_team2_wins, sim_completed_games, is_playoff, is_outcome_final)
        `)
        .eq('sim_match_id', matchId)
        .single();

    if (error || !match || match.status !== 'completed') {
        return notFound();
    }

    const team1 = Array.isArray(match.team1) ? match.team1[0] : match.team1;
    const team2 = Array.isArray(match.team2) ? match.team2[0] : match.team2;
    const matchup = Array.isArray(match.weekly_matchup) ? match.weekly_matchup[0] : match.weekly_matchup;

    const t1Wins = matchup?.sim_team1_wins || 0;
    const t2Wins = matchup?.sim_team2_wins || 0;
    const isT1Winner = match.winner_team_id === team1?.id;
    const isT2Winner = match.winner_team_id === team2?.id;
    const isDraw = !isT1Winner && !isT2Winner;

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-8 animate-in fade-in zoom-in-95 duration-700">
                
                <div className="text-center space-y-2">
                    <Badge variant="outline" className="px-3 py-1 mb-4 text-sm font-medium tracking-widest uppercase bg-muted/50 border-primary/20 text-primary">
                        Match Concluded
                    </Badge>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Final Results</h1>
                    <p className="text-muted-foreground text-lg">
                        {new Date(match.match_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <Card className={`border-2 overflow-hidden shadow-2xl ${isDraw ? 'border-border' : 'border-primary/50'}`}>
                    <div className="bg-muted/30 p-8">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                            
                            {/* Team 1 */}
                            <div className={`flex flex-col items-center text-center transition-all ${isT1Winner ? 'scale-110' : 'opacity-80'}`}>
                                <div className="relative mb-4">
                                    <div className="text-7xl drop-shadow-xl z-10 relative">{team1?.emoji}</div>
                                    {isT1Winner && (
                                        <div className="absolute -top-6 -right-6 text-3xl animate-bounce">👑</div>
                                    )}
                                </div>
                                <h2 className={`text-2xl font-bold max-w-[200px] truncate ${isT1Winner ? 'text-primary' : ''}`}>
                                    {team1?.name}
                                </h2>
                                {isT1Winner && <Badge className="mt-2 bg-green-500 hover:bg-green-600">Winner</Badge>}
                            </div>

                            {/* VS & Score */}
                            <div className="flex flex-col items-center justify-center px-4">
                                <div className="text-muted-foreground font-black text-3xl italic mb-6">VS</div>
                                <div className="flex items-center gap-6 bg-background px-6 py-4 rounded-2xl shadow-inner border">
                                    <span className={`text-4xl font-mono font-black ${isT1Winner ? 'text-primary' : ''}`}>{t1Wins}</span>
                                    <span className="text-xl text-muted-foreground">-</span>
                                    <span className={`text-4xl font-mono font-black ${isT2Winner ? 'text-primary' : ''}`}>{t2Wins}</span>
                                </div>
                                {matchup && (
                                    <p className="text-sm text-muted-foreground mt-4 font-medium uppercase tracking-wider">
                                        Game {matchup.sim_completed_games} {matchup.is_playoff ? 'of Playoffs' : 'of Series'}
                                    </p>
                                )}
                            </div>

                            {/* Team 2 */}
                            <div className={`flex flex-col items-center text-center transition-all ${isT2Winner ? 'scale-110' : 'opacity-80'}`}>
                                <div className="relative mb-4">
                                    <div className="text-7xl drop-shadow-xl z-10 relative">{team2?.emoji}</div>
                                    {isT2Winner && (
                                        <div className="absolute -top-6 -left-6 text-3xl animate-bounce">👑</div>
                                    )}
                                </div>
                                <h2 className={`text-2xl font-bold max-w-[200px] truncate ${isT2Winner ? 'text-primary' : ''}`}>
                                    {team2?.name}
                                </h2>
                                {isT2Winner && <Badge className="mt-2 bg-green-500 hover:bg-green-600">Winner</Badge>}
                            </div>

                        </div>
                    </div>
                    
                    {matchup?.is_outcome_final && (
                        <div className="bg-primary/10 border-t border-primary/20 p-4 text-center">
                            <p className="text-primary font-bold tracking-wide uppercase text-sm">
                                🏆 Series Finalized!
                            </p>
                        </div>
                    )}
                </Card>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Button asChild size="lg" className="w-full sm:w-auto px-8 h-14 text-lg">
                        <Link href={`/argentum-viewer/${matchId}`}>
                            <PlayCircle className="mr-2 h-5 w-5" />
                            Watch Full Replay
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto px-8 h-14 text-lg">
                        <Link href="/schedule">
                            <Swords className="mr-2 h-5 w-5" />
                            View Schedule
                        </Link>
                    </Button>
                </div>

            </div>
        </div>
    );
}
