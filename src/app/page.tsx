// src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Users, Trophy, Calendar, ArrowRight, Info, PlayCircle, Radio } from "lucide-react";
import CountdownTimer from "@/app/components/CountdownTimer";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import {
  getRecentDraftPicks,
  getCurrentSeason,
  getAdminNews,
  getRecentGames,
  getActiveCountdownTimer,
  getActiveDraftSession,
  type RecentDraftPick,
  type CurrentSeason,
  type AdminNews,
  type RecentGame,
  type CountdownTimer as CountdownTimerType,
} from "@/app/actions/homeActions";
import { getLatestStreamMatch, type StreamMatch } from "@/app/actions/liveStreamActions";

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function HomePage() {
  const [season, setSeason] = useState<CurrentSeason | null>(null);
  const [adminNews, setAdminNews] = useState<AdminNews[]>([]);
  const [recentPicks, setRecentPicks] = useState<RecentDraftPick[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [countdownTimer, setCountdownTimer] = useState<CountdownTimerType | null>(null);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [liveMatch, setLiveMatch] = useState<StreamMatch | null>(null);
  const [loading, setLoading] = useState(true);
    const [liveLife, setLiveLife] = useState<{t1: number, t2: number} | null>(null);


  // State for the random background panning
  const [bgPosition, setBgPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    loadData();

    // Setup the random background panning interval
    const moveBackground = () => {
      setBgPosition({
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
      });
    };
    const initialTimeout = setTimeout(moveBackground, 100);
    const panInterval = setInterval(moveBackground, 25000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(panInterval);
    };
  }, []);

   // Synchronize Live Life Totals if the broadcast is active
  useEffect(() => {
    if (!liveMatch || !liveMatch.life_timeline || liveMatch.life_timeline.length === 0) return;
    
    // The stream begins exactly 30 minutes after the match date
    const broadcastTime = new Date(new Date(liveMatch.match_date).getTime() + (30 * 60000)).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - broadcastTime;
      
      // If the broadcast has started
      if (diff > 0) {
        // Calculate exact index based on 750ms step duration
        const ticksPassed = Math.floor(diff / 750);
        
        if (ticksPassed < liveMatch.life_timeline.length) {
           const [t1, t2] = liveMatch.life_timeline[ticksPassed];
           setLiveLife({ t1, t2 });
        } else {
           // Lock to the final life totals if the match ended
           const [t1, t2] = liveMatch.life_timeline[liveMatch.life_timeline.length - 1];
           setLiveLife({ t1, t2 });
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [liveMatch]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [seasonResult, newsResult, picksResult, gamesResult, timerResult, draftSessionResult, streamResult] = await Promise.all([
        getCurrentSeason(),
        getAdminNews(3),
        getRecentDraftPicks(5),
        getRecentGames(5),
        getActiveCountdownTimer(),
        getActiveDraftSession(),
        getLatestStreamMatch()
      ]);
      setSeason(seasonResult.season);
      setAdminNews(newsResult.news);
      setRecentPicks(picksResult.picks);
      setRecentGames(gamesResult.games);
      setCountdownTimer(timerResult.timer);
      setDraftSessionId(draftSessionResult.session?.id || null);
      setLiveMatch(streamResult.match);
    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWinnerName = (game: RecentGame) => {
    if (!game.winner_id) return "Draw";
    return game.winner_id === game.team1_id ? game.team1_name : game.team2_name;
  };

  const getWinnerEmoji = (game: RecentGame) => {
    if (!game.winner_id) return "";
    return game.winner_id === game.team1_id ? game.team1_emoji : game.team2_emoji;
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : "#";

  // Calculate stream status
  let streamStatus = 'replay';
  let formattedStreamTime = '';
  if (liveMatch) {
      const broadcastTime = new Date(new Date(liveMatch.match_date).getTime() + (30 * 60000));
      const now = Date.now();
      const diff = broadcastTime.getTime() - now;

      if (diff > 0) {
          streamStatus = 'upcoming';
          formattedStreamTime = broadcastTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } else if (diff > -900000) { // Within 15 minutes of start time
          streamStatus = 'live';
      }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Section with Random Panning Background */}
      <section className="relative overflow-hidden rounded-2xl min-h-[400px] flex flex-col justify-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/logo/logo.jpg')",
            backgroundSize: "150%", 
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${bgPosition.x}% ${bgPosition.y}%`,
            transition: "background-position 25s ease-in-out", 
          }}
        />
        <div className="absolute inset-0 bg-black/60" /> 
        <div className="relative px-8 py-16 md:py-24 z-10">
          <div className="max-w-3xl">
            {season && (
              <div className="mb-4">
                <Badge variant="secondary" className="text-xs bg-black/50 text-white border-white/20 backdrop-blur-md">
                  {season.name} {season.status === "active" ? "Active" : ""}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-4 md:gap-6 mb-4">
              <Image
                src="/images/logo/logo.jpg"
                alt="Dynasty Cube Logo"
                width={56}
                height={56}
                className="size-10 md:size-14 rounded-lg drop-shadow-md flex-shrink-0"
              />
              <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight">
                The Dynasty Cube
              </h1>
            </div>
            <p className="text-lg md:text-xl text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-8 max-w-2xl font-medium leading-relaxed">
              A collaborative, living draft league where teams compete, evolve, and shape the fate of the multiverse.
              Part draft league, part fantasy sports, part cosmic entity.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="shadow-lg" asChild>
                <Link href="/about">
                  <Info className="mr-2 size-4" />
                  About The League
                </Link>
              </Button>
              <Button size="lg" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm" asChild>
                <Link href="/pools">
                  Browse Draft Pool
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-black/40 hover:bg-black/60 text-white border-white/30 backdrop-blur-sm" asChild>
                <Link href="/schedule">View Schedule</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: Live Stream Banner */}
      {liveMatch && (
        <section>
          <Card className={`overflow-hidden relative border ${streamStatus === 'live' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-950/10' : 'border-blue-500/30 bg-blue-950/10'}`}>
            {streamStatus === 'live' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />}
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex-1 text-center md:text-left">
                {streamStatus === 'live' ? (
                   <Badge className="bg-red-500 hover:bg-red-600 mb-3 animate-pulse px-3 py-1"><Radio className="size-3 mr-2 animate-ping" /> LIVE NOW</Badge>
                ) : streamStatus === 'upcoming' ? (
                   <Badge variant="secondary" className="mb-3 px-3 py-1 text-blue-400 border-blue-400/30">UPCOMING BROADCAST</Badge>
                ) : (
                   <Badge variant="outline" className="mb-3 px-3 py-1">LATEST REPLAY</Badge>
                )}
                <h3 className="text-2xl font-bold mb-1">Watch Matchup Stream</h3>
                <p className="text-muted-foreground text-sm">
                  {streamStatus === 'upcoming' ? `Stream begins exactly at ${formattedStreamTime}` : 'Synchronized global broadcast'}
                </p>
              </div>
              
              <div className="flex items-center gap-6 flex-1 justify-center bg-background/50 px-8 py-4 rounded-xl border border-border/50">
                <div className="text-center">
                  <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team1.emoji}</div>
                  <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team1.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{liveMatch.team1_record.wins} - {liveMatch.team1_record.losses}</div>
                </div>
                <div className="text-2xl font-black text-muted-foreground/30 px-4">VS</div>
                <div className="text-center">
                  <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team2.emoji}</div>
                  <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team2.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{liveMatch.team2_record.wins} - {liveMatch.team2_record.losses}</div>
                </div>
              </div>

              <div className="flex-1 flex justify-center md:justify-end">
                <Button asChild size="lg" className={`${streamStatus === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold w-full md:w-auto h-14 px-8 text-lg shadow-xl`}>
                  <Link href={`/stream/${liveMatch.sim_match_id}`}>
                    Tune In <PlayCircle className="ml-2 size-5" />
                  </Link>
                </Button>
              </div>

            </CardContent>
          </Card>
        </section>
      )}

      {/* Countdown Timer */}
      {countdownTimer && (
        <CountdownTimer
          title={countdownTimer.title}
          endTime={countdownTimer.end_time}
          linkUrl={countdownTimer.link_url}
          linkText={countdownTimer.link_text}
        />
      )}

      <DraftStatusWidget variant="full" />

      {/* Stats Overview */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Current Season</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Trophy className="size-6 text-yellow-500" />
              {season?.name || "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {season ? `Started ${new Date(season.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "No active season"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Teams</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="size-6" />8
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Competing this season</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recent Picks</CardDescription>
            <CardTitle className="text-3xl">{recentPicks.length > 0 ? recentPicks.length + "+" : "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Draft picks this season</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recent Games</CardDescription>
            <CardTitle className="text-3xl">{recentGames.length > 0 ? recentGames.length + "+" : "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Games played</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Draft Picks */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Draft Picks</h2>
            <Button variant="ghost" asChild>
              <Link href={liveDraftLink}>View All</Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {recentPicks.length > 0 ? (
                <div className="divide-y">
                  {recentPicks.map((pick) => (
                    <div key={pick.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{pick.card_name}</span>
                            {pick.card_type && (
                              <Badge variant="secondary" className="text-xs">
                                {pick.card_type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {pick.team_emoji} {pick.team_name}
                            {pick.pick_number && <> &middot; Pick #{pick.pick_number}</>}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {getRelativeTime(pick.drafted_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No draft picks yet. Check back once the draft begins!
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recent Games */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Games</h2>
            <Button variant="ghost" asChild>
              <Link href="/schedule">View All</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {recentGames.length > 0 ? (
              recentGames.map((game) => (
                <Card key={game.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <Calendar className="size-4 text-muted-foreground mt-0.5" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(game.played_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">
                        {game.team1_emoji} {game.team1_name}
                        <span className="text-muted-foreground font-normal ml-2">{game.team1_score}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">vs</p>
                      <p className="font-semibold text-sm">
                        {game.team2_emoji} {game.team2_name}
                        <span className="text-muted-foreground font-normal ml-2">{game.team2_score}</span>
                      </p>
                    </div>
                    {game.winner_id && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Trophy className="size-3 text-yellow-500" />
                        {getWinnerEmoji(game)} {getWinnerName(game)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No games played yet.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>

      {/* Latest News */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest News</h2>
          <Button variant="ghost" asChild>
            <Link href="/news">View All</Link>
          </Button>
        </div>
        {adminNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {adminNews.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">News</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {item.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{item.author_name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No news available yet. Check back soon!
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              Visit our CubeCobra page for complete cube details and card lists.
            </p>
            <Button variant="outline" asChild>
              <a
                href="https://cubecobra.com/cube/overview/TheDynastyCube"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open CubeCobra
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
