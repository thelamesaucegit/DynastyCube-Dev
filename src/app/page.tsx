// src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { ArrowRight, Info, PlayCircle, Radio } from "lucide-react";
import CountdownTimer from "@/app/components/CountdownTimer";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import { CardPreview } from "@/app/components/CardPreview"; // <-- Added CardPreview
import {
  getRecentDraftPicks,
  getCurrentSeason,
  getAdminNews,
  getActiveCountdownTimer,
  getActiveDraftSession,
  type RecentDraftPick,
  type CurrentSeason,
  type AdminNews,
  type CountdownTimer as CountdownTimerType,
} from "@/app/actions/homeActions";
import { getLatestStreamMatch, type StreamMatch } from "@/app/actions/liveStreamActions";
import { getTeamsWithDetails } from "@/app/actions/teamActions"; // <-- Added to count active teams

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
  const [countdownTimer, setCountdownTimer] = useState<CountdownTimerType | null>(null);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [liveMatch, setLiveMatch] = useState<StreamMatch | null>(null);
  const [liveLife, setLiveLife] = useState<{t1: number, t2: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const [bgPosition, setBgPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    loadData();

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

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch up to 20 picks initially, we will slice it down based on the actual team count
      const [teamsResult, seasonResult, newsResult, picksResult, timerResult, draftSessionResult, streamResult] = await Promise.all([
        getTeamsWithDetails(),
        getCurrentSeason(),
        getAdminNews(3),
        getRecentDraftPicks(20), 
        getActiveCountdownTimer(),
        getActiveDraftSession(),
        getLatestStreamMatch()
      ]);

      const activeTeamCount = teamsResult.teams?.filter(t => !t.is_hidden).length || 8;

      setSeason(seasonResult.season);
      setAdminNews(newsResult.news);
      setRecentPicks(picksResult.picks.slice(0, activeTeamCount)); // Exactly 1 per active team!
      setCountdownTimer(timerResult.timer);
      setDraftSessionId(draftSessionResult.session?.id || null);
      setLiveMatch(streamResult.match);

    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!liveMatch || !liveMatch.life_timeline || liveMatch.life_timeline.length === 0) return;
    
    const broadcastTime = new Date(new Date(liveMatch.match_date).getTime() + (30 * 60000)).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - broadcastTime;
      
      if (diff > 0) {
        const ticksPassed = Math.floor(diff / 750);
        
        if (ticksPassed < liveMatch.life_timeline.length) {
           const [t1, t2] = liveMatch.life_timeline[ticksPassed];
           setLiveLife({ t1, t2 });
        } else {
           const [t1, t2] = liveMatch.life_timeline[liveMatch.life_timeline.length - 1];
           setLiveLife({ t1, t2 });
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [liveMatch]);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : "#";

  let streamStatus = 'replay';
  let formattedStreamTime = '';
  if (liveMatch) {
      const broadcastTime = new Date(new Date(liveMatch.match_date).getTime() + (30 * 60000));
      const now = Date.now();
      const diff = broadcastTime.getTime() - now;

      if (diff > 0) {
          streamStatus = 'upcoming';
          formattedStreamTime = broadcastTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } else if (diff > -900000) { 
          streamStatus = 'live';
      }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      
      {/* Hero Section (Slimmed Down) */}
      <section className="relative overflow-hidden rounded-2xl min-h-[200px] flex flex-col justify-center border border-border/50 shadow-md">
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
        <div className="absolute inset-0 bg-black/65" /> 
        <div className="relative px-6 py-8 md:px-10 md:py-10 z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            {season && (
              <div className="mb-3">
                <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-white/20 backdrop-blur-md">
                  {season.name} {season.status === "active" ? "Active" : ""}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-3 md:gap-4 mb-3">
              <Image
                src="/images/logo/logo.jpg"
                alt="Dynasty Cube Logo"
                width={48}
                height={48}
                className="size-8 md:size-12 rounded-lg drop-shadow-md flex-shrink-0"
              />
              <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight">
                The Dynasty Cube
              </h1>
            </div>
            <p className="text-base md:text-lg text-zinc-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-medium leading-relaxed">
              A collaborative, living draft league where teams compete, evolve, and shape the fate of the multiverse.
            </p>
          </div>
          
          {/* FIX: Side-by-side buttons with aligned icons */}
          <div className="flex flex-row items-center gap-3 flex-shrink-0 w-full lg:w-auto">
            <Button size="lg" className="shadow-lg flex-1 lg:flex-none lg:w-48" asChild>
              <Link href="/about">
                League Info
                <Info className="ml-2 size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm flex-1 lg:flex-none lg:w-48" asChild>
              <Link href="/pools/draft">
                Draft Pool
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Stream Banner (Shrunk to max-w-5xl to be 80% width and centered) */}
      {liveMatch && (
        <section className="max-w-5xl mx-auto w-full">
          <Card className={`overflow-hidden relative border ${streamStatus === 'live' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-950/10' : 'border-blue-500/30 bg-blue-950/10'}`}>
            {streamStatus === 'live' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />}
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex-1 text-center md:text-left">
                {streamStatus === 'live' ? (
                   <Badge className="bg-red-500 hover:bg-red-600 mb-3 animate-pulse px-3 py-1"><Radio className="size-3 mr-2 animate-ping" /> LIVE NOW</Badge>
                ) : streamStatus === 'upcoming' ? (
                   <Badge variant="secondary" className="mb-3 px-3 py-1 text-blue-400 border-blue-400/30">UPCOMING BROADCAST</Badge>
                ) : (
                   <Badge variant="outline" className="mb-3 px-3 py-1">LATEST GAME</Badge>
                )}
                <h3 className="text-2xl font-bold mb-1">Live Game Stream</h3>
                <p className="text-muted-foreground text-sm">
                  {streamStatus === 'upcoming' ? `Stream begins exactly at ${formattedStreamTime}` : 'Synchronized global broadcast'}
                </p>
              </div>
              
              <div className="flex items-center gap-6 flex-1 justify-center bg-background/50 px-8 py-4 rounded-xl border border-border/50 shadow-inner">
                <div className="text-center">
                  <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team1.emoji}</div>
                  <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team1.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1 mb-2">{liveMatch.team1_record.wins} - {liveMatch.team1_record.losses}</div>
                  {streamStatus === 'live' && liveLife && (
                    <Badge variant="outline" className="text-lg px-3 py-1 border-red-500/30 bg-red-950/20 text-red-400 shadow-sm">
                       ♥ {liveLife.t1}
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-black text-muted-foreground/30 px-4 italic">VS</div>
                <div className="text-center">
                  <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team2.emoji}</div>
                  <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team2.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1 mb-2">{liveMatch.team2_record.wins} - {liveMatch.team2_record.losses}</div>
                  {streamStatus === 'live' && liveLife && (
                    <Badge variant="outline" className="text-lg px-3 py-1 border-red-500/30 bg-red-950/20 text-red-400 shadow-sm">
                       ♥ {liveLife.t2}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex-1 flex justify-center md:justify-end">
                <Button asChild size="lg" className={`${streamStatus === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold w-full md:w-auto h-14 px-8 text-lg shadow-xl hover:scale-105 transition-transform`}>
                  <Link href={`/stream/${liveMatch.sim_match_id}`}>
                    Tune In <PlayCircle className="ml-2 size-5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Latest News (Full Width natively) */}
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

      {/* Recent Draft Picks (Shrunk to max-w-5xl to be 80% width and centered) */}
      <section className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent Draft Picks</h2>
          <Button variant="ghost" asChild>
            <Link href={liveDraftLink}>View All</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {recentPicks.length > 0 ? (
              <div className="flex flex-col">
                {recentPicks.map((pick) => (
                  <CardPreview key={pick.id} card={{ card_name: pick.card_name, image_url: pick.image_url, oldest_image_url: pick.oldest_image_url }}>
                    <div className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 flex items-center gap-4">
                          {pick.image_url && (
                            <Image 
                              src={pick.image_url} 
                              alt={pick.card_name} 
                              width={40} 
                              height={56} 
                              className="rounded-sm object-cover shadow-sm hidden sm:block"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-lg">{pick.card_name}</span>
                              {pick.card_type && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {pick.card_type}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <span className="text-lg">{pick.team_emoji}</span>
                              <span className="font-medium text-foreground/80">{pick.team_name}</span>
                              {pick.pick_number && <span className="text-xs opacity-70 ml-1">&middot; Pick #{pick.pick_number}</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 font-medium bg-muted/50 px-2 py-1 rounded-full">
                          {getRelativeTime(pick.drafted_at)}
                        </span>
                      </div>
                    </div>
                  </CardPreview>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                No draft picks yet. Check back once the draft begins!
              </div>
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
