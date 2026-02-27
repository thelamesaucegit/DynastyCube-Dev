// src/app/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image"; // Import the Image component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Users, Trophy, Calendar, ArrowRight, Info } from "lucide-react";
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
    // Give it a tiny delay to start moving immediately on first load
    const initialTimeout = setTimeout(moveBackground, 100);
    // Pick a new random destination every 25 seconds
    const panInterval = setInterval(moveBackground, 25000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(panInterval);
    };
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
        {/* Changed loading spinner color */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const liveDraftLink = draftSessionId ? `/draft/${draftSessionId}/live` : "#";

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Section with Random Panning Background */}
      <section className="relative overflow-hidden rounded-2xl min-h-[400px] flex flex-col justify-center">
        {/* The Image Layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/logo/logo.jpg')",
            backgroundSize: "150%", // Zoom in to allow panning without showing edges
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${bgPosition.x}% ${bgPosition.y}%`,
            transition: "background-position 25s ease-in-out", // Matches interval for endless smooth gliding
          }}
        />
        {/* The Overlays for Legibility */}
        <div className="absolute inset-0 bg-black/60" /> {/* Base darkness */}

        {/* Content Layer */}
        <div className="relative px-8 py-16 md:py-24 z-10">
          <div className="max-w-3xl">
            {/* Season Badge is now above the title */}
            {season && (
              <div className="mb-4">
                <Badge variant="secondary" className="text-xs bg-black/50 text-white border-white/20 backdrop-blur-md">
                  {season.name} {season.status === "active" ? "Active" : ""}
                </Badge>
              </div>
            )}

            {/* Container for logo and title */}
            <div className="flex items-center gap-4 md:gap-6 mb-4">
              {/* Scaled-up logo */}
              <Image
                src="/images/logo/logo.jpg"
                alt="Dynasty Cube Logo"
                width={56}
                height={56}
                className="size-10 md:size-14 rounded-lg drop-shadow-md flex-shrink-0"
              />
              {/* Main title */}
              <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight">
                The Dynasty Cube
              </h1>
            </div>

            <p className="text-lg md:text-xl text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-8 max-w-2xl font-medium leading-relaxed">
              A collaborative, living draft league where teams compete, evolve, and shape the fate of the multiverse.
              Part draft league, part fantasy sports, part cosmic entity.
            </p>

            <div className="flex flex-wrap gap-4">
              {/* Removed purple color from primary button */}
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
        {/* Removed purple border and gradient background */}
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
