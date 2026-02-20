"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getTeamPolls, deleteTeamPoll } from "@/app/actions/voteActions";
import type { PollWithOptions } from "@/app/actions/voteActions";
import { TeamPollCard } from "./TeamPollCard";
import { CreateTeamPollDialog } from "./CreateTeamPollDialog";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Vote,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface TeamVotingProps {
  teamId: string;
  userRoles: string[];
}

export function TeamVoting({ teamId, userRoles }: TeamVotingProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const isCaptain = userRoles.includes("captain");
  const userId = user?.id || "";

  const loadPolls = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    const result = await getTeamPolls(teamId, userId);

    if (result.success) {
      setPolls(result.polls);
    } else {
      setError(result.error || "Failed to load polls");
    }

    setLoading(false);
  }, [teamId, userId]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  const handleDelete = async (pollId: string) => {
    if (!userId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this poll? All votes will be permanently removed."
    );
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

  if (error && polls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="size-8 text-destructive mb-3" />
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadPolls}>
          Try Again
        </Button>
      </div>
    );
  }

  // Separate active and ended polls
  const activePolls = polls.filter((p) => p.status !== "ended");
  const endedPolls = polls.filter((p) => p.status === "ended");

  return (
    <div>
      {/* Header with create button */}
      {isCaptain && (
        <div className="flex items-center justify-end mb-4">
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="size-4 mr-1" />
            Create Poll
          </Button>
        </div>
      )}

      {/* Error banner (non-blocking) */}
      {error && polls.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Active Polls */}
      {activePolls.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Active Polls
          </h3>
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

      {/* Ended Polls */}
      {endedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Polls
          </h3>
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

      {/* Empty State */}
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

      {/* Create Poll Dialog */}
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
