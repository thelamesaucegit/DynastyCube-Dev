// src/app/components/DraftStatusWidget.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { getTeamDraftPicks } from "@/app/actions/draftActions";
import {
  getActiveDraftSession,
  checkDraftTimer,
  type DraftSession,
} from "@/app/actions/draftSessionActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Clock, ChevronRight, Timer, CalendarClock, PartyPopper } from "lucide-react";

interface DraftStatusWidgetProps {
  variant: "full" | "compact" | "team";
  teamId?: string;
}

export function DraftStatusWidget({ variant, teamId }: DraftStatusWidgetProps) {
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [session, setSession] = useState<DraftSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  const prevStatusRef = useRef<DraftStatus | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State to hold the "Team X drafted Y" notification
  const [recentPick, setRecentPick] = useState<{ teamName: string; teamEmoji: string; cardName: string } | null>(null);

  useEffect(() => {
    loadStatus();

    // Poll every 10 seconds to catch auto-draft timers and session changes quickly
    const interval = setInterval(loadStatus, 10000);

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatus = async () => {
    try {
      const [statusResult, sessionResult] = await Promise.all([
        getDraftStatus(),
        getActiveDraftSession(),
      ]);
      
      const newStatus = statusResult.status;

      // Detect if a new pick was just made
      if (prevStatusRef.current && newStatus) {
        if (newStatus.totalPicks > prevStatusRef.current.totalPicks) {
          const justPickedTeam = prevStatusRef.current.onTheClock;
          
          // Fetch their picks to get the actual card name
          const { picks } = await getTeamDraftPicks(justPickedTeam.teamId);
          const validPicks = picks.filter((p) => p.card_id !== "skipped-pick");
          
          if (validPicks.length > 0) {
            const lastPick = validPicks[validPicks.length - 1];
            
            setRecentPick({
              teamName: justPickedTeam.teamName,
              teamEmoji: justPickedTeam.teamEmoji,
              cardName: lastPick.card_name,
            });

            // Clear existing timeout if multiple picks happen fast
            if (timerRef.current) clearTimeout(timerRef.current);
            
            // Hold notification for 10 seconds
            timerRef.current = setTimeout(() => {
              setRecentPick(null);
            }, 10000);
          }
        }
      }

      setStatus(newStatus);
      setSession(sessionResult.session);
      prevStatusRef.current = newStatus;

      // Check if any timer action needs to happen
      if (sessionResult.session) {
        await checkDraftTimer();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Failed to find Server Action")) {
        // Stale deployment — new server code was deployed, reload to get fresh action IDs
        window.location.reload();
        return;
      }
      console.error("Error loading draft status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  // No draft order = no widget
  if (!status) {
    // Show scheduled session info if one exists
    if (session && session.status === "scheduled") {
      return <ScheduledWidget session={session} />;
    }
    return null;
  }

  // If session is completed, show completed state
  if (session?.status === "completed") {
    return <CompletedWidget />;
  }

  if (variant === "full") return <FullWidget status={status} session={session} recentPick={recentPick} />;
  if (variant === "compact") return <CompactWidget status={status} session={session} recentPick={recentPick} />;

  return <TeamWidget status={status} session={session} teamId={teamId || ""} recentPick={recentPick} />;
}

// ============================================================================
// COUNTDOWN HOOK
// ============================================================================
function useCountdown(deadline: string | null | undefined): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!deadline) {
      setDisplay("");
      return;
    }

    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay("Auto-drafting...");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setDisplay(`${h}h ${m}m ${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return display;
}

function useStartCountdown(startTime: string | null | undefined): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!startTime) {
      setDisplay("");
      return;
    }

    const update = () => {
      const diff = new Date(startTime).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay("Starting...");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setDisplay(`${days}d ${h}h ${m}m`);
      } else {
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setDisplay(`${h}h ${m}m ${s}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return display;
}

// ============================================================================
// SCHEDULED WIDGET (no draft order yet, but session is scheduled)
// ============================================================================
function ScheduledWidget({ session }: { session: DraftSession }) {
  const startCountdown = useStartCountdown(session.start_time);

  return (
    <section>
      <Card className="border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="size-5 text-blue-500" />
            <h2 className="text-lg font-bold">Draft Scheduled</h2>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              The draft starts on {new Date(session.start_time).toLocaleDateString()} at{" "}
              {new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {startCountdown && (
              <div className="text-right">
                <div className="text-xs text-blue-500 uppercase tracking-wide">Starts in</div>
                <div className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400">
                  {startCountdown}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// COMPLETED WIDGET
// ============================================================================
function CompletedWidget() {
  return (
    <section>
      <Card className="border border-muted bg-muted/20">
        <CardContent className="py-3 px-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            <span className="font-medium">The draft has been completed.</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// FULL VARIANT (Homepage)
// ============================================================================
function FullWidget({ status, session, recentPick }: { status: DraftStatus; session: DraftSession | null; recentPick: any }) {
  const pickCountdown = useCountdown(
    session?.status === "active" ? session.current_pick_deadline : null
  );

  const startCountdown = useStartCountdown(
    session?.status === "scheduled" ? session.start_time : null
  );

  const isScheduled = session?.status === "scheduled";
  const isActive = session?.status === "active";
  const isPaused = session?.status === "paused";

  return (
    <section>
      {/* 10-second celebration banner */}
      {recentPick && (
        <Card className="mb-4 border-2 border-green-500/50 bg-green-500/10 animate-in fade-in slide-in-from-top-4 duration-500">
          <CardContent className="p-4 flex items-center justify-center gap-3">
            <PartyPopper className="size-6 text-green-600 dark:text-green-400 animate-bounce" />
            <h3 className="text-xl font-bold text-green-700 dark:text-green-300 text-center">
              {recentPick.teamEmoji} {recentPick.teamName} drafted {recentPick.cardName}!
            </h3>
            <PartyPopper className="size-6 text-green-600 dark:text-green-400 animate-bounce" />
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-5 text-amber-500" />
            <h2 className="text-lg font-bold">Draft Status</h2>
            {isPaused && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                Paused
              </Badge>
            )}
            {isScheduled && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Starts {startCountdown || "soon"}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs ml-auto">
              {status.seasonName}
            </Badge>
          </div>

          {/* On the Clock & On Deck */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {/* On the Clock */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 transition-all">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">
                On the Clock
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{status.onTheClock.teamEmoji}</span>
                <div className="flex-1">
                  <div className="text-xl font-bold">{status.onTheClock.teamName}</div>
                  <div className="text-sm text-muted-foreground">
                    Pick #{status.onTheClock.pickPosition} &middot; Round {status.currentRound}
                    {session?.total_rounds ? ` of ${session.total_rounds}` : ""}
                  </div>
                </div>

                {/* Countdown timer */}
                {isActive && pickCountdown && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Timer className="size-3" />
                      <span>Auto-draft</span>
                    </div>
                    <div className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400">
                      {pickCountdown}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* On Deck */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-2">
                On Deck
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{status.onDeck.teamEmoji}</span>
                <div>
                  <div className="text-xl font-bold">{status.onDeck.teamName}</div>
                  <div className="text-sm text-muted-foreground">
                    Pick #{status.onDeck.pickPosition}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>
                Round {status.currentRound}
                {session?.total_rounds ? ` of ${session.total_rounds}` : ""} Progress
              </span>
              <span>{status.totalPicks} total picks</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(((status.totalTeams - status.draftOrder.filter((t) => t.picksMade < status.currentRound).length) / status.totalTeams) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Draft Order */}
          <div className="flex flex-wrap gap-2">
            {status.draftOrder.map((team) => {
              const isOnClock = team.teamId === status.onTheClock.teamId;
              const isOnDeck = team.teamId === status.onDeck.teamId;
              const hasPicked = team.picksMade >= status.currentRound;

              return (
                <div
                  key={team.teamId}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                    isOnClock
                      ? "bg-green-500/15 border-green-500/40 font-semibold"
                      : isOnDeck
                        ? "bg-yellow-500/15 border-yellow-500/40"
                        : hasPicked
                          ? "bg-muted/50 border-muted text-muted-foreground"
                          : "bg-background border-border"
                  }`}
                >
                  <span>{team.teamEmoji}</span>
                  <span className="hidden sm:inline">{team.teamName}</span>
                  <span className="text-xs text-muted-foreground">({team.picksMade})</span>
                  {isOnClock && <span className="size-2 rounded-full bg-green-500 animate-pulse" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// COMPACT VARIANT (Teams Listing)
// ============================================================================
function CompactWidget({ status, session, recentPick }: { status: DraftStatus; session: DraftSession | null; recentPick: any }) {
  const pickCountdown = useCountdown(
    session?.status === "active" ? session.current_pick_deadline : null
  );

  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 mb-6">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm min-h-[32px]">
          
          {recentPick ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold animate-in fade-in zoom-in duration-300 w-full md:w-auto">
              <PartyPopper className="size-4 animate-bounce" />
              <span className="text-lg leading-none">{recentPick.teamEmoji}</span>
              <span>{recentPick.teamName} drafted {recentPick.cardName}!</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                <Clock className="size-4 text-amber-500" />
                <span className="font-semibold">Draft Status</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-muted-foreground">On the Clock:</span>
                <span className="font-semibold">{status.onTheClock.teamEmoji} {status.onTheClock.teamName}</span>
              </div>

              <ChevronRight className="size-3 text-muted-foreground hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">On Deck:</span>
                <span className="font-medium">{status.onDeck.teamEmoji} {status.onDeck.teamName}</span>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {pickCountdown && !recentPick && (
              <Badge variant="outline" className="text-xs font-mono animate-in fade-in">
                <Timer className="size-3 mr-1" />
                {pickCountdown}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              Round {status.currentRound}
              {session?.total_rounds ? `/${session.total_rounds}` : ""}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TEAM VARIANT (Team Detail Page)
// ============================================================================
function TeamWidget({ status, session, teamId, recentPick }: { status: DraftStatus; session: DraftSession | null; teamId: string; recentPick: any }) {
  const isOnClock = status.onTheClock.teamId === teamId;
  const isOnDeck = status.onDeck.teamId === teamId;
  const teamEntry = status.draftOrder.find((t) => t.teamId === teamId);

  const pickCountdown = useCountdown(
    session?.status === "active" ? session.current_pick_deadline : null
  );

  if (!teamEntry) return null;

  return (
    <Card
      className={`mb-6 border-2 transition-colors ${
        isOnClock
          ? "border-green-500/40 bg-green-500/5"
          : isOnDeck
            ? "border-yellow-500/40 bg-yellow-500/5"
            : "border-border"
      }`}
    >
      <CardContent className="py-4 px-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-5 gap-y-3">
          
          {/* Recent Pick Override Banner */}
          {recentPick && recentPick.teamName === teamEntry.teamName ? (
             <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold animate-in fade-in zoom-in w-full sm:w-auto">
               <PartyPopper className="size-4 animate-bounce" />
               <span>You drafted {recentPick.cardName}!</span>
             </div>
          ) : recentPick ? (
             <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in w-full sm:w-auto">
               <span>{recentPick.teamEmoji} {recentPick.teamName} drafted {recentPick.cardName}!</span>
             </div>
          ) : (
            /* Standard Team Status */
            <div className="flex items-center gap-2 animate-in fade-in w-full sm:w-auto">
              <Clock className={`size-4 ${isOnClock ? "text-green-500" : isOnDeck ? "text-yellow-500" : "text-muted-foreground"}`} />
              {isOnClock ? (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-bold text-green-600 dark:text-green-400">You are on the clock!</span>
                </div>
              ) : isOnDeck ? (
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">You are on deck</span>
              ) : (
                <span className="text-muted-foreground">Waiting to pick</span>
              )}
            </div>
          )}

          {/* Countdown for on-clock team */}
          {isOnClock && pickCountdown && !recentPick && (
            <div className="flex items-center gap-1.5 text-sm w-full sm:w-auto">
              <Timer className="size-3.5 text-amber-500" />
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{pickCountdown}</span>
              <span className="text-xs text-muted-foreground">until auto-draft</span>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground sm:ml-auto w-full sm:w-auto justify-between sm:justify-end">
            <span>Pick #{teamEntry.pickPosition}</span>
            <span className="text-muted-foreground/40 hidden sm:inline">|</span>
            <span>
              Round {status.currentRound}
              {session?.total_rounds ? ` of ${session.total_rounds}` : ""}
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">|</span>
            <span>{teamEntry.picksMade} picks made</span>
          </div>

          {/* Who's picking if not this team */}
          {!isOnClock && !recentPick && (
            <div className="w-full flex items-center gap-2 text-sm pt-2 sm:pt-1 border-t border-border/50 sm:mt-1 animate-in fade-in">
              <span className="text-muted-foreground">On the clock:</span>
              <span className="font-medium">{status.onTheClock.teamEmoji} {status.onTheClock.teamName}</span>
              {pickCountdown && (
                <span className="text-xs text-muted-foreground font-mono">({pickCountdown})</span>
              )}
              {!isOnDeck && (
                <>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">On deck:</span>
                  <span className="font-medium">{status.onDeck.teamEmoji} {status.onDeck.teamName}</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Utility: Get badge data for a team in the teams listing.
 * Returns "clock" | "deck" | null based on team status.
 */
export function getTeamDraftBadge(
  status: DraftStatus | null,
  teamId: string
): "clock" | "deck" | null {
  if (!status) return null;
  if (status.onTheClock.teamId === teamId) return "clock";
  if (status.onDeck.teamId === teamId) return "deck";
  return null;
}
