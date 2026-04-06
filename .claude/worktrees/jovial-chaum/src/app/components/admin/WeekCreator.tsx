// src/app/components/admin/WeekCreator.tsx
"use client";

import React, { useState } from "react";
import { createScheduleWeek } from "@/app/actions/scheduleActions";
import { useUserTimezone } from "@/hooks/useUserTimezone";

interface WeekCreatorProps {
  seasonId: string;
  onWeekCreated?: () => void;
}

export const WeekCreator: React.FC<WeekCreatorProps> = ({ seasonId, onWeekCreated }) => {
  const { timezone } = useUserTimezone();
  const [weekNumber, setWeekNumber] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deckDeadline, setDeckDeadline] = useState("");
  const [matchDeadline, setMatchDeadline] = useState("");
  const [isPlayoffWeek, setIsPlayoffWeek] = useState(false);
  const [isChampionshipWeek, setIsChampionshipWeek] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const deck = new Date(deckDeadline);
      const match = new Date(matchDeadline);

      if (end <= start) {
        setError("End date must be after start date");
        setSubmitting(false);
        return;
      }

      if (deck > end) {
        setError("Deck submission deadline must be before week end date");
        setSubmitting(false);
        return;
      }

      if (match > end) {
        setError("Match completion deadline must be before week end date");
        setSubmitting(false);
        return;
      }

      const result = await createScheduleWeek({
        season_id: seasonId,
        week_number: weekNumber,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        deck_submission_deadline: deck.toISOString(),
        match_completion_deadline: match.toISOString(),
        is_playoff_week: isPlayoffWeek,
        is_championship_week: isChampionshipWeek,
        notes: notes || undefined,
      });

      if (result.success) {
        setSuccess(true);
        // Reset form
        setWeekNumber(weekNumber + 1);
        setStartDate("");
        setEndDate("");
        setDeckDeadline("");
        setMatchDeadline("");
        setIsPlayoffWeek(false);
        setIsChampionshipWeek(false);
        setNotes("");

        onWeekCreated?.();

        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to create week");
      }
    } catch (err) {
      console.error("Error creating week:", err);
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to set end date one week after start date
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (date) {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // 7 days total (start day + 6)
      end.setHours(23, 59, 59);
      setEndDate(end.toISOString().slice(0, 16));

      // Set deck deadline to 3 days after start
      const deckDL = new Date(start);
      deckDL.setDate(deckDL.getDate() + 3);
      deckDL.setHours(23, 59, 59);
      setDeckDeadline(deckDL.toISOString().slice(0, 16));

      // Set match deadline to end of week
      setMatchDeadline(end.toISOString().slice(0, 16));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Create Schedule Week
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set up a new week with deadlines for deck submissions and match completion.
          Times will be displayed to users in their timezone ({timezone}).
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">
          ✓ Week {weekNumber - 1} created successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Week Number */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Week Number
          </label>
          <input
            type="number"
            min="1"
            value={weekNumber}
            onChange={(e) => setWeekNumber(parseInt(e.target.value))}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Dates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Deadlines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deck Submission Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              📝 Deck Submission Deadline
            </label>
            <input
              type="datetime-local"
              value={deckDeadline}
              onChange={(e) => setDeckDeadline(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Teams must submit deck lists by this time
            </p>
          </div>

          {/* Match Completion Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              🎮 Match Completion Deadline
            </label>
            <input
              type="datetime-local"
              value={matchDeadline}
              onChange={(e) => setMatchDeadline(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              All matches must be completed by this time
            </p>
          </div>
        </div>

        {/* Special Week Flags */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Special Week Type
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPlayoffWeek}
                onChange={(e) => {
                  setIsPlayoffWeek(e.target.checked);
                  if (e.target.checked) setIsChampionshipWeek(false);
                }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                🏆 Playoff Week (semi-finals, quarter-finals, etc.)
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isChampionshipWeek}
                onChange={(e) => {
                  setIsChampionshipWeek(e.target.checked);
                  if (e.target.checked) setIsPlayoffWeek(false);
                }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                👑 Championship Week (final match)
              </span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any special instructions or information about this week..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {submitting ? "Creating Week..." : "Create Week"}
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This will create Week {weekNumber} in the schedule
          </p>
        </div>
      </form>
    </div>
  );
};
