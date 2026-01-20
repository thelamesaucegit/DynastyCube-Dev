// src/app/components/admin/MatchScheduler.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getScheduleWeeks } from "@/app/actions/scheduleActions";
import { createMatch, getWeekMatches, deleteMatch } from "@/app/actions/matchActions";
import { getAllTeams } from "@/app/actions/teamActions";
import type { ScheduleWeek } from "@/app/actions/scheduleActions";
import type { Match } from "@/app/actions/matchActions";

interface MatchSchedulerProps {
  seasonId: string;
}

interface Team {
  id: string;
  name: string;
  emoji: string;
}

export const MatchScheduler: React.FC<MatchSchedulerProps> = ({ seasonId }) => {
  const [weeks, setWeeks] = useState<ScheduleWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [bestOf, setBestOf] = useState(3);
  const [weekMatches, setWeekMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [weeksResult, teamsResult] = await Promise.all([
        getScheduleWeeks(seasonId),
        getAllTeams(),
      ]);

      if (weeksResult.error) {
        setError(weeksResult.error);
      } else {
        setWeeks(weeksResult.weeks);
        if (weeksResult.weeks.length > 0) {
          setSelectedWeek(weeksResult.weeks[0].id);
        }
      }

      if (teamsResult.error) {
        setError(teamsResult.error);
      } else {
        setTeams(teamsResult.teams);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadWeekMatches = async () => {
    if (!selectedWeek) return;

    try {
      const { matches, error: matchError } = await getWeekMatches(selectedWeek);
      if (matchError) {
        console.error("Error loading matches:", matchError);
      } else {
        setWeekMatches(matches);
      }
    } catch (err) {
      console.error("Error loading week matches:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedWeek) {
      setError("Please select a week");
      return;
    }

    if (!homeTeamId || !awayTeamId) {
      setError("Please select both teams");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("Home and away teams must be different");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createMatch({
        week_id: selectedWeek,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        best_of: bestOf,
      });

      if (result.success) {
        setSuccess(true);
        setHomeTeamId("");
        setAwayTeamId("");
        setBestOf(3);
        await loadWeekMatches();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to create match");
      }
    } catch (err) {
      console.error("Error creating match:", err);
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMatch = async (matchId: string, homeTeamName: string, awayTeamName: string) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this match?\n\n${homeTeamName} vs ${awayTeamName}\n\nThis will delete all associated data including:\n- Match time proposals\n- Game results\n- Related history\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await deleteMatch(matchId);

      if (result.success) {
        setSuccess(true);
        await loadWeekMatches();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to delete match");
      }
    } catch (err) {
      console.error("Error deleting match:", err);
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading schedule data...</p>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No weeks have been created yet. Create a week first before scheduling matches.
        </p>
      </div>
    );
  }

  const selectedWeekData = weeks.find((w) => w.id === selectedWeek);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Schedule Matches
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Assign teams to play against each other for a specific week.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">
          ✓ Match scheduled successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Week Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Select Week
          </label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            required
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
              Deck Deadline: {new Date(selectedWeekData.deck_submission_deadline).toLocaleString()} |
              Match Deadline: {new Date(selectedWeekData.match_completion_deadline).toLocaleString()}
            </p>
          )}
        </div>

        {/* Team Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Home Team */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              🏠 Home Team
            </label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select home team...</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.emoji} {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Away Team */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              ✈️ Away Team
            </label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select away team...</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id} disabled={team.id === homeTeamId}>
                  {team.emoji} {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Best Of */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Match Format (Best of...)
          </label>
          <div className="flex gap-4">
            {[1, 3, 5, 7].map((num) => (
              <label key={num} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bestOf"
                  value={num}
                  checked={bestOf === num}
                  onChange={() => setBestOf(num)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Bo{num} {num > 1 && `(first to ${Math.ceil(num / 2)})`}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Regular season typically uses Bo3, championship can use Bo5 or Bo7
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
        >
          {submitting ? "Scheduling Match..." : "Schedule Match"}
        </button>
      </form>

      {/* Scheduled Matches for Selected Week */}
      {weekMatches.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Matches Scheduled for Week {selectedWeekData?.week_number}
          </h3>
          <div className="space-y-3">
            {weekMatches.map((match) => (
              <div
                key={match.id}
                className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
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
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Bo{match.best_of}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        match.status === "completed"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                          : match.status === "in_progress"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {match.status}
                    </span>
                    {match.status === "completed" && match.winner_team_id && (
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {match.home_team_wins}-{match.away_team_wins}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteMatch(match.id, match.home_team?.name || "Team 1", match.away_team?.name || "Team 2")}
                      disabled={submitting}
                      className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Delete match"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
