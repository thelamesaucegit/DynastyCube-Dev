// src/app/components/admin/DraftOrderManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  generateDraftOrder,
  regenerateDraftOrder,
  getDraftOrder,
  getSeasonStandings,
  getDraftSettings,
  updateDraftSetting,
  type DraftOrderEntry,
  type SeasonStanding,
} from "@/app/actions/draftOrderActions";
import { getSeasons, type Season } from "@/app/actions/cubucksActions";

export const DraftOrderManagement: React.FC = () => {
  // Season / data state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [draftOrder, setDraftOrder] = useState<DraftOrderEntry[]>([]);
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [maxTeams, setMaxTeams] = useState<string>("8");
  const [maxTeamsInput, setMaxTeamsInput] = useState<string>("8");

  // UI state
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load draft order when season changes
  useEffect(() => {
    if (selectedSeasonId) {
      loadDraftOrder(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [seasonsResult, settingsResult] = await Promise.all([
        getSeasons(),
        getDraftSettings(),
      ]);

      setSeasons(seasonsResult.seasons);

      // Set max teams from settings
      const mt = settingsResult.settings.max_teams || "8";
      setMaxTeams(mt);
      setMaxTeamsInput(mt);

      // Auto-select active season
      const activeSeason = seasonsResult.seasons.find((s) => s.is_active);
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      } else if (seasonsResult.seasons.length > 0) {
        setSelectedSeasonId(seasonsResult.seasons[0].id);
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  const loadDraftOrder = async (seasonId: string) => {
    try {
      const { order, error } = await getDraftOrder(seasonId);
      if (error) {
        console.error("Error loading draft order:", error);
      }
      setDraftOrder(order);
    } catch (error) {
      console.error("Error loading draft order:", error);
    }
  };

  const handleViewStandings = async () => {
    if (!selectedSeasonId) return;

    // Get the selected season to find the previous one
    const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
    if (!selectedSeason) return;

    const previousSeason = seasons.find(
      (s) => s.season_number === selectedSeason.season_number - 1
    );

    if (!previousSeason) {
      setStandings([]);
      setShowStandings(true);
      setMessage({
        type: "error",
        text: `No previous season found (Season ${selectedSeason.season_number - 1}). For Season 1, all teams start with 0-0 records.`,
      });
      return;
    }

    try {
      const { standings: data, error } = await getSeasonStandings(
        previousSeason.id
      );
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }
      setStandings(data);
      setShowStandings(true);
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleGenerate = async () => {
    if (!selectedSeasonId) return;

    const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
    if (
      !confirm(
        `Generate draft order for ${selectedSeason?.season_name || "this season"}?\n\n` +
          `This will calculate pick order based on the previous season's standings.\n` +
          `Worst record picks first. Ties broken by random lottery numbers.`
      )
    ) {
      return;
    }

    setGenerating(true);
    setMessage(null);
    try {
      const result = await generateDraftOrder(selectedSeasonId);
      if (result.success) {
        setMessage({
          type: "success",
          text: result.message || "Draft order generated!",
        });
        setDraftOrder(result.order || []);
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to generate draft order",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedSeasonId) return;

    const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
    if (
      !confirm(
        `Re-roll draft order for ${selectedSeason?.season_name || "this season"}?\n\n` +
          `This will DELETE the current order, re-roll all lottery numbers, and recalculate.\n` +
          `The standings (win/loss records) will stay the same, but tiebreakers will change.`
      )
    ) {
      return;
    }

    setRegenerating(true);
    setMessage(null);
    try {
      const result = await regenerateDraftOrder(selectedSeasonId);
      if (result.success) {
        setMessage({
          type: "success",
          text: result.message || "Draft order regenerated with new lottery numbers!",
        });
        setDraftOrder(result.order || []);
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to regenerate draft order",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveMaxTeams = async () => {
    const value = parseInt(maxTeamsInput);
    if (isNaN(value) || value < 2 || value > 32) {
      setMessage({
        type: "error",
        text: "Max teams must be between 2 and 32",
      });
      return;
    }

    setSavingSettings(true);
    try {
      const result = await updateDraftSetting("max_teams", String(value));
      if (result.success) {
        setMaxTeams(String(value));
        setMessage({
          type: "success",
          text: `Max teams updated to ${value}`,
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to save setting",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setSavingSettings(false);
    }
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const previousSeason = selectedSeason
    ? seasons.find(
        (s) => s.season_number === selectedSeason.season_number - 1
      )
    : null;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Loading draft order system...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          🎯 Automated Draft Order
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Generate pick order based on previous season standings. Worst record picks first.
        </p>
      </div>

      {/* How It Works */}
      <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl">
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-3">
          📋 How It Works
        </h3>
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[40px]">1.</span>
            <span>
              Teams are ranked by their <strong>previous season</strong> record
              (worst to best)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[40px]">2.</span>
            <span>
              Each team gets a <strong>random lottery number</strong> (1 to{" "}
              {maxTeams})
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[40px]">3.</span>
            <span>
              If teams are <strong>tied in win%</strong>, the team with the{" "}
              <strong>lowest lottery number</strong> picks first
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[40px]">4.</span>
            <span>
              Season 1 teams all start 0-0, so order is <strong>purely lottery</strong>
            </span>
          </div>
        </div>
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
            <button
              onClick={() => setMessage(null)}
              className="text-sm opacity-70 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Settings Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          ⚙️ Draft Settings
        </h3>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Teams (lottery range)
            </label>
            <input
              type="number"
              min={2}
              max={32}
              value={maxTeamsInput}
              onChange={(e) => setMaxTeamsInput(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lottery numbers will range from 1 to this value. Adjust if teams
              are added or removed.
            </p>
          </div>
          <button
            onClick={handleSaveMaxTeams}
            disabled={savingSettings || maxTeamsInput === maxTeams}
            className="admin-btn admin-btn-secondary text-sm disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Season Selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          📅 Select Season
        </h3>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generate draft order for:
            </label>
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a season...</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.season_name} (Season {season.season_number})
                  {season.is_active ? " ★ Active" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedSeasonId && (
            <div className="text-sm text-gray-600 dark:text-gray-400 py-2">
              Based on:{" "}
              <strong>
                {previousSeason
                  ? `${previousSeason.season_name} standings`
                  : "No previous season (all 0-0)"}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {selectedSeasonId && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating || draftOrder.length > 0}
            className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6 disabled:opacity-50"
          >
            <span className="text-3xl">🎲</span>
            <span className="font-semibold">Generate Draft Order</span>
            <span className="text-sm opacity-90">
              {draftOrder.length > 0
                ? "Already generated"
                : "Calculate order & lottery"}
            </span>
          </button>

          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            disabled={regenerating || draftOrder.length === 0}
            className="admin-btn admin-btn-secondary flex flex-col items-center gap-2 py-6 disabled:opacity-50"
          >
            <span className="text-3xl">🔄</span>
            <span className="font-semibold">Re-Roll Lottery</span>
            <span className="text-sm opacity-90">
              New lottery numbers, same standings
            </span>
          </button>

          {/* View Previous Standings */}
          <button
            onClick={handleViewStandings}
            className="admin-btn admin-btn-secondary flex flex-col items-center gap-2 py-6"
          >
            <span className="text-3xl">📊</span>
            <span className="font-semibold">View Previous Standings</span>
            <span className="text-sm opacity-90">
              {previousSeason
                ? previousSeason.season_name
                : "No previous season"}
            </span>
          </button>
        </div>
      )}

      {/* Previous Season Standings */}
      {showStandings && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              📊 {previousSeason ? previousSeason.season_name : "Season 1"}{" "}
              Standings
            </h4>
            <button
              onClick={() => setShowStandings(false)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Hide
            </button>
          </div>
          {standings.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Team</th>
                  <th className="px-4 py-2 text-center font-semibold">W</th>
                  <th className="px-4 py-2 text-center font-semibold">L</th>
                  <th className="px-4 py-2 text-center font-semibold">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {standings.map((team, index) => (
                  <tr
                    key={team.team_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {team.emoji} {team.team_name}
                    </td>
                    <td className="px-4 py-2 text-center text-green-600 dark:text-green-400 font-semibold">
                      {team.wins}
                    </td>
                    <td className="px-4 py-2 text-center text-red-600 dark:text-red-400 font-semibold">
                      {team.losses}
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">
                      {team.win_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No standings available. All teams start 0-0 for Season 1.
            </div>
          )}
        </div>
      )}

      {/* Draft Order Results */}
      {draftOrder.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              🏆 {selectedSeason?.season_name} — Draft Order
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pick 1 drafts first (worst record). Teams with 🎲 had ties broken
              by lottery.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold w-16">
                    Pick
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Team</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Prev Record
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Win %
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Lottery #
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Tiebreaker?
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {draftOrder.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                      entry.pick_position === 1
                        ? "bg-yellow-50/50 dark:bg-yellow-900/10"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          entry.pick_position === 1
                            ? "bg-yellow-500 text-white"
                            : entry.pick_position === 2
                            ? "bg-gray-400 text-white"
                            : entry.pick_position === 3
                            ? "bg-amber-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {entry.pick_position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {entry.team?.emoji} {entry.team?.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        {entry.previous_season_wins}
                      </span>
                      <span className="text-gray-400 mx-1">-</span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        {entry.previous_season_losses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {Number(entry.previous_season_win_pct).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-sm">
                        {entry.lottery_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.is_lottery_winner ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          🎲 Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedSeasonId && draftOrder.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Draft Order Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Click &ldquo;Generate Draft Order&rdquo; to calculate pick positions based on{" "}
            {previousSeason
              ? `${previousSeason.season_name} standings`
              : "random lottery (Season 1)"}{" "}
            with random lottery tiebreakers.
          </p>
        </div>
      )}

      {/* No seasons warning */}
      {seasons.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Seasons Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create a season first in the Seasons tab before generating a draft
            order.
          </p>
        </div>
      )}
    </div>
  );
};
