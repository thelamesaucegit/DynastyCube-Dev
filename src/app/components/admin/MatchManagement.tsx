// src/app/components/admin/MatchManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getWeekMatches,
  createMatch,
  updateMatch,
  getMatchGames,
  type Match,
  type MatchGame,
} from "@/app/actions/matchActions";
import { getTeamsWithMembers } from "@/app/actions/teamActions";

interface BasicTeam {
  id: string;
  name: string;
  emoji: string;
}

export function MatchManagement() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<BasicTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchGames, setMatchGames] = useState<MatchGame[]>([]);

  // Form state
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [bestOf, setBestOf] = useState(3);

  // Edit state
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editHomeWins, setEditHomeWins] = useState(0);
  const [editAwayWins, setEditAwayWins] = useState(0);
  const [editStatus, setEditStatus] = useState("scheduled");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all matches (pass null for weekId to get all)
      const matchResult = await getWeekMatches(null);
      const teamResult = await getTeamsWithMembers();

      if (matchResult.success && matchResult.matches) {
        setMatches(matchResult.matches);
      }

      setTeams(teamResult);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!homeTeamId || !awayTeamId) {
      alert("❌ Please select both home and away teams");
      return;
    }

    if (homeTeamId === awayTeamId) {
      alert("❌ Home and away teams must be different");
      return;
    }

    const result = await createMatch({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      best_of: bestOf,
    });

    if (result.success) {
      alert("✅ " + result.message);
      setShowCreateForm(false);
      setHomeTeamId("");
      setAwayTeamId("");
      setBestOf(3);
      loadData();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleViewMatch = async (match: Match) => {
    setSelectedMatch(match);
    setEditingMatch(null);

    // Load games for this match
    const gamesResult = await getMatchGames(match.id);
    if (!gamesResult.error && gamesResult.games) {
      setMatchGames(gamesResult.games);
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match.id);
    setEditHomeWins(match.home_team_wins);
    setEditAwayWins(match.away_team_wins);
    setEditStatus(match.status);
    setEditNotes(match.admin_notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingMatch) return;

    const result = await updateMatch(editingMatch, {
      home_team_wins: editHomeWins,
      away_team_wins: editAwayWins,
      status: editStatus as "scheduled" | "in_progress" | "completed" | "cancelled",
      admin_notes: editNotes,
    });

    if (result.success) {
      alert("✅ " + result.message);
      setEditingMatch(null);
      loadData();
    } else {
      alert("❌ " + result.error);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? `${team.emoji} ${team.name}` : teamId;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ⚔️ Match Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage team matches
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {showCreateForm ? "Cancel" : "+ Create New Match"}
        </button>
      </div>

      {/* Create Match Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Create New Match
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Home Team */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Home Team
              </label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select Home Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.emoji} {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Away Team */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Away Team
              </label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select Away Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.emoji} {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Best Of */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Best Of
              </label>
              <select
                value={bestOf}
                onChange={(e) => setBestOf(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateMatch}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            Create Match
          </button>
        </div>
      )}

      {/* Match List */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          All Matches ({matches.length})
        </h3>

        {matches.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">⚔️</div>
            <p className="text-gray-600 dark:text-gray-400">
              No matches created yet. Create your first match to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                {editingMatch === match.id ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Home Wins</label>
                        <input
                          type="number"
                          value={editHomeWins}
                          onChange={(e) => setEditHomeWins(parseInt(e.target.value))}
                          className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Away Wins</label>
                        <input
                          type="number"
                          value={editAwayWins}
                          onChange={(e) => setEditAwayWins(parseInt(e.target.value))}
                          className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Admin Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingMatch(null)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-center">
                        <div className="font-bold text-gray-900 dark:text-gray-100">
                          {getTeamName(match.home_team_id)}
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
                        <div className="font-bold text-gray-900 dark:text-gray-100">
                          {getTeamName(match.away_team_id)}
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          match.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : match.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {match.status}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewMatch(match)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditMatch(match)}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Match Details
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {getTeamName(selectedMatch.home_team_id)} vs{" "}
                  {getTeamName(selectedMatch.away_team_id)}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedMatch.home_team_wins} - {selectedMatch.away_team_wins}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Best of {selectedMatch.best_of}
                </div>
              </div>

              {matchGames.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Game Results:
                  </h4>
                  {matchGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-2"
                    >
                      <span className="font-semibold">Game {game.game_number}</span>
                      <span>Winner: {getTeamName(game.winner_team_id)}</span>
                      {game.duration_minutes && (
                        <span className="text-sm text-gray-600">
                          ({game.duration_minutes} min)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedMatch.admin_notes && (
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Admin Notes:
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedMatch.admin_notes}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedMatch(null)}
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
