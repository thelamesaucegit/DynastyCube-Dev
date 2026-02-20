// src/app/vote/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActivePolls,
  getPollWithOptions,
  getPollResultsByType,
  castVote,
  type PollWithOptions,
  type TypedPollResults,
} from "@/app/actions/voteActions";
import { TeamResults } from "@/components/vote/TeamResults";
import { LeagueResults } from "@/components/vote/LeagueResults";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { Loader2, Vote, Clock, BarChart3, Check, AlertCircle, ChevronRight, Lock } from "lucide-react";

export default function VotePage() {
  const { user, loading: authLoading } = useAuth();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoll, setSelectedPoll] = useState<PollWithOptions | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<TypedPollResults | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      loadPolls();
    } else if (!authLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const result = await getActivePolls(user?.id);
      if (result.success && result.polls) {
        setPolls(result.polls as PollWithOptions[]);
      }
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPoll = async (poll: PollWithOptions) => {
    setShowResults(false);
    setResults(null);
    setSelectedPoll(null); // Clear selection while loading

    // Load full poll details with options
    const result = await getPollWithOptions(poll.id, user?.id);
    if (result.success && result.poll) {
      setSelectedPoll(result.poll);
      setSelectedOptions(result.poll.userVotes || []);
    }
  };

  const handleToggleOption = (optionId: string) => {
    if (!selectedPoll) return;

    if (selectedPoll.allow_multiple_votes) {
      // Toggle option in array
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single selection only
      setSelectedOptions([optionId]);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedPoll || !user || selectedOptions.length === 0) return;

    setSubmitting(true);
    try {
      const result = await castVote(selectedPoll.id, selectedOptions, user.id);
      if (result.success) {
        alert("\u2705 " + result.message);
        // Reload polls and poll details
        await loadPolls();
        const updatedPoll = await getPollWithOptions(selectedPoll.id, user.id);
        if (updatedPoll.success && updatedPoll.poll) {
          setSelectedPoll(updatedPoll.poll);
          setSelectedOptions(updatedPoll.poll.userVotes || []);
        }
      } else {
        alert("\u274C " + result.error);
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("\u274C Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShowResults = async () => {
    if (!selectedPoll) return;

    const result = await getPollResultsByType(selectedPoll.id);
    if (result.success && result.results) {
      setResults(result.results);
      setShowResults(true);
    } else {
      alert("Failed to load results");
    }
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

  const getPollStatus = (poll: PollWithOptions) => {
    const now = new Date();
    const endsAt = new Date(poll.ends_at);
    const startsAt = new Date(poll.starts_at);

    if (endsAt < now) return { label: "Ended", color: "gray" };
    if (startsAt > now) return { label: "Upcoming", color: "blue" };
    return { label: "Active", color: "green" };
  };

  if (authLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Sign In Required
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              You must be signed in to access the voting system.
            </p>
            <p className="text-muted-foreground mb-8">
              Please use the &quot;Sign in with Discord&quot; button in the navigation menu to continue.
            </p>
            <div className="mt-8 max-w-md mx-auto">
              <p className="font-bold mb-4">Why sign in?</p>
              <ul className="text-left space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Vote on cube changes and additions</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Participate in league decisions</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Access member-only features</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Track your voting history</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Community Voting
        </h1>
        <p className="text-muted-foreground text-lg">
          Vote on cube changes, card additions, and league decisions
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading polls...</p>
          </CardContent>
        </Card>
      ) : polls.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">
              No Active Polls
            </h3>
            <p className="text-muted-foreground">
              There are no polls available at the moment. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Poll List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Active Polls ({polls.length})
            </h2>
            {polls.map((poll) => {
              const status = getPollStatus(poll);
              const isSelected = selectedPoll?.id === poll.id;

              return (
                <Card
                  key={poll.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "border-primary ring-1 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectPoll(poll)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="font-bold flex-1 text-sm">
                        {poll.title}
                      </h3>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            status.color === "green"
                              ? "default"
                              : status.color === "blue"
                              ? "secondary"
                              : "outline"
                          }
                          className={status.color === "green" ? "bg-emerald-600" : ""}
                        >
                          {status.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-center"
                        >
                          {poll.vote_type === "individual" && "Individual"}
                          {poll.vote_type === "team" && "Team"}
                          {poll.vote_type === "league" && "League"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        {poll.total_votes} votes
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Ends {formatDate(poll.ends_at)}
                      </p>
                      {poll.hasVoted && (
                        <p className="text-emerald-500 font-semibold flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" />
                          You voted
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Poll Details */}
          <div className="lg:col-span-2">
            {!selectedPoll ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ChevronRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">
                    Select a Poll
                  </h3>
                  <p className="text-muted-foreground">
                    Choose a poll from the list to view details and cast your vote
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                {/* Poll Header */}
                <CardHeader>
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-2xl">
                      {selectedPoll.title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                    >
                      {selectedPoll.vote_type === "individual" && "Individual Vote"}
                      {selectedPoll.vote_type === "team" && "Team Vote"}
                      {selectedPoll.vote_type === "league" && "League Vote"}
                    </Badge>
                  </div>
                  {selectedPoll.description && (
                    <CardDescription className="text-base">
                      {selectedPoll.description}
                    </CardDescription>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Ends: {formatDate(selectedPoll.ends_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {selectedPoll.total_votes} total votes
                    </span>
                    {selectedPoll.allow_multiple_votes && (
                      <span className="text-primary flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Multiple selections allowed
                      </span>
                    )}
                  </div>

                  {/* Vote weight info for league polls */}
                  {selectedPoll.vote_type === "league" && selectedPoll.userVoteWeight && (
                    <div className="mt-3 p-3 bg-accent rounded-lg">
                      <p className="text-sm">
                        <span className="font-bold">Your vote counts as {selectedPoll.userVoteWeight}x</span>
                        {selectedPoll.userVoteWeight === 3 && " (Captain)"}
                        {selectedPoll.userVoteWeight === 2 && " (Pilot/Broker)"}
                        {selectedPoll.userVoteWeight === 1 && " (Standard)"}
                      </p>
                    </div>
                  )}

                  {/* Team requirement warning */}
                  {(selectedPoll.vote_type === "team" || selectedPoll.vote_type === "league") &&
                    !selectedPoll.userTeamId && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          You must be on a team to vote in this poll.
                        </p>
                      </div>
                    )}
                </CardHeader>

                <CardContent>
                  {/* Voting Interface */}
                  {!showResults && selectedPoll.options && (
                    <div className="space-y-3 mb-6">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        {selectedPoll.allow_multiple_votes
                          ? "Select your choices:"
                          : "Select your choice:"}
                      </h3>
                      {selectedPoll.options.map((option) => {
                        const isSelected = selectedOptions.includes(option.id);
                        const isPollEnded = new Date(selectedPoll.ends_at) < new Date();

                        return (
                          <button
                            key={option.id}
                            onClick={() => !isPollEnded && handleToggleOption(option.id)}
                            disabled={isPollEnded}
                            className={`w-full p-4 rounded-lg border text-left transition-all ${
                              isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-muted/50 border-border hover:border-primary/50"
                            } ${isPollEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/30"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>
                              <span className="font-medium">
                                {option.option_text}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Results Display */}
                  {showResults && results && (
                    <div className="space-y-4 mb-6">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Results
                      </h3>

                      {/* Individual Results */}
                      {results.type === "individual" && results.results && (
                        <div className="space-y-4">
                          {results.results.map((result) => (
                            <div key={result.option_id} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">
                                  {result.option_text}
                                </span>
                                <span className="text-muted-foreground">
                                  {result.vote_count} votes ({result.percentage}%)
                                </span>
                              </div>
                              <Progress value={result.percentage} className="h-3" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Team Results */}
                      {results.type === "team" && results.team_results && (
                        <TeamResults teamResults={results.team_results} />
                      )}

                      {/* League Results */}
                      {results.type === "league" && (
                        <LeagueResults
                          leagueResult={results.league_result || null}
                          teamResults={results.team_results || []}
                          allOptions={results.all_options || []}
                        />
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {!showResults && new Date(selectedPoll.ends_at) > new Date() && (
                      <Button
                        onClick={handleSubmitVote}
                        disabled={selectedOptions.length === 0 || submitting}
                        className="flex-1"
                        size="lg"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Vote"
                        )}
                      </Button>
                    )}
                    {(selectedPoll.show_results_before_end ||
                      new Date(selectedPoll.ends_at) < new Date()) && (
                      <Button
                        onClick={showResults ? () => setShowResults(false) : handleShowResults}
                        variant="secondary"
                        className="flex-1"
                        size="lg"
                      >
                        {showResults ? "Hide Results" : "Show Results"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
