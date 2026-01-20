// src/app/components/admin/MatchExtensionManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  grantMatchExtension,
  revokeMatchExtension,
} from "@/app/actions/matchSchedulingActions";
import { getWeekMatches, type Match } from "@/app/actions/matchActions";
import { getScheduleWeeks, type ScheduleWeek } from "@/app/actions/scheduleActions";

interface MatchExtensionManagerProps {
  seasonId: string;
}

type MatchWithExtension = Match & {
  extension_granted?: boolean;
  extended_deadline?: string;
  extension_reason?: string;
};

export const MatchExtensionManager: React.FC<MatchExtensionManagerProps> = ({ seasonId }) => {
  const [weeks, setWeeks] = useState<ScheduleWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [matches, setMatches] = useState<MatchWithExtension[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Extension form state
  const [extendedDate, setExtendedDate] = useState("");
  const [extendedTime, setExtendedTime] = useState("");
  const [extensionReason, setExtensionReason] = useState("");

  useEffect(() => {
    loadWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  useEffect(() => {
    if (selectedWeek) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const loadWeeks = async () => {
    setLoading(true);
    try {
      const { weeks: data, error } = await getScheduleWeeks(seasonId);
      if (error) {
        setMessage({ type: "error", text: error });
      } else {
        setWeeks(data);
        if (data.length > 0) {
          setSelectedWeek(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading weeks:", err);
      setMessage({ type: "error", text: "Failed to load weeks" });
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    if (!selectedWeek) return;

    try {
      const { matches: data, error } = await getWeekMatches(selectedWeek);
      if (error) {
        setMessage({ type: "error", text: error });
      } else {
        setMatches(data);
      }
    } catch (err) {
      console.error("Error loading matches:", err);
      setMessage({ type: "error", text: "Failed to load matches" });
    }
  };

  const handleGrantExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;

    setSubmitting(true);
    setMessage(null);

    const extendedDeadline = `${extendedDate}T${extendedTime}:00`;

    try {
      const result = await grantMatchExtension(selectedMatch, extendedDeadline, extensionReason);

      if (result.success) {
        setMessage({ type: "success", text: "Extension granted successfully!" });
        setExtendedDate("");
        setExtendedTime("");
        setExtensionReason("");
        setSelectedMatch(null);
        await loadMatches();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to grant extension" });
      }
    } catch (err) {
      console.error("Error granting extension:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeExtension = async (matchId: string) => {
    if (!confirm("Are you sure you want to revoke this extension?")) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await revokeMatchExtension(matchId);

      if (result.success) {
        setMessage({ type: "success", text: "Extension revoked successfully!" });
        await loadMatches();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to revoke extension" });
      }
    } catch (err) {
      console.error("Error revoking extension:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading data...</p>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          No weeks have been created yet. Create weeks first before managing extensions.
        </p>
      </div>
    );
  }

  const selectedWeekData = weeks.find((w) => w.id === selectedWeek);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Manage Match Extensions
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Grant or revoke deadline extensions for specific matches.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex justify-between items-start">
            <p>{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-sm opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Week Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Select Week
        </label>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              Week {week.week_number}
              {week.is_playoff_week && " (Playoff)"}
              {week.is_championship_week && " (Championship)"}
              {" - "}
              {new Date(week.start_date).toLocaleDateString()} to{" "}
              {new Date(week.end_date).toLocaleDateString()}
            </option>
          ))}
        </select>
        {selectedWeekData && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Original Deadline:{" "}
            {new Date(selectedWeekData.match_completion_deadline).toLocaleString()}
          </p>
        )}
      </div>

      {/* Matches List */}
      {matches.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No matches scheduled for this week.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Scheduled Matches
          </h4>
          {matches.map((match) => (
            <div
              key={match.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                match.extension_granted
                  ? "border-orange-400 dark:border-orange-600"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{match.home_team?.emoji}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {match.home_team?.name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">vs</span>
                  <span className="text-2xl">{match.away_team?.emoji}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {match.away_team?.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {match.extension_granted ? (
                    <>
                      <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded font-medium">
                        Extension Granted
                      </span>
                      <button
                        onClick={() => handleRevokeExtension(match.id)}
                        disabled={submitting}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedMatch(selectedMatch === match.id ? null : match.id)}
                      className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                    >
                      {selectedMatch === match.id ? "Cancel" : "Grant Extension"}
                    </button>
                  )}
                </div>
              </div>

              {/* Extension details if granted */}
              {match.extension_granted && match.extended_deadline && (
                <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-sm">
                  <p className="text-orange-800 dark:text-orange-200">
                    <strong>Extended Until:</strong>{" "}
                    {new Date(match.extended_deadline).toLocaleString()}
                  </p>
                  {match.extension_reason && (
                    <p className="text-orange-800 dark:text-orange-200 mt-1">
                      <strong>Reason:</strong> {match.extension_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Extension form */}
              {selectedMatch === match.id && !match.extension_granted && (
                <form onSubmit={handleGrantExtension} className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Extended Date
                      </label>
                      <input
                        type="date"
                        value={extendedDate}
                        onChange={(e) => setExtendedDate(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Extended Time
                      </label>
                      <input
                        type="time"
                        value={extendedTime}
                        onChange={(e) => setExtendedTime(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reason for Extension
                    </label>
                    <textarea
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      required
                      rows={2}
                      placeholder="e.g., Teams requested more time to coordinate schedules"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {submitting ? "Granting Extension..." : "Grant Extension"}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
