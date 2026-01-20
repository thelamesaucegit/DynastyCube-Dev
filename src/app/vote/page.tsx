// src/app/vote/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActivePolls,
  getPollWithOptions,
  getPollResults,
  castVote,
  type PollWithOptions,
  type PollResult,
} from "@/app/actions/voteActions";

export default function VotePage() {
  const { user, loading: authLoading } = useAuth();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoll, setSelectedPoll] = useState<PollWithOptions | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<PollResult[]>([]);
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
    setResults([]);
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
        alert("✅ " + result.message);
        // Reload polls and poll details
        await loadPolls();
        const updatedPoll = await getPollWithOptions(selectedPoll.id, user.id);
        if (updatedPoll.success && updatedPoll.poll) {
          setSelectedPoll(updatedPoll.poll);
          setSelectedOptions(updatedPoll.poll.userVotes || []);
        }
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("❌ Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShowResults = async () => {
    if (!selectedPoll) return;

    const result = await getPollResults(selectedPoll.id);
    if (result.success) {
      setResults(result.results);
      setShowResults(true);
    } else {
      alert("❌ Failed to load results");
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
      <Layout>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-8 shadow-lg">
            <div className="text-6xl mb-4">🗳️</div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Sign In Required
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
              You must be signed in to access the voting system.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-8">
              Please use the &quot;Sign in with Discord&quot; button in the navigation menu to continue.
            </p>
            <div className="mt-8">
              <p className="font-bold text-gray-900 dark:text-gray-100 mb-4">Why sign in?</p>
              <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700 dark:text-gray-300">
                <li>✓ Vote on cube changes and additions</li>
                <li>✓ Participate in league decisions</li>
                <li>✓ Access member-only features</li>
                <li>✓ Track your voting history</li>
              </ul>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🗳️ Community Voting
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Vote on cube changes, card additions, and league decisions
          </p>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading polls...</p>
          </div>
        ) : polls.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No Active Polls
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              There are no polls available at the moment. Check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Poll List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Active Polls ({polls.length})
              </h2>
              {polls.map((poll) => {
                const status = getPollStatus(poll);
                const isSelected = selectedPoll?.id === poll.id;

                return (
                  <button
                    key={poll.id}
                    onClick={() => handleSelectPoll(poll)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 flex-1">
                        {poll.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          status.color === "green"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : status.color === "blue"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p>📊 {poll.total_votes} votes</p>
                      <p>⏰ Ends {formatDate(poll.ends_at)}</p>
                      {poll.hasVoted && (
                        <p className="text-green-600 dark:text-green-400 font-semibold">
                          ✓ You voted
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Poll Details */}
            <div className="lg:col-span-2">
              {!selectedPoll ? (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
                  <div className="text-6xl mb-4">👈</div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Select a Poll
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Choose a poll from the list to view details and cast your vote
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
                  {/* Poll Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {selectedPoll.title}
                    </h2>
                    {selectedPoll.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {selectedPoll.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>⏰ Ends: {formatDate(selectedPoll.ends_at)}</span>
                      <span>📊 {selectedPoll.total_votes} total votes</span>
                      {selectedPoll.allow_multiple_votes && (
                        <span className="text-blue-600 dark:text-blue-400">
                          ✓ Multiple selections allowed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Voting Interface */}
                  {!showResults && selectedPoll.options && (
                    <div className="space-y-3 mb-6">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
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
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600"
                                : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                            } ${isPollEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-600"
                                    : "border-gray-300 dark:border-gray-600"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {option.option_text}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Results Display */}
                  {showResults && results.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Results:
                      </h3>
                      {results.map((result) => (
                        <div key={result.option_id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {result.option_text}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {result.vote_count} votes ({result.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className="bg-blue-600 h-3 rounded-full transition-all"
                              style={{ width: `${result.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {!showResults && new Date(selectedPoll.ends_at) > new Date() && (
                      <button
                        onClick={handleSubmitVote}
                        disabled={selectedOptions.length === 0 || submitting}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:cursor-not-allowed"
                      >
                        {submitting ? "Submitting..." : "Submit Vote"}
                      </button>
                    )}
                    {(selectedPoll.show_results_before_end ||
                      new Date(selectedPoll.ends_at) < new Date()) && (
                      <button
                        onClick={showResults ? () => setShowResults(false) : handleShowResults}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                      >
                        {showResults ? "Hide Results" : "Show Results"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
