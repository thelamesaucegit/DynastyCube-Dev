// src/app/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { PlayoffBracket } from "@/app/components/PlayoffBracket";
import { Badge } from "@/app/components/ui/badge";
import { ArrowRight, Info, X, Vote, BookOpen, Sparkles, LockOpen } from "lucide-react";
import CountdownTimer from "@/app/components/CountdownTimer";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import { CardPreview } from "@/app/components/CardPreview";
import { LiveStreamWidget } from "@/app/components/LiveStreamWidget";
import { getHomepageData, type HomepageData } from "@/app/actions/homeActions"; 
import { TargetedGlitchedText } from "@/app/components/lore/TargetedGlitchedText";

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
  const [pageData, setPageData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<HomepageData['adminNews'][0] | null>(null);

  const loadPageData = useCallback(async () => {
    try {
      const result = await getHomepageData();
      if (result.data) {
        setPageData(result.data);
      } else {
        console.error("Failed to load homepage data:", result.error);
      }
    } catch (error) {
      console.error("Critical error on homepage:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const getPhaseDisplayLabel = (phase?: string) => {
    switch (phase) {
      case "draft": return "Draft";
      case "preseason": return "Pre Season";
      case "season": return "Regular Season";
      case "playoffs": return "Post Season";
      case "postseason": return "Off Season";
      default: return "Active";
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  if (!pageData) {
      return <div className="text-center py-16">Failed to load page data. Please try again.</div>;
  }

  const {
      season, adminNews, countdownTimer, liveMatch, activePolls, cypherStats,
      activeTeamCount, recentTransactions, activeDraftSessionId
  } = pageData;

  const currentPhase = season?.phase;
  const isPlayActive = currentPhase && currentPhase !== 'postseason' && currentPhase !== 'draft';
  const visibleTxs = recentTransactions.slice(0, activeTeamCount);

  return (
    <div className="relative min-h-screen">
      
      {/* --- THE FIX: HARDWARE-ACCELERATED GLOBAL BACKGROUND --- */}
      {/* z-0 ensures it sits on top of the root layout's solid color, while page content sits at z-10 */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-slate-950 overflow-hidden">
        <Image
          src="/images/logo/logo.jpg"
          alt="Dynasty Cube Background"
          fill
          priority
          quality={60} // Highly optimized
          className="object-cover opacity-20 animate-bg-pan-smooth"
        />
      </div>

      {/* Hardware-accelerated CSS Keyframes for buttery-smooth panning */}
      <style jsx global>{`
        @keyframes bg-pan-smooth {
          0% { transform: scale(1.15) translate3d(4%, 4%, 0); }
          100% { transform: scale(1.15) translate3d(-4%, -4%, 0); }
        }
        .animate-bg-pan-smooth {
          animation: bg-pan-smooth 120s linear infinite alternate;
        }
      `}</style>

      {/* --- FOREGROUND CONTENT (Elevated to z-10) --- */}
      <div className="relative z-10 space-y-12 container max-w-7xl mx-auto px-4 py-8">
          
        {/* --- HERO SECTION (The Full-Opacity "Window") --- */}
        <section className="relative overflow-hidden rounded-2xl min-h-[200px] flex flex-col justify-center border border-border/50 shadow-2xl">
          {/* This image mimics the global background perfectly, but at full opacity */}
          
          <div className="absolute inset-0 bg-black/60" /> {/* Slight dimming for text readability */}
          
          <div className="relative px-6 py-8 md:px-10 md:py-10 z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              {season && (
                <div className="mb-3">
                  <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-white/20 backdrop-blur-md shadow-sm">
                    {season.season_name} • {getPhaseDisplayLabel(season.phase)}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-3 md:gap-4 mb-3">
                <Image
                  src="/images/logo/logo.jpg"
                  alt="Dynasty Cube Logo"
                  width={48}
                  height={48}
                  className="size-8 md:size-12 rounded-lg drop-shadow-lg flex-shrink-0"
                />
                <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight">
                  The Dynasty Cube
                </h1>
              </div>
              <p className="text-base md:text-lg text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-medium leading-relaxed">
                A collaborative, living draft league where teams compete, evolve, and shape the fate of the multiverse.
              </p>
            </div>
            <div className="flex flex-row items-center gap-3 flex-shrink-0 w-full lg:w-auto">
              <Button size="lg" className="shadow-xl flex-1 lg:flex-none lg:w-48" asChild>
                <Link href="/about">
                  League Info
                  <Info className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md flex-1 lg:flex-none lg:w-48 shadow-xl" asChild>
                <Link href="/pools/draft">
                  Draft Pool
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
 {countdownTimer && ( <CountdownTimer title={countdownTimer.title} endTime={countdownTimer.end_time} linkUrl={countdownTimer.link_url} linkText={countdownTimer.link_text}/>)}

        {isPlayActive && liveMatch && <LiveStreamWidget initialMatch={liveMatch} onStreamEnd={loadPageData} />}
        
        {(currentPhase === 'playoffs' || currentPhase === 'postseason') && season && (
          <PlayoffBracket seasonId={season.id} seasonName={season.season_name} />
        )}
        
        {currentPhase === 'draft' && (<DraftStatusWidget variant="full" />)}
        
        {/* --- NOTIFICATIONS ROW (Frosted Glass Effect) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activePolls.length > 0 && (
            <Link href="/vote" className="group">
              <Card className="h-full bg-slate-900/60 backdrop-blur-md border-primary/30 hover:border-primary/60 transition-colors shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                        <Vote className="size-5 text-primary" />
                        Community Votes
                      </h3>
                      <ul className="text-sm text-muted-foreground space-y-1 pl-1">
                        {/* THE FIX: Replaced 'any' with a strict inline interface */}
                        {activePolls.slice(0, 3).map((poll: { id: string; title: string; ends_at?: string; is_active?: boolean }) => {
                          const isEnded = new Date(poll.ends_at || Date.now()) < new Date() || !poll.is_active;
                          return (
                             <li key={poll.id} className="truncate flex items-center gap-2">
                               {isEnded ? (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Ended</Badge>
                               ) : (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-green-500/20 text-green-500 border-green-500/30">Active</Badge>
                               )}
                               {poll.title}
                             </li>
                          );
                        })}
                        {activePolls.length > 3 && (
                          <li className="italic text-xs mt-2 pl-12 text-muted-foreground/60">+{activePolls.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                    <ArrowRight className="size-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {cypherStats && (
            <Link href="/cypher" className="group">
              <Card className="h-full bg-slate-900/60 backdrop-blur-md border-amber-500/30 hover:border-amber-500/60 transition-colors shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-2 text-amber-500">
                        <BookOpen className="size-5" />
                        The Cypher
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-black text-foreground">
                          {cypherStats.percentRemaining}%
                        </div>
                        <div className="text-sm text-muted-foreground leading-tight">
                          of the pages remain <br /> shrouded in mystery.
                        </div>
                      </div>
                      {cypherStats.hasRecentCypher && (
                        <Badge className="mt-3 bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-none">
                          <LockOpen className="size-3 mr-1" /> New Cypher discovered!
                        </Badge>
                      )}
                    </div>
                    <ArrowRight className="size-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

       {/* --- LATEST NEWS SECTION (Frosted Glass Effect) --- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between drop-shadow-md">
            <h2 className="text-2xl font-bold">Latest News</h2>
            <Button variant="ghost" asChild>
              <Link href="/news">View All</Link>
            </Button>
          </div>
          {adminNews.length > 0 ? (
            <div className="space-y-6">
              <Card 
                className="bg-slate-900/60 backdrop-blur-md overflow-hidden hover:shadow-xl transition-all cursor-pointer border-transparent hover:border-primary/50 group shadow-lg"
                onClick={() => setSelectedNews(adminNews[0])}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge>Latest</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(adminNews[0].created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <CardTitle className="text-2xl md:text-3xl group-hover:text-primary transition-colors">
                    <TargetedGlitchedText text={adminNews[0].title} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed whitespace-pre-line text-muted-foreground line-clamp-3">
                    <TargetedGlitchedText text={adminNews[0].content} />
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-xs text-muted-foreground font-medium">{adminNews[0].author_name}</p>
                    <span className="text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Read full story <ArrowRight className="ml-1 size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-slate-900/60 backdrop-blur-md shadow-lg">
              <CardContent className="p-8 text-center text-muted-foreground">No news available yet. Check back soon!</CardContent>
            </Card>
          )}
        </section>

       
        
       {/* --- LATEST ACQUISITIONS (Frosted Glass Effect) --- */}
       <section className="max-w-5xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between drop-shadow-md">
            <h2 className="text-2xl font-bold">Latest Card Acquisitions</h2>
            <Button variant="ghost" asChild>
              <Link href="/transactions">View All</Link> 
            </Button>
          </div>
          <Card className="bg-slate-900/60 backdrop-blur-md shadow-lg">
            <CardContent className="p-0">
              {visibleTxs.length > 0 ? (
                <div className="flex flex-col">
                  {visibleTxs.map((tx) => (
                    <CardPreview key={tx.id} card={{ card_name: tx.card_name, image_url: tx.image_url, oldest_image_url: tx.oldest_image_url }}>
                      <div className="p-4 hover:bg-slate-800/60 transition-colors cursor-pointer border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 flex items-center gap-4">
                            {tx.image_url && (<Image src={tx.image_url} alt={tx.card_name} width={40} height={56} className="rounded-sm object-cover shadow-sm hidden sm:block"/>)}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-lg">
                                  <TargetedGlitchedText text={tx.card_name} />
                                </span>
                                {tx.card_type && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    <TargetedGlitchedText text={tx.card_type} />
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <span className="text-lg">{tx.team_emoji}</span>
                                <span className="font-medium text-foreground/80">
                                  <TargetedGlitchedText text={tx.team_name} />
                                </span>
                                <span className="text-xs ml-1 opacity-70 border-l border-border/50 pl-2">
                                  <TargetedGlitchedText text={
                                    tx.acquisition_method === 'trade' && tx.from_team_emoji 
                                      ? `via Trade from ${tx.from_team_emoji}`
                                      : `via ${tx.acquisition_method.replace('_', ' ')}`
                                  } />
                                </span>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 font-medium bg-black/40 px-2 py-1 rounded-full shadow-inner">
                            <TargetedGlitchedText text={getRelativeTime(tx.acquired_at)} />
                          </span>
                        </div>
                      </div>
                    </CardPreview>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">No transactions yet.</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* --- MODAL OVERLAY --- */}
        {selectedNews && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedNews(null)}
          >
            <div 
              className="bg-slate-900/90 backdrop-blur-xl border border-border shadow-2xl rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border flex justify-between items-start bg-muted/30">
                <div>
                  <Badge className="mb-2">Latest</Badge>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    <TargetedGlitchedText text={selectedNews.title} />  
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <span>{new Date(selectedNews.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{selectedNews.author_name}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNews(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <p className="whitespace-pre-line text-base md:text-lg leading-relaxed text-foreground/90">
                  <TargetedGlitchedText text={selectedNews.content} />
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
