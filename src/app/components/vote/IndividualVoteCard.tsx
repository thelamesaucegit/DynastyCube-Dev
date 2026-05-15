// src/app/components/vote/IndividualVoteCard.tsx
"use client";

import React, { useState } from "react";
import { type PollWithOptions, castVote } from "@/app/actions/voteActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, CheckCircle2, Clock, Users } from "lucide-react";

interface IndividualVoteCardProps {
  poll: PollWithOptions;
  userId: string;
  onVoteSubmit: () => void;
}

export function IndividualVoteCard({ poll, userId, onVoteSubmit }: IndividualVoteCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const endsAt = new Date(poll.ends_at);
  const isEnded = endsAt < now;
  
  // Use the exact property names from your PollWithOptions type
  const hasVoted = poll.hasVoted || (poll.userVotes && poll.userVotes.length > 0);
  
  // Determine if we should show results instead of the voting form
  const shouldShowResults = hasVoted || isEnded || poll.show_results_before_end;

  const handleOptionToggle = (optionId: string) => {
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

  const handleVoteSubmit = async () => {
    if (selectedOptions.length === 0) {
      setError("Please select at least one option.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Use castVote with the correct parameter order: pollId, optionIds, userId
      const result = await castVote(poll.id, selectedOptions, userId);
      
      if (result.success) {
        onVoteSubmit(); // Triggers a reload of polls in the parent page
      } else {
        setError(result.error || "Failed to submit vote. Please try again.");
      }
    } catch (err) {
      console.error("Vote submission error:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold">{poll.title}</h3>
              {isEnded ? (
                <Badge variant="secondary">Ended</Badge>
              ) : hasVoted ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">Voted</Badge>
              ) : null}
            </div>
            {poll.description && (
              <p className="text-muted-foreground">{poll.description}</p>
            )}
          </div>
          
          <div className="flex flex-col text-sm text-muted-foreground gap-1 shrink-0">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> 
              {isEnded ? "Ended " : "Ends "} {formatDate(endsAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> 
              {poll.total_votes} total votes
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3 mt-6">
          {poll.options.map((option) => {
            // Calculate the percentage
            const percentage = poll.total_votes > 0 
              ? Math.round(((option.vote_count || 0) / poll.total_votes) * 100) 
              : 0;
            
            // Check if this is the option the user voted for using userVotes array
            const isUserSelection = poll.userVotes?.includes(option.id);

            if (shouldShowResults) {
              return (
                <div key={option.id} className="relative w-full border border-border rounded-lg p-4 overflow-hidden">
                  {/* Progress Bar Background */}
                  <div 
                    className="absolute inset-0 bg-primary/10 transition-all duration-500 ease-in-out" 
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative flex justify-between items-center z-10">
                    <div className="flex items-center gap-2 font-medium">
                      {option.option_text}
                      {isUserSelection && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="text-sm font-semibold">
                      {option.vote_count || 0} votes ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            }

            // Otherwise, show the voting inputs
            return (
              <label 
                key={option.id} 
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                  ${selectedOptions.includes(option.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'}`}
              >
                <input
                  type={poll.allow_multiple_votes ? "checkbox" : "radio"}
                  name={`poll-${poll.id}`}
                  checked={selectedOptions.includes(option.id)}
                  onChange={() => handleOptionToggle(option.id)}
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">{option.option_text}</span>
              </label>
            );
          })}
        </div>

        {!shouldShowResults && !isEnded && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {poll.allow_multiple_votes ? "Select all that apply" : "Select one option"}
            </p>
            <button
              onClick={handleVoteSubmit}
              disabled={isSubmitting || selectedOptions.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
