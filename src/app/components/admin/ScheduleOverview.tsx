// src/app/components/admin/ScheduleOverview.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getScheduleWeeks, updateScheduleWeek, deleteScheduleWeek } from "@/app/actions/scheduleActions";
import { getWeekMatches } from "@/app/actions/matchActions";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatDateTime } from "@/app/utils/timezoneUtils";
import type { ScheduleWeek } from "@/app/actions/scheduleActions";

interface ScheduleOverviewProps {
  seasonId: string;
}

interface WeekWithMatches extends ScheduleWeek {
  matchCount: number;
  status: "past" | "current" | "upcoming";
}

export const ScheduleOverview: React.FC<ScheduleOverviewProps> = ({ seasonId }) => {
  const { timezone } = useUserTimezone();
  const [weeks, setWeeks] = useState<WeekWithMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extendingWeek, setExtendingWeek] = useState<string | null>(null);
  const [deletingWeek, setDeletingWeek] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState(3);

  useEffect(() => {
    loadWeeks();
  }, [seasonId]);

  const loadWeeks = async () => {
    setLoading(true);
    setError(null);

    try {
      const { weeks: weeksData, error: weeksError } = await getScheduleWeeks(seasonId);

      if (weeksError) {
        setError(weeksError);
        setLoading(false);
        return;
      }

      // Load match counts for each week
      const now = new Date();
      const weeksWithData = await Promise.all(
        weeksData.map(async (week) => {
          const { matches } = await getWeekMatches(week.id);

          // Determine week status
          const startDate = new Date(week.start_date);
          const endDate = new Date(week.end_date);
          let status: "past" | "current" | "upcoming";

          if (now > endDate) {
            status = "past";
          } else if (now >= startDate && now <= endDate) {
            status = "current";
          } else {
            status = "upcoming";
          }

          return {
            ...week,
            matchCount: matches.length,
            status,
          };
        })
      );

      setWeeks(weeksWithData);
    } catch (err) {
      console.error("Error loading weeks:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleExtendWeek = async (weekId: string) => {
    setExtendingWeek(weekId);
    setError(null);

    try {
      const week = weeks.find((w) => w.id === weekId);
      if (!week) return;

      // Add extension days to all deadlines and end date
      const currentEndDate = new Date(week.end_date);
      const currentDeckDeadline = new Date(week.deck_submission_deadline);
      const currentMatchDeadline = new Date(week.match_completion_deadline);

      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + extensionDays);

      const newDeckDeadline = new Date(currentDeckDeadline);
      newDeckDeadline.setDate(newDeckDeadline.getDate() + extensionDays);

      const newMatchDeadline = new Date(currentMatchDeadline);
      newMatchDeadline.setDate(newMatchDeadline.getDate() + extensionDays);

      const result = await updateScheduleWeek(weekId, {
        end_date: newEndDate.toISOString(),
        deck_submission_deadline: newDeckDeadline.toISOString(),
        match_completion_deadline: newMatchDeadline.toISOString(),
      });

      if (result.success) {
        await loadWeeks(); // Reload to show updated data
      } else {
        setError(result.error || "Failed to extend week");
      }
    } catch (err) {
      console.error("Error extending week:", err);
      setError("An unexpected error occurred");
    } finally {
      setExtendingWeek(null);
    }
  };

  const handleDeleteWeek = async (weekId: string) => {
    if (!confirm("Are you sure you want to delete this week? This will also delete all associated matches.")) {
      return;
    }

    setDeletingWeek(weekId);
    setError(null);

    try {
      const result = await deleteScheduleWeek(weekId);

      if (result.success) {
        await loadWeeks();
      } else {
        setError(result.error || "Failed to delete week");
      }
    } catch (err) {
      console.error("Error deleting week:", err);
      setError("An unexpected error occurred");
    } finally {
      setDeletingWeek(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading schedule...</p>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No weeks have been created yet. Use the &quot;Create Week&quot; tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Schedule Overview
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          View and manage all schedule weeks for the season. Times shown in {timezone}.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      {/* Extension Days Control */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Week Extension Duration
        </label>
        <div className="flex items-center gap-4">
          <select
            value={extensionDays}
            onChange={(e) => setExtensionDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value={1}>1 day</option>
            <option value={2}>2 days</option>
            <option value={3}>3 days</option>
            <option value={5}>5 days</option>
            <option value={7}>7 days (1 week)</option>
          </select>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            When extending a week, all deadlines and end date will be pushed back by this amount.
          </p>
        </div>
      </div>

      {/* Weeks Table */}
      <div className="space-y-4">
        {weeks.map((week) => (
          <div
            key={week.id}
            className={`border rounded-lg p-6 ${
              week.status === "current"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                : week.status === "past"
                ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-75"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            }`}
          >
            {/* Week Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Week {week.week_number}
                </h3>
                {week.is_playoff_week && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 font-medium">
                    🏆 Playoff
                  </span>
                )}
                {week.is_championship_week && (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 font-medium">
                    👑 Championship
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    week.status === "current"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                      : week.status === "past"
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                  }`}
                >
                  {week.status === "current" ? "● In Progress" : week.status === "past" ? "✓ Completed" : "○ Upcoming"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {week.status !== "past" && (
                  <button
                    onClick={() => handleExtendWeek(week.id)}
                    disabled={extendingWeek === week.id}
                    className="text-sm px-3 py-2 rounded-md bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {extendingWeek === week.id ? "Extending..." : `Extend +${extensionDays}d`}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteWeek(week.id)}
                  disabled={deletingWeek === week.id}
                  className="text-sm px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {deletingWeek === week.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            {/* Week Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Dates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Week Duration
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(week.start_date, timezone)} →{" "}
                  {formatDateTime(week.end_date, timezone)}
                </p>
              </div>

              {/* Match Count */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Matches Scheduled
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {week.matchCount} {week.matchCount === 1 ? "match" : "matches"}
                </p>
              </div>

              {/* Deck Deadline */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  📝 Deck Submission Deadline
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(week.deck_submission_deadline, timezone)}
                </p>
              </div>

              {/* Match Deadline */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  🎮 Match Completion Deadline
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(week.match_completion_deadline, timezone)}
                </p>
              </div>
            </div>

            {/* Notes */}
            {week.notes && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Notes
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{week.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {weeks.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Weeks</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {weeks.filter((w) => w.status === "upcoming").length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Upcoming</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {weeks.filter((w) => w.status === "current").length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {weeks.reduce((sum, w) => sum + w.matchCount, 0)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Matches</p>
        </div>
      </div>
    </div>
  );
};
