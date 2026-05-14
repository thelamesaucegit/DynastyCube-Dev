// src/app/components/vote/RepublicVoteCard.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { castVote, getPollResultsByType } from "@/app/actions/voteActions";
import type { PollWithOptions, TypedPollResults } from "@/app/actions/voteActions";
import { LeagueResults } from "./LeagueResults";
import { Clock, CheckCircle2, Vote, Loader2, AlertCircle } from "lucide-react";

interface RepublicVoteCardProps {
  poll: PollWithOptions;
  userId: string;
  onVoteSubmit: () => void;
}

export function RepublicVoteCard({ poll, userId, onVoteSubmit }: RepublicVoteCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.userVotes || []);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TypedPollResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  
  const isEnded = poll.status === "ended";
  const hasVoted = poll.hasVoted || false;
  
  // If the poll has ended, fetch the detailed results
  useEffect(() => {
    if (isEnded) {
      loadResults();
    }
  }, [isEnded, poll.id]);
  
  const loadResults = async () => {
    setLoadingResults(true);
    const res = await getPollResultsByType(poll.id);
    if (res.success && res.results) {
      setResults(res.results);
    }
    setLoadingResults(false);
  };
  
  const handleOptionToggle = (optionId: string) => {
    if (isEnded || hasVoted) return;
    if (poll.allow_multiple_votes) {
      setSelectedOptions((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };
  
  const handleVote = async () => {
    if (selectedOptions.length === 0) return;
    setVoting(true);
    setError(null);
    
    const result = await castVote(poll.id, selectedOptions, userId);
    if (result.success) {
      onVoteSubmit();
    } else {
      setError(result.error || "Failed to cast vote");
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
    <Card className="transition-all hover:shadow-sm border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                League Republic
              </Badge>
              {isEnded ? (
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
            {isEnded ? "Ended" : "Ends"} {formatDate(poll.ends_at)}
          </span>
          {poll.allow_multiple_votes && (
            <span className="flex items-center gap-1 font-medium text-primary">
              Multi-select
            </span>
          )}
          {hasVoted && !isEnded && (
            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Vote Recorded
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}
        
        {isEnded ? (
          // --- SHOW RESULTS ONLY IF POLL IS ENDED ---
          loadingResults ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-8 animate-spin mb-2" />
              <p className="text-sm">Calculating League Results...</p>
            </div>
          ) : results ? (
            <div className="mt-2 animate-in fade-in duration-500">
              <LeagueResults 
                leagueResult={results.league_result || null} 
                teamResults={results.team_results || []} 
                allOptions={results.all_options || []} 
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Results unavailable.</p>
          )
        ) : (
          // --- BLIND VOTING INTERFACE IF ACTIVE ---
          <div className="space-y-6">
            {!hasVoted && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 mb-4">
                <strong>Blind Voting Active:</strong> You will not see vote counts or team consensus until the poll has officially ended.
              </div>
            )}
            
            <div className="space-y-3">
              {poll.options.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                const isVotedFor = poll.userVotes?.includes(option.id);
                const activelySelected = isSelected || isVotedFor;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionToggle(option.id)}
                    disabled={hasVoted}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      activelySelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/50"
                    } ${hasVoted ? "cursor-default opacity-90" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        activelySelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {activelySelected && <CheckCircle2 className="size-4 text-primary-foreground" />}
                      </div>
                      <span className={`font-medium text-base ${activelySelected ? "text-primary" : "text-foreground"}`}>
                        {option.option_text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {!hasVoted && (
              <Button 
                onClick={handleVote} 
                disabled={selectedOptions.length === 0 || voting}
                className="w-full sm:w-auto mt-2"
                size="lg"
              >
                {voting ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><Vote className="size-4 mr-2" /> Cast Blind Vote</>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
