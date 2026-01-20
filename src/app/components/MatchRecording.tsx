// src/app/components/MatchRecording.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTeamMatches,
  getTeamMatchStats,
  reportMatchGame,
  getMatchGames,
  type Match as MatchType,
} from "@/app/actions/matchActions";
import { getUserTeamRoles } from "@/app/actions/roleActions";

interface MatchRecordingProps {
  teamId: string;
}

export function MatchRecording({ teamId }: MatchRecordingProps) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchType[]>([]);
  const [stats, setStats] = useState<{
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    games_won: number;
    games_lost: number;
    win_percentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchType | null>(null);
  const [recordingGame, setRecordingGame] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Form state for recording game
  const [gameNumber, setGameNumber] = useState(1);
  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadMatchData();
    checkUserRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadMatchData = async () => {
    setLoading(true);
    try {
      const matchResult = await getTeamMatches(teamId);
      const statsResult = await getTeamMatchStats(teamId);

      if (!matchResult.error && matchResult.matches) {
        setMatches(matchResult.matches);
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error("Error loading match data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserRoles = async () => {
    if (!user) return;

    // Check if user has Pilot or Captain role
    const result = await getUserTeamRoles(user.id, teamId);
    if (result.roles) {
      setUserRoles(result.roles);
    }
  };

  const canRecordResults = userRoles.includes("pilot") || userRoles.includes("captain");

  const handleSelectMatch = async (match: MatchType) => {
    // Reload the match to get fresh data including current win counts
    const matchResult = await getTeamMatches(teamId);
    const freshMatch = matchResult.matches?.find((m) => m.id === match.id);

    setSelectedMatch(freshMatch || match);
    setWinnerTeamId((freshMatch || match).home_team_id); // Default to home team

    // Load games for this match
    const gamesResult = await getMatchGames(match.id);
    if (!gamesResult.error && gamesResult.games) {
      setGameNumber((gamesResult.games.length || 0) + 1);
    }
  };

  const handleRecordGame = async () => {
    if (!selectedMatch || !user || !winnerTeamId) return;

    console.log("[MatchRecording] Recording game for match:", selectedMatch.id);
    console.log("[MatchRecording] Current displayed wins:", selectedMatch.home_team_wins, "-", selectedMatch.away_team_wins);

    setRecordingGame(true);
    try {
      const result = await reportMatchGame({
        match_id: selectedMatch.id,
        game_number: gameNumber,
        winner_team_id: winnerTeamId,
        reported_by_team_id: teamId,
        duration_minutes: durationMinutes,
        notes: notes || undefined,
      });

      if (result.success) {
        alert("✅ Game result recorded successfully");
        setGameNumber(gameNumber + 1);
        setNotes("");
        setDurationMinutes(undefined);

        // Update the selected match with the stats returned from the RPC function
        if (result.updatedStats) {
          console.log("[MatchRecording] Updating match with RPC stats:", result.updatedStats);
          setSelectedMatch({
            ...selectedMatch,
            home_team_wins: result.updatedStats.home_wins,
            away_team_wins: result.updatedStats.away_wins,
            status: result.updatedStats.match_status as "scheduled" | "in_progress" | "completed" | "cancelled",
          });
        }

        // Reload all match data in the background (for stats and match list)
        loadMatchData();
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error("Error recording game:", error);
      alert("❌ Failed to record game result");
    } finally {
      setRecordingGame(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📊 Match Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.matches_played}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Matches Played</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.matches_won}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Matches Won</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.matches_lost}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Matches Lost</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {stats.games_won}-{stats.games_lost}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Game Record</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {stats.win_percentage.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Win Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Check */}
      {!canRecordResults && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            ⚠️ Only team <strong>Pilots</strong> and <strong>Captains</strong> can record match results.
          </p>
        </div>
      )}

      {/* Record Game Result */}
      {canRecordResults && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🎮 Record Game Result
          </h3>

          <div className="space-y-4">
            {/* Select Match */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select Match
              </label>
              <select
                value={selectedMatch?.id || ""}
                onChange={(e) => {
                  const match = matches.find((m) => m.id === e.target.value);
                  if (match) handleSelectMatch(match);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">-- Select a match --</option>
                {matches
                  .filter((m) => m.status !== "completed" && m.status !== "cancelled")
                  .map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.home_team?.name} vs {match.away_team?.name} (
                      {match.home_team_wins}-{match.away_team_wins}) - Week {match.week?.week_number || '?'} [{match.id.substring(0, 8)}]
                    </option>
                  ))}
              </select>
            </div>

            {selectedMatch && (
              <>
                {/* Game Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Game Number
                  </label>
                  <input
                    type="number"
                    value={gameNumber}
                    onChange={(e) => setGameNumber(parseInt(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Winner */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Winner
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setWinnerTeamId(selectedMatch.home_team_id)}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        winnerTeamId === selectedMatch.home_team_id
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <div className="text-2xl mb-2">{selectedMatch.home_team?.emoji}</div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {selectedMatch.home_team?.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedMatch.home_team_wins} wins
                      </div>
                    </button>

                    <button
                      onClick={() => setWinnerTeamId(selectedMatch.away_team_id)}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        winnerTeamId === selectedMatch.away_team_id
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <div className="text-2xl mb-2">{selectedMatch.away_team?.emoji}</div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {selectedMatch.away_team?.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedMatch.away_team_wins} wins
                      </div>
                    </button>
                  </div>
                </div>

                {/* Duration (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Duration (minutes) - Optional
                  </label>
                  <input
                    type="number"
                    value={durationMinutes || ""}
                    onChange={(e) =>
                      setDurationMinutes(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="Leave blank if unknown"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Notes (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Notes - Optional
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add any additional notes about the game..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleRecordGame}
                  disabled={recordingGame || !winnerTeamId}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:cursor-not-allowed"
                >
                  {recordingGame ? "Recording..." : "Record Game Result"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Match History */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          📜 Match History
        </h3>

        {matches.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <p className="text-gray-600 dark:text-gray-400">
              No matches scheduled yet. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                  match.status === "completed"
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-blue-400 dark:border-blue-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-center">
                      <div className="text-2xl">{match.home_team?.emoji}</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {match.home_team?.name}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {match.home_team_wins} - {match.away_team_wins}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Best of {match.best_of}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl">{match.away_team?.emoji}</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {match.away_team?.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        match.status === "completed"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : match.status === "in_progress"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {match.status}
                    </span>
                    {match.winner_team_id && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Winner: {match.winner_team_id === match.home_team_id
                          ? match.home_team?.name
                          : match.away_team?.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
