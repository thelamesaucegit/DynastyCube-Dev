// src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Sparkles, Users, Trophy, Calendar, ArrowRight, Info } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seasonResult, newsResult, picksResult, gamesResult, timerResult, draftSessionResult] = await Promise.all([
        getCurrentSeason(),
        getAdminNews(3),
        getRecentDraftPicks(5),
        getRecentGames(5),
        getActiveCountdownTimer(),
        getActiveDraftSession(),
      ]);

      setSeason(seasonResult.season);
      setAdminNews(newsResult.news);
      setRecentPicks(picksResult.picks);
      setRecentGames(gamesResult.games);
      setCountdownTimer(timerResult.timer);
      setDraftSessionId(draftSessionResult.session?.id || null);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : '#'; 

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-indigo-600/20" />
        <div className="relative px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-6 text-purple-400" />
              {season && (
                <Badge variant="secondary" className="text-xs">
                  {season.name} {season.status === "active" ? "Active" : ""}
                </Badge>
              )}
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground to-purple-400 bg-clip-text text-transparent">
              The Dynasty Cube
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              A collaborative, living draft league where teams compete, evolve, and shape the fate of the multiverse.
              Part draft league, part fantasy sports, part cosmic entity.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <Link href="/about">
                  <Info className="mr-2 size-4" />
                  About The League
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/pools">
                  Browse Draft Pool
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/schedule">View Schedule</Link>
              </Button>
            </div>
          </div>
        </div>
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

      {/* Draft Status */}
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

      {/* CubeCobra Link */}
      <section>
        <Card className="border-2 border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
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
