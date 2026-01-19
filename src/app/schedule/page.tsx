// src/app/schedule/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  getActiveSeasonSchedule,
  getAllSeasons,
  getScheduleWeeks,
  type ScheduleWeek,
} from "@/app/actions/scheduleActions";

interface Match {
  id: string;
  status: string;
  home_team: {
    id: string;
    name: string;
    emoji: string;
  };
  away_team: {
    id: string;
    name: string;
    emoji: string;
  };
  home_team_wins: number;
  away_team_wins: number;
  best_of: number;
}

interface WeekWithMatches extends ScheduleWeek {
  matches: Match[];
}

export default function SchedulePage() {
  const [weeks, setWeeks] = useState<WeekWithMatches[]>([]);
  const [seasons, setSeasons] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active season schedule
      const scheduleResult = await getActiveSeasonSchedule();

      if (scheduleResult.success && scheduleResult.season) {
        setWeeks(scheduleResult.weeks as WeekWithMatches[]);
        setSelectedSeason(scheduleResult.season);
      } else {
        setError(scheduleResult.error || "No active season found");
      }

      // Get all seasons for dropdown
      const seasonsResult = await getAllSeasons();
      if (seasonsResult.success) {
        setSeasons(seasonsResult.seasons);
      }
    } catch (err) {
      console.error("Error loading schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = async (seasonId: string) => {
    if (!seasonId) return;

    const season = seasons.find((s) => s.id === seasonId);
    if (!season) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getScheduleWeeks(seasonId);
      if (result.error) {
        setError(result.error);
        setWeeks([]);
      } else {
        // Need to get matches for each week
        const weeksWithMatches: WeekWithMatches[] = result.weeks.map((week) => ({
          ...week,
          matches: [],
        }));
        setWeeks(weeksWithMatches);
        setSelectedSeason(season);
      }
    } catch (err) {
      console.error("Error loading season schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const getWeekStatus = (week: WeekWithMatches) => {
    const now = new Date();
    const startDate = new Date(week.start_date);
    const endDate = new Date(week.end_date);

    if (now < startDate) return "upcoming";
    if (now > endDate) return "completed";
    return "current";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading schedule...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                📅 Season Schedule
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                {selectedSeason
                  ? `${selectedSeason.name} - ${selectedSeason.status.charAt(0).toUpperCase() + selectedSeason.status.slice(1)}`
                  : "View match schedules and deadlines"}
              </p>
            </div>
            {seasons.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Season:
                </label>
                <select
                  value={selectedSeason?.id || ""}
                  onChange={(e) => handleSeasonChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name} ({season.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-6 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        )}

        {/* Schedule Weeks */}
        {weeks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No Schedule Available
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              The schedule for this season hasn&apos;t been set up yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {weeks.map((week) => {
              const status = getWeekStatus(week);
              const deckDeadlinePassed = new Date(week.deck_submission_deadline) < new Date();

              return (
                <div
                  key={week.id}
                  className={`bg-white dark:bg-gray-800 border-2 rounded-xl p-6 transition-all ${
                    status === "current"
                      ? "border-green-500 dark:border-green-400 shadow-lg"
                      : status === "upcoming"
                      ? "border-blue-300 dark:border-blue-700"
                      : "border-gray-200 dark:border-gray-700 opacity-75"
                  }`}
                >
                  {/* Week Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          Week {week.week_number}
                        </h2>
                        {status === "current" && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full font-semibold">
                            CURRENT WEEK
                          </span>
                        )}
                        {status === "upcoming" && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-semibold">
                            UPCOMING
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(week.start_date)} - {formatDate(week.end_date)}
                      </p>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                      <p className={`text-sm font-medium ${deckDeadlinePassed ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                        Deck Submission Deadline:
                      </p>
                      <p className={`text-lg font-bold ${deckDeadlinePassed ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                        {formatDeadline(week.deck_submission_deadline)}
                        {deckDeadlinePassed && " (Passed)"}
                      </p>
                    </div>
                  </div>

                  {/* Week Notes */}
                  {week.notes && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-100">{week.notes}</p>
                    </div>
                  )}

                  {/* Matches */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Scheduled Matches
                    </h3>
                    {week.matches.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No matches scheduled for this week
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {week.matches.map((match) => (
                          <div
                            key={match.id}
                            className="flex flex-col md:flex-row md:items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              {/* Home Team */}
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-2xl">{match.home_team.emoji}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {match.home_team.name}
                                </span>
                              </div>

                              {/* Score */}
                              <div className="flex items-center gap-2 text-center">
                                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                  {match.home_team_wins}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">-</span>
                                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                  {match.away_team_wins}
                                </span>
                              </div>

                              {/* Away Team */}
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {match.away_team.name}
                                </span>
                                <span className="text-2xl">{match.away_team.emoji}</span>
                              </div>
                            </div>

                            {/* Match Status */}
                            <div className="mt-3 md:mt-0 md:ml-4">
                              <span
                                className={`text-xs px-3 py-1 rounded-full font-semibold ${
                                  match.status === "completed"
                                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                    : match.status === "in_progress"
                                    ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {match.status.replace("_", " ").toUpperCase()}
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                Best of {match.best_of}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
