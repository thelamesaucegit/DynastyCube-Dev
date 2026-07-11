// src/app/components/team/TeamVoting.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getTeamPolls, deleteTeamPoll, getVotingContext, submitTeamMotto } from "@/app/actions/voteActions";
import type { PollWithOptions } from "@/app/actions/voteActions";
import { TeamPollCard } from "./TeamPollCard";
import { CreateTeamPollDialog } from "./CreateTeamPollDialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input"; // Ensure you import Input
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Vote, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { DayNightGrid } from "@/app/components/vote/DayNightGrid";
import { TargetedGlitchedText } from "@/app/components/lore/TargetedGlitchedText";

interface TeamVotingProps {
  teamId: string;
  userRoles: string[];
}

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
  
  // --- NEW: Motto Submission State ---
  const [mottoText, setMottoText] = useState("");
  const [mottoIdentity, setMottoIdentity] = useState<string>("standard");
  const [submittingMotto, setSubmittingMotto] = useState(false);
  const [mottoSuccess, setMottoSuccess] = useState<string | null>(null);
  const [mottoError, setMottoError] = useState<string | null>(null);

  const [seasonContext, setSeasonContext] = useState<SeasonContext>({ 
    seasonId: null, 
    isPostseason: false 
  });
  
  const isCaptain = userRoles.includes("captain");
  const userId = user?.id || "";

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
        setSeasonContext({
            seasonId: contextResult.seasonId,
            isPostseason: contextResult.isPostseason
        });
    }
    setLoading(false);
  }, [teamId, userId]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

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

  // --- NEW: Submit Motto Handler ---
  const handleSubmitMotto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mottoText.trim()) return;

    setSubmittingMotto(true);
    setMottoError(null);
    setMottoSuccess(null);

    const identityKey = mottoIdentity === "standard" ? null : mottoIdentity;
    const res = await submitTeamMotto(teamId, mottoText, identityKey);

    if (res.success) {
        setMottoSuccess("✅ Motto submitted successfully! Awaiting Admin approval.");
        setMottoText("");
    } else {
        setMottoError(res.error || "Failed to submit motto.");
    }
    setSubmittingMotto(false);
  };

  const handlePollCreated = () => loadPolls();
  const handleVoteSubmit = () => loadPolls();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Loading polls...</p>
      </div>
    );
  }

  const activePolls = polls.filter((p) => p.status !== "ended");
  const endedPolls = polls.filter((p) => p.status === "ended");

  // Determine if this is the Changelings team to show identity choices (checking team name/slug pattern matches)
  const isChangelings = teamId === '2bfc34c2-045b-4ac7-872b-05aeebd4c53b'; 

  return (
    <div className="space-y-6">
      {isCaptain && (
        <div className="flex items-center justify-end">
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

      {/* --- NEW: MOTTO SUBMISSION FORM (VISIBLE IN POSTSEASON) --- */}
      {seasonContext.isPostseason && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="size-4" />
              Propose Faction Motto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitMotto} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {isChangelings && (
                  <select 
                    value={mottoIdentity} 
                    onChange={(e) => setMottoIdentity(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm font-semibold max-w-[180px] shrink-0"
                  >
                    <option value="changelings">Changelings Identity</option>
                    <option value="mimics">Mimics Identity</option>
                  </select>
                )}
                <Input 
                  placeholder="Enter proposed motto text..." 
                  value={mottoText}
                  onChange={(e) => setMottoText(e.target.value)}
                  maxLength={100}
                  className="flex-1"
                  disabled={submittingMotto}
                />
                <Button type="submit" disabled={submittingMotto || !mottoText.trim()} className="shrink-0">
                  {submittingMotto ? <Loader2 className="size-4 animate-spin" /> : "Submit"}
                </Button>
              </div>
              {mottoSuccess && <p className="text-xs text-green-600 font-medium">{mottoSuccess}</p>}
              {mottoError && <p className="text-xs text-destructive font-medium">{mottoError}</p>}
            </form>
          </CardContent>
        </Card>
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
          <p className="text-lg font-medium mb-1">No active polls</p>
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
