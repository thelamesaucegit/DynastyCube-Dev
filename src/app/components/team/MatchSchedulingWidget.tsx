// src/app/components/team/MatchSchedulingWidget.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getTeamMatchesNeedingScheduling,
  getMatchProposals,
  createMatchTimeProposal,
  respondToProposal,
  cancelProposal,
  type MatchWithScheduling,
  type MatchTimeProposal,
} from "@/app/actions/matchSchedulingActions";

interface MatchSchedulingWidgetProps {
  teamId: string;
  userRoles: string[]; // User's roles on this team
}

export const MatchSchedulingWidget: React.FC<MatchSchedulingWidgetProps> = ({
  teamId,
  userRoles,
}) => {
  const [matches, setMatches] = useState<MatchWithScheduling[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [proposals, setProposals] = useState<MatchTimeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Proposal form state
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");

  const canSchedule = userRoles.includes("pilot") || userRoles.includes("captain");

  // Debug logging
  useEffect(() => {
    console.log("[MatchSchedulingWidget] User roles:", userRoles);
    console.log("[MatchSchedulingWidget] Can schedule:", canSchedule);
  }, [userRoles, canSchedule]);

  useEffect(() => {
    if (canSchedule) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, canSchedule]);

  useEffect(() => {
    if (selectedMatch) {
      loadProposals(selectedMatch);
    }
  }, [selectedMatch]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      console.log("[MatchSchedulingWidget] Loading matches for team:", teamId);
      const { matches: data, error } = await getTeamMatchesNeedingScheduling(teamId);
      console.log("[MatchSchedulingWidget] Matches returned:", data);
      console.log("[MatchSchedulingWidget] Error:", error);
      if (error) {
        setMessage({ type: "error", text: error });
      } else {
        setMatches(data);
        if (data.length > 0 && !selectedMatch) {
          setSelectedMatch(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading matches:", err);
      setMessage({ type: "error", text: "Failed to load matches" });
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async (matchId: string) => {
    try {
      const { proposals: data, error } = await getMatchProposals(matchId);
      if (error) {
        console.error("Error loading proposals:", error);
      } else {
        setProposals(data);
      }
    } catch (err) {
      console.error("Error loading proposals:", err);
    }
  };

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;

    setSubmitting(true);
    setMessage(null);

    const proposedDatetime = `${proposedDate}T${proposedTime}:00`;

    try {
      const result = await createMatchTimeProposal(
        selectedMatch,
        proposedDatetime,
        proposalMessage || undefined
      );

      if (result.success) {
        setMessage({ type: "success", text: "Match time proposed successfully!" });
        setProposedDate("");
        setProposedTime("");
        setProposalMessage("");
        await loadProposals(selectedMatch);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to propose match time" });
      }
    } catch (err) {
      console.error("Error proposing time:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (proposalId: string, accept: boolean, responseMessage?: string) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const result = await respondToProposal(proposalId, accept, responseMessage);

      if (result.success) {
        setMessage({
          type: "success",
          text: accept ? "Match time accepted!" : "Proposal rejected",
        });
        await loadProposals(selectedMatch!);
        await loadMatches(); // Refresh matches to update scheduled status
      } else {
        setMessage({ type: "error", text: result.error || "Failed to respond to proposal" });
      }
    } catch (err) {
      console.error("Error responding to proposal:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (proposalId: string) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const result = await cancelProposal(proposalId);

      if (result.success) {
        setMessage({ type: "success", text: "Proposal cancelled" });
        await loadProposals(selectedMatch!);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to cancel proposal" });
      }
    } catch (err) {
      console.error("Error cancelling proposal:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSchedule) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          🗓️ Match Scheduling
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Only Pilots and Captains can schedule match times. You currently have roles: {userRoles.length > 0 ? userRoles.join(", ") : "none"}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          🗓️ Match Scheduling
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No upcoming matches need scheduling at this time.
        </p>
      </div>
    );
  }

  const currentMatch = matches.find((m) => m.id === selectedMatch);
  const opponentTeam =
    currentMatch?.home_team_id === teamId ? currentMatch?.away_team : currentMatch?.home_team;

  // Get week date range for validation
  const weekData = currentMatch ? (currentMatch as MatchWithScheduling & {
    schedule_weeks?: {
      start_date: string;
      end_date: string;
      match_completion_deadline: string;
    }
  }).schedule_weeks : null;
  const weekStart = weekData ? new Date(weekData.start_date) : null;
  const weekEnd = currentMatch?.extension_granted && currentMatch?.extended_deadline
    ? new Date(currentMatch.extended_deadline)
    : weekData
    ? new Date(weekData.match_completion_deadline)
    : null;

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const myProposals = pendingProposals.filter((p) => p.proposed_by_team_id === teamId);
  const theirProposals = pendingProposals.filter((p) => p.proposed_by_team_id !== teamId);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        🗓️ Match Scheduling
      </h3>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex justify-between items-start">
            <p>{message.text}</p>
            <button
              onClick={() => setMessage(null)}
              className="text-sm opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Match Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Match
        </label>
        <select
          value={selectedMatch || ""}
          onChange={(e) => setSelectedMatch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          {matches.map((match) => {
            const opponent = match.home_team_id === teamId ? match.away_team : match.home_team;
            return (
              <option key={match.id} value={match.id}>
                vs {opponent?.emoji} {opponent?.name}
                {match.scheduled_confirmed && " ✓ Scheduled"}
              </option>
            );
          })}
        </select>
      </div>

      {currentMatch && (
        <>
          {/* Match Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentMatch.home_team?.emoji}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentMatch.home_team?.name}
                </span>
                <span className="text-gray-500 dark:text-gray-400">vs</span>
                <span className="text-2xl">{currentMatch.away_team?.emoji}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentMatch.away_team?.name}
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Bo{currentMatch.best_of}
              </span>
            </div>
            {currentMatch.scheduled_datetime && currentMatch.scheduled_confirmed && (
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                ✓ Scheduled: {new Date(currentMatch.scheduled_datetime).toLocaleString()}
              </div>
            )}
            {currentMatch.extension_granted && (
              <div className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                ⚠️ Extension granted until{" "}
                {currentMatch.extended_deadline &&
                  new Date(currentMatch.extended_deadline).toLocaleString()}
                {currentMatch.extension_reason && ` - ${currentMatch.extension_reason}`}
              </div>
            )}
          </div>

          {/* Proposals from opponent */}
          {theirProposals.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Proposals from {opponentTeam?.name}
              </h4>
              <div className="space-y-3">
                {theirProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(proposal.proposed_datetime).toLocaleString()}
                        </p>
                        {proposal.proposal_message && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            &ldquo;{proposal.proposal_message}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleRespond(proposal.id, true)}
                        disabled={submitting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => {
                          const response = prompt("Reason for declining (optional):");
                          if (response !== null) {
                            handleRespond(proposal.id, false, response || undefined);
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        ✗ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your pending proposals */}
          {myProposals.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Your Pending Proposals
              </h4>
              <div className="space-y-3">
                {myProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(proposal.proposed_datetime).toLocaleString()}
                        </p>
                        {proposal.proposal_message && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            &ldquo;{proposal.proposal_message}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Waiting for {opponentTeam?.name} to respond
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancel(proposal.id)}
                        disabled={submitting}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Propose new time */}
          {!currentMatch.scheduled_confirmed && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Propose a Match Time
              </h4>

              {/* Date range info */}
              {weekStart && weekEnd && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm">
                  <p className="text-blue-900 dark:text-blue-100">
                    <strong>Valid date range:</strong> {weekStart.toLocaleDateString()} to {weekEnd.toLocaleDateString()}
                    {currentMatch.extension_granted && (
                      <span className="ml-2 text-orange-700 dark:text-orange-300">
                        (extended deadline)
                      </span>
                    )}
                  </p>
                </div>
              )}

              <form onSubmit={handlePropose} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      min={weekStart ? weekStart.toISOString().split('T')[0] : undefined}
                      max={weekEnd ? weekEnd.toISOString().split('T')[0] : undefined}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message (optional)
                  </label>
                  <textarea
                    value={proposalMessage}
                    onChange={(e) => setProposalMessage(e.target.value)}
                    rows={2}
                    placeholder="e.g., 'How about Friday evening?'"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {submitting ? "Proposing..." : "Propose Time"}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};
