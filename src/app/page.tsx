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
import {
  getRecentTransactions,
  getCurrentSeason,
  getAdminNews,
  getActiveCountdownTimer,
  getActiveDraftSession,
  getHomepageActivePolls,
  getCypherStats,
  type RecentTransaction,
  type CurrentSeason,
  type AdminNews,
  type CountdownTimer as CountdownTimerType,
  type HomepagePoll,
  type CypherStats
} from "@/app/actions/homeActions";
import { getLatestStreamMatch, type StreamMatch } from "@/app/actions/liveStreamActions";
import { getTeamsWithDetails } from "@/app/actions/teamActions";
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
  // Core Page State
  const [season, setSeason] = useState<CurrentSeason | null>(null);
  const [adminNews, setAdminNews] = useState<AdminNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<AdminNews | null>(null);
  const [countdownTimer, setCountdownTimer] = useState<CountdownTimerType | null>(null);
  const [liveMatch, setLiveMatch] = useState<StreamMatch | null>(null);
  const [activePolls, setActivePolls] = useState<HomepagePoll[]>([]);
  const [cypherStats, setCypherStats] = useState<CypherStats | null>(null);
  const [activeTeamCount, setActiveTeamCount] = useState(8);
  const [loadingCore, setLoadingCore] = useState(true);

  // Draft-Specific State (Loaded Non-Blockingly)
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);

  // 1. Load Core Data
  const loadCoreData = useCallback(async () => {
    try {
      const seasonResult = await getCurrentSeason();
      const currentSeason = seasonResult.season;
      setSeason(currentSeason);
      
      const currentPhase = currentSeason?.phase;
      const isActivePlayPhase = currentPhase && currentPhase !== 'postseason' && currentPhase !== 'draft';
      
      const liveMatchPromise = isActivePlayPhase ? getLatestStreamMatch() : Promise.resolve({ match: null });
      const [teamsResult, newsResult, timerResult, streamResult, pollsResult, cypherResult] = await Promise.all([
        getTeamsWithDetails(),
        getAdminNews(1), 
        getActiveCountdownTimer(),
        liveMatchPromise,
        getHomepageActivePolls(),
        getCypherStats()
      ]);
      
      setActiveTeamCount(teamsResult.teams?.filter(t => !(t as { is_hidden?: boolean }).is_hidden).length || 8);
      setAdminNews(newsResult.news);
      setCountdownTimer(timerResult.timer);
      setLiveMatch(streamResult.match);
      setActivePolls(pollsResult.polls || []);
      setCypherStats(cypherResult.stats || null);
    } catch (error) {
      console.error("Error loading core home page data:", error);
    } finally {
      setLoadingCore(false); 
    }
  }, []);

  // 2. Load Draft Data
  const loadDraftData = useCallback(async () => {
    try {
      const [draftSessionResult, txResult] = await Promise.all([
        getActiveDraftSession(),
        getRecentTransactions(20) // Fetch from the new unified ledger
      ]);
      setDraftSessionId(draftSessionResult.session?.id || null);
      setRecentTransactions(txResult.transactions);
    } catch (error) {
      console.error("Error loading background tx data:", error);
    } finally {
      setLoadingDraft(false);
    }
  }, []);

  useEffect(() => {
    loadCoreData();
    loadDraftData();
  }, [loadCoreData, loadDraftData]);

  useEffect(() => {
    const interval = setInterval(() => { loadDraftData(); }, 15000);
    return () => clearInterval(interval);
  }, [loadDraftData]);

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

  if (loadingCore) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : "#";
  const currentPhase = season?.phase;
  const isPlayActive = currentPhase && currentPhase !== 'postseason' && currentPhase !== 'draft';
  const visibleTxs = recentTransactions.slice(0, activeTeamCount);

  return (
    <div className="relative space-y-12 container max-w-7xl mx-auto px-4 py-8">
      
      {/* --- OPTIMIZED FULL PAGE BACKGROUND --- */}
      <div className="fixed inset-0 z-[-1] bg-slate-950 pointer-events-none">
        <Image
          src="/images/logo/logo.jpg"
          alt="Dynasty Cube Background"
          fill
          priority
          quality={75}
          className="object-cover opacity-60"
          style={{ animation: 'bg-pan 120s linear infinite alternate' }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>
      <style jsx global>{`
        @keyframes bg-pan {
          0% { object-position: 0% 50%; }
          100% { object-position: 100% 50%; }
        }
      `}</style>

      {/* --- HERO SECTION --- */}
      <section className="relative overflow-hidden rounded-2xl min-h-[200px] flex flex-col justify-center border border-border/30 shadow-lg bg-black/30 backdrop-blur-sm">
        <div className="relative px-6 py-8 md:px-10 md:py-10 z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            {season && (
              <div className="mb-3">
                <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-white/20 backdrop-blur-md">
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

      {isPlayActive && liveMatch && <LiveStreamWidget initialMatch={liveMatch} onStreamEnd={loadCoreData} />}
      
      {(currentPhase === 'playoffs' || currentPhase === 'postseason') && season && (
        <PlayoffBracket seasonId={season.id} seasonName={season.season_name} />
      )}

      {/* --- NOTIFICATIONS ROW: VOTES & CYPHER --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Votes Card */}
        {activePolls.length > 0 && (
          <Link href="/vote" className="group">
            <Card className="h-full bg-slate-900/70 backdrop-blur-md border-primary/30 hover:border-primary/60 transition-colors shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                      <Vote className="size-5 text-primary" />
                      Active Votes
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                      {activePolls.slice(0, 3).map(poll => (
                        <li key={poll.id} className="truncate pr-2">{poll.title}</li>
                      ))}
                      {activePolls.length > 3 && (
                        <li className="italic">+{activePolls.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                  <ArrowRight className="size-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Cypher Status Card */}
        {cypherStats && (
          <Link href="/cypher" className="group">
            <Card className="h-full bg-slate-900/70 backdrop-blur-md border-amber-500/30 hover:border-amber-500/60 transition-colors shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-500">
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
                      <Badge className="mt-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-none">
                        <LockOpen className="size-3 mr-1" /> New Cypher discovered!
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="size-5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

     {/* --- LATEST NEWS SECTION --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest News</h2>
          <Button variant="ghost" asChild>
            <Link href="/news">View All</Link>
          </Button>
        </div>
        {adminNews.length > 0 ? (
          <div className="space-y-6">
            <Card 
              className="bg-slate-900/70 backdrop-blur-md overflow-hidden hover:shadow-xl transition-all cursor-pointer border-transparent hover:border-primary/50 group shadow-lg"
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
          <Card className="bg-slate-900/70 backdrop-blur-md">
            <CardContent className="p-8 text-center text-muted-foreground">No news available yet. Check back soon!</CardContent>
          </Card>
        )}
      </section>

      {countdownTimer && ( <CountdownTimer title={countdownTimer.title} endTime={countdownTimer.end_time} linkUrl={countdownTimer.link_url} linkText={countdownTimer.link_text}/>)}
      
      {currentPhase === 'draft' && (<DraftStatusWidget variant="full" />)}
      
     <section className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Card Acquisitions</h2>
          <Button variant="ghost" asChild>
            <Link href="/transactions">View All</Link> 
          </Button>
        </div>
        <Card className="bg-slate-900/70 backdrop-blur-md shadow-lg">
          <CardContent className="p-0">
            {loadingDraft ? (
               <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-3">
                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                 Checking transactions...
               </div>
            ) : visibleTxs.length > 0 ? (
              <div className="flex flex-col">
                
                {visibleTxs.map((tx) => (
                  <CardPreview key={tx.id} card={{ card_name: tx.card_name, image_url: tx.image_url, oldest_image_url: tx.oldest_image_url }}>
                    <div className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/50 last:border-0">
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
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 font-medium bg-muted/50 px-2 py-1 rounded-full">
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
  );
}
