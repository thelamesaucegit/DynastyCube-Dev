"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { castVote, removeVote, getPollResults } from "@/app/actions/voteActions";
import type { PollWithOptions, PollResult } from "@/app/actions/voteActions";
import {
  Clock,
  CheckCircle2,
  Trash2,
  BarChart3,
  Vote,
  XCircle,
  Loader2,
} from "lucide-react";

interface TeamPollCardProps {
  poll: PollWithOptions;
  userId: string;
  isCaptain: boolean;
  onVoteSubmit: () => void;
  onDelete: (pollId: string) => void;
}

export function TeamPollCard({
  poll,
  userId,
  isCaptain,
  onVoteSubmit,
  onDelete,
}: TeamPollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    poll.userVotes || []
  );
  const [voting, setVoting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [results, setResults] = useState<PollResult[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnded = poll.status === "ended";
  const isUpcoming = poll.status === "upcoming";
  const hasVoted = poll.hasVoted || false;
  const canVote = !isEnded && !isUpcoming;
  const canSeeResults =
    isEnded || (poll.show_results_before_end && hasVoted);

  const getStatusBadge = () => {
    switch (poll.status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>;
      case "ended":
        return <Badge variant="secondary">Ended</Badge>;
      case "upcoming":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Upcoming</Badge>;
      default:
        return null;
    }
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const endsAt = new Date(poll.ends_at);
    const diff = endsAt.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const handleOptionToggle = (optionId: string) => {
    if (!canVote || hasVoted) return;

    if (poll.allow_multiple_votes) {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
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

  const handleRemoveVote = async () => {
    setRemoving(true);
    setError(null);

    const result = await removeVote(poll.id, userId);

    if (result.success) {
      setSelectedOptions([]);
      setResults(null);
      setShowResults(false);
      onVoteSubmit();
    } else {
      setError(result.error || "Failed to remove vote");
    }

    setRemoving(false);
  };

  const handleShowResults = async () => {
    if (results) {
      setShowResults(!showResults);
      return;
    }

    setLoadingResults(true);
    const { results: pollResults, success } = await getPollResults(poll.id);

    if (success && pollResults) {
      setResults(pollResults);
      setShowResults(true);
    }

    setLoadingResults(false);
  };

  const totalVoteCount = results?.reduce((sum, r) => sum + r.vote_count, 0) || 0;

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight">
              {poll.title}
            </CardTitle>
            {poll.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {poll.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {getStatusBadge()}
            {isCaptain && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 p-0"
                onClick={() => onDelete(poll.id)}
                title="Delete poll"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {getTimeRemaining()}
          </span>
          <span className="flex items-center gap-1">
            <Vote className="size-3" />
            {poll.total_votes} vote{poll.total_votes !== 1 ? "s" : ""}
          </span>
          {poll.allow_multiple_votes && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Multi-select
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2 mb-3">
            <XCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Voting Options */}
        <div className="space-y-2">
          {poll.options.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            const isVotedFor = poll.userVotes?.includes(option.id);
            const result = results?.find((r) => r.option_id === option.id);

            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => handleOptionToggle(option.id)}
                  disabled={!canVote || hasVoted}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-md border text-sm transition-all
                    ${
                      isSelected || isVotedFor
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/30"
                    }
                    ${(!canVote || hasVoted) ? "cursor-default" : "cursor-pointer"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {(isSelected || isVotedFor) && (
                        <CheckCircle2 className="size-4 text-primary shrink-0" />
                      )}
                      {option.option_text}
                    </span>
                    {showResults && result && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {result.vote_count} ({result.percentage}%)
                      </span>
                    )}
                  </div>

                  {/* Results progress bar */}
                  {showResults && result && (
                    <Progress
                      value={result.percentage}
                      className="h-1 mt-2"
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          {canVote && !hasVoted && (
            <Button
              onClick={handleVote}
              disabled={selectedOptions.length === 0 || voting}
              size="sm"
            >
              {voting ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Voting...
                </>
              ) : (
                <>
                  <Vote className="size-4 mr-1" />
                  Submit Vote
                </>
              )}
            </Button>
          )}

          {canVote && hasVoted && (
            <Button
              onClick={handleRemoveVote}
              variant="outline"
              size="sm"
              disabled={removing}
            >
              {removing ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Removing...
                </>
              ) : (
                "Change Vote"
              )}
            </Button>
          )}

          {canSeeResults && (
            <Button
              onClick={handleShowResults}
              variant="ghost"
              size="sm"
              disabled={loadingResults}
            >
              {loadingResults ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <BarChart3 className="size-4 mr-1" />
              )}
              {showResults ? "Hide Results" : "Show Results"}
            </Button>
          )}
        </div>

        {/* Total vote summary when showing results */}
        {showResults && results && (
          <p className="text-xs text-muted-foreground mt-2">
            Total: {totalVoteCount} vote{totalVoteCount !== 1 ? "s" : ""} cast
          </p>
        )}
      </CardContent>
    </Card>
  );
}
