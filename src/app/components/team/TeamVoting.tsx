// /src/app/components/team/TeamVoting.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getTeamPolls, deleteTeamPoll, getVotingContext } from "@/app/actions/voteActions";
import type { PollWithOptions } from "@/app/actions/voteActions";
import { TeamPollCard } from "./TeamPollCard";
import { CreateTeamPollDialog } from "./CreateTeamPollDialog";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Vote, Loader2, AlertCircle } from "lucide-react";
import { DayNightGrid } from "@/app/components/vote/DayNightGrid";

interface TeamVotingProps {
  teamId: string;
  userRoles: string[];
}

// THE FIX: Define a strict type for the context
interface SeasonContext {
  seasonId: string | null;
  isPostseason: boolean;
}

export function TeamVoting({ teamId, userRoles }: TeamVotingProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // THE FIX: Use the strict type for state
  const [seasonContext, setSeasonContext] = useState<SeasonContext>({ 
    seasonId: null, 
    isPostseason: false 
  });
  
  const isCaptain = userRoles.includes("captain");
  const userId = user?.id || "";

  // THE FIX: Wrap loadPolls in useCallback
  const loadPolls = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    
    const [result, contextResult] = await Promise.all([
        getTeamPolls(teamId, userId),
        getVotingContext()
    ]);

    if (result.success) {
      setPolls(result.polls);
    } else {
      setError(result.error || "Failed to load polls");
    }
    
    if (contextResult.success) {
        // THE FIX: No 'as any' needed
        setSeasonContext({
            seasonId: contextResult.seasonId,
            isPostseason: contextResult.isPostseason
        });
    }

    setLoading(false);
  }, [teamId, userId]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]); // THE FIX: Add loadPolls to dependency array

  const handleDelete = async (pollId: string) => {
    if (!userId) return;
    const confirmed = window.confirm("Are you sure you want to delete this poll? All votes will be permanently removed.");
    if (!confirmed) return;
    const result = await deleteTeamPoll(pollId, teamId, userId);
    if (result.success) {
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } else {
      setError(result.error || "Failed to delete poll");
    }
  };

  const handlePollCreated = () => {
    loadPolls();
  };

  const handleVoteSubmit = () => {
    loadPolls();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Loading polls...</p>
      </div>
    );
  }

  // ... (The rest of the component JSX from the previous correct version)
  // This part does not need to change.
  const activePolls = polls.filter((p) => p.status !== "ended");
  const endedPolls = polls.filter((p) => p.status === "ended");

  return (
    <div>
      {isCaptain && (
        <div className="flex items-center justify-end mb-4">
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="size-4 mr-1" />
            Create Poll
          </Button>
        </div>
      )}
      {seasonContext.isPostseason && seasonContext.seasonId && (
          <DayNightGrid 
              seasonId={seasonContext.seasonId} 
              teamId={teamId} 
              userId={userId} 
              isPostseason={seasonContext.isPostseason} 
          />
      )}
      {error && polls.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {activePolls.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Polls</h3>
          {activePolls.map((poll) => (
            <TeamPollCard
              key={poll.id}
              poll={poll}
              userId={userId}
              isCaptain={isCaptain}
              onVoteSubmit={handleVoteSubmit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      {endedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Polls</h3>
          {endedPolls.map((poll) => (
            <TeamPollCard
              key={poll.id}
              poll={poll}
              userId={userId}
              isCaptain={isCaptain}
              onVoteSubmit={handleVoteSubmit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      {polls.length === 0 && (
        <div className="text-center py-12">
          <Vote className="size-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium mb-1">No polls yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            {isCaptain
              ? "Create a poll to get your team's input on decisions"
              : "Your team captain hasn't created any polls yet"}
          </p>
          {isCaptain && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="size-4 mr-1" />
              Create First Poll
            </Button>
          )}
        </div>
      )}
      <CreateTeamPollDialog
        teamId={teamId}
        userId={userId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onPollCreated={handlePollCreated}
      />
    </div>
  );
}
