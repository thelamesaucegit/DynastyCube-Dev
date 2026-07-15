// src/app/components/vote/BlessingsAllocator.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { castVote, getBlessingClientData } from "@/app/actions/voteActions";
import { getTeamsWithDetails, type TeamWithDetails } from "@/app/actions/teamActions"; 
import type { PollWithOptions } from "@/app/actions/voteActions";
import { Clock, Check, X, Loader2, AlertCircle, Dices, Trophy, CheckCircle2 } from "lucide-react";

interface BlessingsAllocatorProps {
  poll: PollWithOptions;
  userId: string;
  onVoteSubmit: () => void;
}

interface TeamInfo {
  id: string;
  name: string;
  emoji: string;
}

export function BlessingsAllocator({ poll, userId, onVoteSubmit }: BlessingsAllocatorProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.userVotes || []);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // States for live and resolved data
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [globalAllocations, setGlobalAllocations] = useState<Record<string, Record<string, number>>>({});
  const [winners, setWinners] = useState<Record<string, { id: string, name: string, emoji: string } | null>>({});
  const [resolvedOdds, setResolvedOdds] = useState<Record<string, { roll: number, odds: Record<string, number> }>>({});
  const [isResolved, setIsResolved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const isEnded = poll.status === "ended";

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    const [blessingRes, teamsRes] = await Promise.all([
      getBlessingClientData(poll.id),
      getTeamsWithDetails(false) // Fetch active teams
    ]);

    if (teamsRes.teams) {
      setTeams(teamsRes.teams.map((t: TeamWithDetails) => ({ id: t.id, name: t.name, emoji: t.emoji })));
    }

    if (blessingRes.success) {
      setGlobalAllocations(blessingRes.globalAllocations || {});
      setWinners(blessingRes.winners || {});
      setResolvedOdds(blessingRes.resolvedOdds || {});
      setIsResolved(blessingRes.isResolved || false);
    }
    setLoadingData(false);
  }, [poll.id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleToggle = (optionId: string, isYes: boolean) => {
    if (isEnded || isResolved) return;
    setSelectedOptions((prev) => isYes ? [...new Set([...prev, optionId])] : prev.filter((id) => id !== optionId));
  };

  const handleVote = async () => {
    setVoting(true);
    setError(null);
    const result = await castVote(poll.id, selectedOptions, userId);
    if (result.success) {
      onVoteSubmit();
    } else {
      setError(result.error || "Failed to submit allocations");
    }
    setVoting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
    });
  };

  // Helper to calculate odds using the "90 virtual votes" model
  const calculateOddsForOption = (optionId: string, teamId: string) => {
    const allocationsForOption = globalAllocations[optionId] || {};
    
    // Total actual "Yes" votes cast by all teams for this specific blessing
    const totalOptionYes = Object.values(allocationsForOption).reduce((sum, count) => sum + count, 0);
    const teamVotesForOption = allocationsForOption[teamId] || 0;

    const virtualVotes = 90;
    const basePityOdds = 1.0;
    
    // Value of a single "Yes" vote = 100 / (90 + total option yes)
    const voteValue = 100.0 / (virtualVotes + totalOptionYes);
    const odds = basePityOdds + (teamVotesForOption * voteValue);
    
    return {
      votes: teamVotesForOption,
      odds: parseFloat(odds.toFixed(1))
    };
  };

  return (
    <Card className="transition-all border-purple-200 dark:border-purple-900 shadow-lg">
      <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                <Dices className="size-3 mr-1" /> Team Blessings
              </Badge>
              {isResolved ? (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Resolved</Badge>
              ) : isEnded ? (
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Voting Completed</Badge>
              ) : (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
              )}
            </div>
            <CardTitle className="text-xl font-bold leading-tight">{poll.title}</CardTitle>
            {poll.description && <p className="text-sm text-muted-foreground mt-2">{poll.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{isEnded || isResolved ? "Ended" : "Ends"} {formatDate(poll.ends_at)}</span>
          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">Weighted Lottery</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4"><AlertCircle className="size-4 shrink-0" />{error}</div>}

        {loadingData ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="size-8 animate-spin text-purple-500 mb-3" />
            <p className="text-sm text-muted-foreground">Consulting the Fates...</p>
          </div>
        ) : isResolved ? (
          // ===================================================================
          // STATE B: VOTING CLOSED & LOTTERY IS RESOLVED
          // ===================================================================
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="p-4 text-center border-2 border-purple-200 dark:border-purple-800 rounded-lg bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 mb-6 shadow-sm">
              <Trophy className="size-8 mx-auto mb-2 text-yellow-500" />
              <h3 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-1">Lottery Resolved!</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">The Fates have spoken. The following blessings were bestowed.</p>
            </div>
            
            <div className="space-y-6">
              {poll.options.map((option) => {
                const winner = winners[option.id];
                const rOdds = resolvedOdds[option.id];
                
                return (
                  <div key={option.id} className="border border-border rounded-xl p-4 bg-card shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center pb-3 border-b border-border/50">
                      <span className="font-bold text-md text-foreground text-center sm:text-left mb-2 sm:mb-0">
                        {option.option_text}
                      </span>
                      {rOdds && (
                        <div className="text-xs bg-muted border px-2.5 py-1 rounded-md font-mono text-muted-foreground">
                          Roll: <span className="font-bold text-primary">{rOdds.roll.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 bg-slate-950/40 border border-purple-500/10 rounded-lg p-3 shadow-inner">
                      <Trophy className="size-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Winner</div>
                        <div className="font-bold text-md leading-none">
                          {winner ? (
                            <><span className="mr-1.5 text-xl">{winner.emoji}</span> {winner.name}</>
                          ) : (
                            <span className="text-muted-foreground italic">The Fates Denied</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Odds at time of roll</h5>
                      <div className="flex flex-wrap gap-2">
                        {rOdds && Object.entries(rOdds.odds).length > 0 ? (
                          Object.entries(rOdds.odds).map(([teamId, odds]) => {
                            const teamInfo = teams.find(t => t.id === teamId);
                            const isWinner = winner?.id === teamId;
                            return (
                              <div 
                                key={teamId} 
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                                  isWinner 
                                    ? "bg-purple-100 border-purple-300 dark:bg-purple-900/40 dark:border-purple-600 font-medium" 
                                    : "bg-background border-border text-muted-foreground"
                                }`}
                              >
                                <span>{teamInfo?.emoji} {odds}%</span>
                                {isWinner && <CheckCircle2 className="size-3 text-purple-600 dark:text-purple-400" />}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No eligible teams remained.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isEnded ? (
          // ===================================================================
          // STATE A: VOTING CLOSED, BUT LOTTERY IS NOT YET RESOLVED
          // ===================================================================
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="p-4 text-center border-2 border-purple-200 dark:border-purple-800 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 mb-6 shadow-sm">
              <Dices className="size-8 mx-auto mb-2 text-purple-500 animate-pulse" />
              <h3 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-1">Voting Concluded</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">Lottery pool is sealed. Final percentages are established below.</p>
            </div>
            
            <div className="space-y-4">
              {poll.options.map((option) => (
                <div key={option.id} className="border border-border rounded-xl p-4 bg-card shadow-sm space-y-3">
                  <div className="font-bold text-md text-foreground border-b pb-2">
                    {option.option_text}
                  </div>
                  
                  <div className="space-y-2">
                    {teams.map(team => {
                      const stats = calculateOddsForOption(option.id, team.id);
                      return (
                        <div key={team.id} className={`flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border text-xs`}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{team.emoji}</span>
                            <span className="font-medium text-foreground">{team.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{stats.votes} {stats.votes === 1 ? 'vote' : 'votes'}</span>
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800 px-2 py-0.5 font-bold">
                              {stats.odds}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ===================================================================
          // STATE C: ACTIVE VOTING STAGE (Odds are hidden during draft)
          // ===================================================================
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-sm text-purple-800 dark:text-purple-200 mb-4">
              <strong>How it works:</strong> Vote &quot;Yes&quot; for the blessings your Team wants. Each vote increases your Team&apos;s odds! Final odds will be displayed here as soon as voting concludes.
            </div>
            
            <div className="space-y-3">
              {poll.options.map((option) => {
                const isYes = selectedOptions.includes(option.id);
                return (
                  <div key={option.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border-2 border-border bg-card transition-all hover:border-purple-500/30">
                    <div className="flex-1">
                      <span className="font-medium text-base text-foreground block">
                        {option.option_text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggle(option.id, true)} disabled={voting} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isYes ? "bg-green-600 text-white shadow-md scale-105" : "bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-600"}`}><Check className="size-4" /> Yes</button>
                      <button onClick={() => handleToggle(option.id, false)} disabled={voting} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${!isYes ? "bg-red-600 text-white shadow-md scale-105" : "bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-600"}`}><X className="size-4" /> No</button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t border-border">
              <Button onClick={handleVote} disabled={voting} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white" size="lg">
                {voting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</> : <><Dices className="size-4 mr-2" /> Save Allocations</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
