// src/app/components/DraftStatusWidget.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getDraftStatus, type DraftStatus } from "@/app/actions/draftOrderActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Clock, ChevronRight } from "lucide-react";

interface DraftStatusWidgetProps {
  variant: "full" | "compact" | "team";
  teamId?: string;
}

export function DraftStatusWidget({ variant, teamId }: DraftStatusWidgetProps) {
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const result = await getDraftStatus();
      setStatus(result.status);
    } catch (error) {
      console.error("Error loading draft status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !status) return null;

  if (variant === "full") return <FullWidget status={status} />;
  if (variant === "compact") return <CompactWidget status={status} />;
  return <TeamWidget status={status} teamId={teamId || ""} />;
}

// ============================================================================
// FULL VARIANT (Homepage)
// ============================================================================

function FullWidget({ status }: { status: DraftStatus }) {
  return (
    <section>
      <Card className="border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-5 text-amber-500" />
            <h2 className="text-lg font-bold">Draft Status</h2>
            <Badge variant="secondary" className="text-xs ml-auto">
              {status.seasonName}
            </Badge>
          </div>

          {/* On the Clock & On Deck */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {/* On the Clock */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">
                On the Clock
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{status.onTheClock.teamEmoji}</span>
                <div>
                  <div className="text-xl font-bold">{status.onTheClock.teamName}</div>
                  <div className="text-sm text-muted-foreground">
                    Pick #{status.onTheClock.pickPosition} &middot; Round {status.currentRound}
                  </div>
                </div>
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
              <span>Round {status.currentRound} Progress</span>
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

function CompactWidget({ status }: { status: DraftStatus }) {
  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 mb-6">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
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

          <Badge variant="outline" className="text-xs ml-auto">
            Round {status.currentRound}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TEAM VARIANT (Team Detail Page)
// ============================================================================

function TeamWidget({ status, teamId }: { status: DraftStatus; teamId: string }) {
  const isOnClock = status.onTheClock.teamId === teamId;
  const isOnDeck = status.onDeck.teamId === teamId;
  const teamEntry = status.draftOrder.find((t) => t.teamId === teamId);

  if (!teamEntry) return null;

  return (
    <Card
      className={`mb-6 border-2 ${
        isOnClock
          ? "border-green-500/40 bg-green-500/5"
          : isOnDeck
            ? "border-yellow-500/40 bg-yellow-500/5"
            : "border-border"
      }`}
    >
      <CardContent className="py-4 px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Team Status */}
          <div className="flex items-center gap-2">
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

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground ml-auto">
            <span>Pick #{teamEntry.pickPosition}</span>
            <span className="text-muted-foreground/40">|</span>
            <span>Round {status.currentRound}</span>
            <span className="text-muted-foreground/40">|</span>
            <span>{teamEntry.picksMade} picks made</span>
          </div>

          {/* Who's picking if not this team */}
          {!isOnClock && (
            <div className="w-full flex items-center gap-2 text-sm pt-1 border-t border-border/50 mt-1">
              <span className="text-muted-foreground">On the clock:</span>
              <span className="font-medium">{status.onTheClock.teamEmoji} {status.onTheClock.teamName}</span>
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
