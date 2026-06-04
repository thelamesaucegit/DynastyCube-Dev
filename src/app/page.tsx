// src/app/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { ArrowRight, Info } from "lucide-react";
import CountdownTimer from "@/app/components/CountdownTimer";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import { CardPreview } from "@/app/components/CardPreview";
import { LiveStreamWidget } from "@/app/components/LiveStreamWidget";
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
import { getTeamsWithDetails } from "@/app/actions/teamActions";

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export default function HomePage() {
  const [season, setSeason] = useState<CurrentSeason | null>(null);
  const [adminNews, setAdminNews] = useState<AdminNews[]>([]);
  const [recentPicks, setRecentPicks] = useState<RecentDraftPick[]>([]);
  const [countdownTimer, setCountdownTimer] = useState<CountdownTimerType | null>(null);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [liveMatch, setLiveMatch] = useState<StreamMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [bgPosition, setBgPosition] = useState({ x: 50, y: 50 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const seasonResult = await getCurrentSeason();
      const currentSeason = seasonResult.season;
      setSeason(currentSeason);
      
      // --- FIX: Use strict type intersection instead of 'any' ---
      const currentPhase = (currentSeason as CurrentSeason & { phase?: string })?.phase || currentSeason?.status;

      let draftSessionPromise: ReturnType<typeof getActiveDraftSession>;
      let liveMatchPromise: ReturnType<typeof getLatestStreamMatch>;

      if (currentPhase === 'draft') {
        draftSessionPromise = getActiveDraftSession();
      } else {
        draftSessionPromise = Promise.resolve({ session: null });
      }

      const isActivePlayPhase = currentPhase && currentPhase !== 'postseason' && currentPhase !== 'draft';
      if (isActivePlayPhase) {
        liveMatchPromise = getLatestStreamMatch();
      } else {
        liveMatchPromise = Promise.resolve({ match: null });
      }
      
      const [
        teamsResult, 
        newsResult, 
        picksResult, 
        timerResult, 
        draftSessionResult, 
        streamResult
      ] = await Promise.all([
        getTeamsWithDetails(),
        getAdminNews(3),
        getRecentDraftPicks(20),
        getActiveCountdownTimer(),
        draftSessionPromise,
        liveMatchPromise,
      ]);
      
      // --- FIX: Use strict type intersection instead of 'any' ---
      const activeTeamCount = teamsResult.teams?.filter(t => !(t as { is_hidden?: boolean }).is_hidden).length || 8;
      
      setAdminNews(newsResult.news);
      setRecentPicks(picksResult.picks.slice(0, activeTeamCount));
      setCountdownTimer(timerResult.timer);
      setDraftSessionId(draftSessionResult.session?.id || null);
      setLiveMatch(streamResult.match);
    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const moveBackground = () => setBgPosition({ x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) });
    const initialTimeout = setTimeout(moveBackground, 100);
    const panInterval = setInterval(moveBackground, 60000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(panInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : "#";
  
  // --- FIX: Calculate Phase safely with strict types ---
  const currentPhase = (season as CurrentSeason & { phase?: string })?.phase || season?.status;
  const isPlayActive = currentPhase && currentPhase !== 'postseason' && currentPhase !== 'draft';

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      <section className="relative overflow-hidden rounded-2xl min-h-[200px] flex flex-col justify-center border border-border/50 shadow-md">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/logo/logo.jpg')",
            backgroundSize: "150%", 
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${bgPosition.x}% ${bgPosition.y}%`,
            transition: "background-position 60s ease-in-out", 
          }}
        />
        <div className="absolute inset-0 bg-black/65" /> 
        <div className="relative px-6 py-8 md:px-10 md:py-10 z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            {season && (
              <div className="mb-3">
                {/* --- FIX: Safe type casting for is_active --- */}
                <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-white/20 backdrop-blur-md">
                  {season.name} {(season as CurrentSeason & { is_active?: boolean }).is_active || season.status === "active" ? "Active" : ""}
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

      {isPlayActive && liveMatch && <LiveStreamWidget initialMatch={liveMatch} onStreamEnd={loadData} />}
      
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest News</h2>
          <Button variant="ghost" asChild>
            <Link href="/news">View All</Link>
          </Button>
        </div>
        {adminNews.length > 0 ? (
          <div className="space-y-6">
            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>Latest</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(adminNews[0].created_at).toLocaleDateString()}</span>
                </div>
                <CardTitle className="text-2xl md:text-3xl">{adminNews[0].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed whitespace-pre-line text-muted-foreground line-clamp-3">{adminNews[0].content}</p>
                <p className="text-xs text-muted-foreground mt-4 font-medium">{adminNews[0].author_name}</p>
              </CardContent>
            </Card>
            {adminNews.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminNews.slice(1).map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">News</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                      <p className="text-xs text-muted-foreground mt-3">{item.author_name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No news available yet. Check back soon!</CardContent>
          </Card>
        )}
      </section>

      {countdownTimer && ( <CountdownTimer title={countdownTimer.title} endTime={countdownTimer.end_time} linkUrl={countdownTimer.link_url} linkText={countdownTimer.link_text}/>)}
      
      {currentPhase === 'draft' && (<DraftStatusWidget variant="full" />)}
      
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
                          {pick.image_url && (<Image src={pick.image_url} alt={pick.card_name} width={40} height={56} className="rounded-sm object-cover shadow-sm hidden sm:block"/>)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-lg">{pick.card_name}</span>
                              {pick.card_type && (<Badge variant="secondary" className="text-[10px]">{pick.card_type}</Badge>)}
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <span className="text-lg">{pick.team_emoji}</span>
                              <span className="font-medium text-foreground/80">{pick.team_name}</span>
                              {pick.pick_number && <span className="text-xs opacity-70 ml-1">&middot; Pick #{pick.pick_number}</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 font-medium bg-muted/50 px-2 py-1 rounded-full">{getRelativeTime(pick.drafted_at)}</span>
                      </div>
                    </div>
                  </CardPreview>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">No draft picks yet. Check back once the draft begins!</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
