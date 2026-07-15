// src/app/components/vote/BlessingsAllocator.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { castVote, getBlessingClientData } from "@/app/actions/voteActions";
import type { PollWithOptions } from "@/app/actions/voteActions";
import { Clock, Check, X, Loader2, AlertCircle, Sparkles, Trophy } from "lucide-react";

interface BlessingsAllocatorProps {
  poll: PollWithOptions;
  userId: string;
  onVoteSubmit: () => void;
}

export function BlessingsAllocator({ poll, userId, onVoteSubmit }: BlessingsAllocatorProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.userVotes || []);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New States for Live/Resolved Data
  const [teamVotes, setTeamVotes] = useState<Record<string, number>>({});
  const [winners, setWinners] = useState<Record<string, { id: string, name: string, emoji: string } | null>>({});
  const [isResolved, setIsResolved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const isEnded = poll.status === "ended";

  const loadExtraData = useCallback(async () => {
    setLoadingData(true);
    const res = await getBlessingClientData(poll.id);
    if (res.success) {
      setTeamVotes(res.teamVotes || {});
      setWinners(res.winners || {});
      setIsResolved(res.isResolved || false);
    }
    setLoadingData(false);
  }, [poll.id]);

  // Fetch live allocations/results on mount, and whenever userVotes change (i.e. after a successful submission)
  useEffect(() => {
    loadExtraData();
  }, [loadExtraData, poll.userVotes]);

  const handleToggle = (optionId: string, isYes: boolean) => {
    if (isEnded || isResolved) return;
    
    setSelectedOptions((prev) => {
      if (isYes) {
        return prev.includes(optionId) ? prev : [...prev, optionId];
      } else {
        return prev.filter((id) => id !== optionId);
      }
    });
  };

  const handleVote = async () => {
    setVoting(true);
    setError(null);
    
    const result = await castVote(poll.id, selectedOptions, userId);
    
    if (result.success) {
      onVoteSubmit(); // Triggers parent reload
    } else {
      setError(result.error || "Failed to submit allocations");
    }
    setVoting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card className="transition-all hover:shadow-sm border-purple-200 dark:border-purple-900">
      <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                <Sparkles className="size-3 mr-1" /> Team Blessings
              </Badge>
              {isResolved ? (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Resolved</Badge>
              ) : isEnded ? (
                <Badge variant="secondary">Ended</Badge>
              ) : (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
              )}
            </div>
            <CardTitle className="text-xl font-bold leading-tight">
              {poll.title}
            </CardTitle>
            {poll.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {poll.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> 
            {isEnded || isResolved ? "Ended" : "Ends"} {formatDate(poll.ends_at)}
          </span>
          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
            Weighted Lottery
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {loadingData ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="size-8 animate-spin text-purple-500 mb-3" />
            <p className="text-sm text-muted-foreground">Consulting the Fates...</p>
          </div>
        ) : isResolved ? (
          // --- THE RESULTS VIEW ---
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="p-4 text-center border-2 border-purple-200 dark:border-purple-800 rounded-lg bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 mb-6">
              <Trophy className="size-8 mx-auto mb-2 text-yellow-500" />
              <h3 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-1">Lottery Resolved!</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">The Fates have spoken. Here are the teams that received blessings.</p>
            </div>
            
            <div className="space-y-3">
              {poll.options.map((option) => {
                const winner = winners[option.id];
                return (
                  <div key={option.id} className="flex flex-col sm:flex-row justify-between items-center p-4 border rounded-lg bg-card shadow-sm">
                    <span className="font-semibold text-foreground text-center sm:text-left mb-2 sm:mb-0">
                      {option.option_text}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {winner ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700 px-3 py-1.5 text-sm shadow-sm">
                          <span className="mr-2 text-lg">{winner.emoji}</span> {winner.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground px-3 py-1.5 text-sm border-dashed">
                          The Fates Denied
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isEnded ? (
          // --- THE PENDING RESOLUTION VIEW ---
          <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-muted/30">
            <Sparkles className="size-8 mx-auto mb-3 text-purple-500 opacity-50" />
            <h3 className="font-semibold text-lg mb-1">Lottery Concluded</h3>
            <p className="text-sm text-muted-foreground">Voting has ended. Awaiting the official resolution of the lottery...</p>
          </div>
        ) : (
          // --- THE ACTIVE VOTING VIEW ---
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-sm text-purple-800 dark:text-purple-200 mb-4">
              <strong>How it works:</strong> Vote &quot;Yes&quot; for the blessings your team wants. Your team&apos;s odds for each blessing increase based on the proportion of Yes votes your team pools together!
            </div>
            
            <div className="space-y-3">
              {poll.options.map((option) => {
                const isYes = selectedOptions.includes(option.id);
                const teamVoteCount = teamVotes[option.id] || 0;
                
                return (
                  <div key={option.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border-2 border-border bg-card transition-all hover:border-purple-500/30">
                    <div className="flex-1">
                      <span className="font-medium text-base text-foreground block mb-1.5">
                        {option.option_text}
                      </span>
                      {/* --- THE FIX: Display team allocations --- */}
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50">
                        {teamVoteCount} Team {teamVoteCount === 1 ? 'Vote' : 'Votes'} Allocated
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(option.id, true)}
                        disabled={voting}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                          isYes 
                            ? "bg-green-600 text-white shadow-md scale-105" 
                            : "bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-600"
                        }`}
                      >
                        <Check className="size-4" /> Yes
                      </button>
                      
                      <button
                        onClick={() => handleToggle(option.id, false)}
                        disabled={voting}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                          !isYes 
                            ? "bg-red-600 text-white shadow-md scale-105" 
                            : "bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-600"
                        }`}
                      >
                        <X className="size-4" /> No
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t border-border">
              <Button 
                onClick={handleVote} 
                disabled={voting}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {voting ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Saving Allocations...</>
                ) : (
                  <><Sparkles className="size-4 mr-2" /> Save Allocations</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
