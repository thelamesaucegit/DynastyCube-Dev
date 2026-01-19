// src/app/components/admin/VoteManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllPolls,
  createPoll,
  updatePoll,
  deletePoll,
  togglePollActive,
  getPollResults,
  type Poll,
  type PollResult,
} from "@/app/actions/voteActions";

export function VoteManagement() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endsAt: "",
    allowMultipleVotes: false,
    showResultsBeforeEnd: true,
    options: ["", ""],
  });

  useEffect(() => {
    loadPolls();
  }, []);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const result = await getAllPolls();
      if (result.success) {
        setPolls(result.polls as Poll[]);
      }
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!user) return;

    // Validate
    if (!formData.title.trim()) {
      alert("❌ Title is required");
      return;
    }

    if (!formData.endsAt) {
      alert("❌ End date is required");
      return;
    }

    const validOptions = formData.options.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) {
      alert("❌ At least 2 options are required");
      return;
    }

    const result = await createPoll(
      formData.title,
      formData.description || null,
      formData.endsAt,
      formData.allowMultipleVotes,
      formData.showResultsBeforeEnd,
      validOptions,
      user.id
    );

    if (result.success) {
      alert("✅ " + result.message);
      setShowCreateForm(false);
      setFormData({
        title: "",
        description: "",
        endsAt: "",
        allowMultipleVotes: false,
        showResultsBeforeEnd: true,
        options: ["", ""],
      });
      loadPolls();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleToggleActive = async (pollId: string, currentStatus: boolean) => {
    const result = await togglePollActive(pollId, !currentStatus);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll? This cannot be undone.")) {
      return;
    }

    const result = await deletePoll(pollId);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleViewResults = async (poll: Poll) => {
    setSelectedPoll(poll);
    setShowResults(true);

    const result = await getPollResults(poll.id);
    if (result.success) {
      setResults(result.results);
    }
  };

  const addOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) {
      alert("❌ At least 2 options are required");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
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

  const getDefaultEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7); // 7 days from now
    return date.toISOString().slice(0, 16);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading polls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🗳️ Voting System Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage community polls
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {showCreateForm ? "Cancel" : "+ Create New Poll"}
        </button>
      </div>

      {/* Create Poll Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Create New Poll
          </h3>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Poll Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What should we vote on?"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide additional context for voters..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Voting Ends At *
              </label>
              <input
                type="datetime-local"
                value={formData.endsAt || getDefaultEndDate()}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Poll Options * (minimum 2)
              </label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    {formData.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
              >
                + Add Another Option
              </button>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.allowMultipleVotes}
                  onChange={(e) =>
                    setFormData({ ...formData, allowMultipleVotes: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Allow multiple selections
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.showResultsBeforeEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, showResultsBeforeEnd: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show results before voting ends
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreatePoll}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Create Poll
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Polls List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          All Polls ({polls.length})
        </h3>

        {polls.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 dark:text-gray-400">
              No polls created yet. Create your first poll to get started!
            </p>
          </div>
        ) : (
          polls.map((poll) => {
            const now = new Date();
            const endsAt = new Date(poll.ends_at);
            const isEnded = endsAt < now;
            const statusColor = poll.is_active
              ? isEnded
                ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";

            return (
              <div
                key={poll.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {poll.title}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {poll.is_active ? (isEnded ? "Ended" : "Active") : "Inactive"}
                      </span>
                    </div>
                    {poll.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {poll.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>📊 {poll.total_votes} votes</span>
                      <span>⏰ Ends: {formatDate(poll.ends_at)}</span>
                      {poll.allow_multiple_votes && <span>✓ Multiple choice</span>}
                      {poll.show_results_before_end && <span>👁️ Results visible</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleViewResults(poll)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors"
                  >
                    View Results
                  </button>
                  <button
                    onClick={() => handleToggleActive(poll.id, poll.is_active)}
                    className={`px-4 py-2 rounded font-semibold transition-colors ${
                      poll.is_active
                        ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {poll.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDeletePoll(poll.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Results Modal */}
      {showResults && selectedPoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedPoll.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Total Votes: {selectedPoll.total_votes}
                </p>
              </div>
              <button
                onClick={() => setShowResults(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.option_id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {result.option_text}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {result.vote_count} votes ({result.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all"
                      style={{ width: `${result.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowResults(false)}
              className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
