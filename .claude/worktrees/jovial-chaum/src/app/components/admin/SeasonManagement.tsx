// src/app/components/admin/SeasonManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getSeasons,
  createSeason,
  activateSeason,
  type Season,
} from "@/app/actions/cubucksActions";
import {
  rolloverSeasonCosts,
  initializeSeasonCosts,
  type CardCostChange,
} from "@/app/actions/seasonActions";
import { SeasonPhaseManager } from "./SeasonPhaseManager";
import { WeekCreator } from "./WeekCreator";
import { MatchScheduler } from "./MatchScheduler";
import { ScheduleOverview } from "./ScheduleOverview";
import { MatchExtensionManager } from "./MatchExtensionManager";

type SeasonSubTab = "management" | "schedule";

export const SeasonManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SeasonSubTab>("management");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // New season form
  const [newSeasonNumber, setNewSeasonNumber] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [cubucksAllocation, setCubucksAllocation] = useState("1000");
  const [creating, setCreating] = useState(false);

  // Rollover state
  const [rollingOver, setRollingOver] = useState(false);
  const [rolloverChanges, setRolloverChanges] = useState<CardCostChange[]>([]);
  const [showRolloverDetails, setShowRolloverDetails] = useState(false);

  useEffect(() => {
    loadSeasons();
  }, []);

  const loadSeasons = async () => {
    setLoading(true);
    try {
      const { seasons: data } = await getSeasons();
      setSeasons(data);
    } catch (error) {
      console.error("Error loading seasons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeason = async () => {
    const seasonNum = parseInt(newSeasonNumber);
    const allocation = parseInt(cubucksAllocation);

    if (isNaN(seasonNum) || !newSeasonName || isNaN(allocation)) {
      setMessage({ type: "error", text: "Please fill in all fields correctly" });
      return;
    }

    setCreating(true);
    try {
      const result = await createSeason(seasonNum, newSeasonName, allocation);
      if (result.success) {
        setMessage({ type: "success", text: `Season ${seasonNum} created successfully!` });
        setNewSeasonNumber("");
        setNewSeasonName("");
        setCubucksAllocation("1000");
        loadSeasons();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to create season" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setCreating(false);
    }
  };

  const handleActivateSeason = async (seasonId: string) => {
    if (!confirm("Activate this season? This will deactivate all other seasons.")) {
      return;
    }

    try {
      const result = await activateSeason(seasonId);
      if (result.success) {
        setMessage({ type: "success", text: "Season activated successfully!" });
        loadSeasons();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to activate season" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleRolloverCosts = async () => {
    const activeSeason = seasons.find((s) => s.is_active);
    if (!activeSeason) {
      setMessage({ type: "error", text: "No active season found" });
      return;
    }

    // Find previous season
    const previousSeason = seasons
      .filter((s) => s.season_number < activeSeason.season_number)
      .sort((a, b) => b.season_number - a.season_number)[0];

    if (!previousSeason) {
      setMessage({
        type: "error",
        text: "No previous season found. Use Initialize instead for Season 1.",
      });
      return;
    }

    if (
      !confirm(
        `Roll over card costs from ${previousSeason.season_name} to ${activeSeason.season_name}?\n\n` +
          `- Drafted cards: cost +1\n` +
          `- Undrafted cards: cost -1 (min 1)\n\n` +
          `This cannot be undone!`
      )
    ) {
      return;
    }

    setRollingOver(true);
    try {
      const result = await rolloverSeasonCosts(activeSeason.id, previousSeason.id);
      if (result.success && result.changes) {
        const changes = result.changes as CardCostChange[];
        setRolloverChanges(changes);
        setShowRolloverDetails(true);

        const increased = changes.filter((c) => c.new_cost > c.old_cost).length;
        const decreased = changes.filter((c) => c.new_cost < c.old_cost).length;
        const unchanged = changes.filter((c) => c.new_cost === c.old_cost).length;

        setMessage({
          type: "success",
          text: `Rollover complete! ${increased} increased, ${decreased} decreased, ${unchanged} unchanged`,
        });
      } else {
        setMessage({ type: "error", text: result.error || "Rollover failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setRollingOver(false);
    }
  };

  const handleInitializeCosts = async () => {
    if (
      !confirm(
        "Initialize all cards to 1 Cubuck for the current season?\n\n" +
          "This is typically only done for Season 1.\n\n" +
          "This will overwrite any existing costs!"
      )
    ) {
      return;
    }

    try {
      const result = await initializeSeasonCosts();
      if (result.success) {
        setMessage({
          type: "success",
          text: "All cards initialized to 1 Cubuck!",
        });
      } else {
        setMessage({ type: "error", text: result.error || "Initialization failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading seasons...</p>
        </div>
      </div>
    );
  }

  const activeSeason = seasons.find((s) => s.is_active);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">🏆 Season Management</h2>
        <p className="admin-section-description">
          Manage seasons, scheduling, and dynamic card pricing
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSubTab("management")}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSubTab === "management"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            📊 Season Management
          </button>
          <button
            onClick={() => setActiveSubTab("schedule")}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeSubTab === "schedule"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            🗓️ Schedule
          </button>
        </div>
      </div>

      {/* Season Management Tab */}
      {activeSubTab === "management" && (
        <>
          {/* Season Phase Manager */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Season Phase Control
            </h3>
            <SeasonPhaseManager />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
              }`}
            >
              <div className="flex justify-between items-start">
                <p>{message.text}</p>
                <button
                  onClick={() => setMessage(null)}
                  className="text-sm opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Pricing Info */}
          <div className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl">
            <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-3">
              💡 Dynamic Pricing System
            </h3>
            <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
              <div className="flex items-start gap-2">
                <span className="font-semibold min-w-[120px]">Starting Cost:</span>
                <span>All cards begin at 1 Cubuck</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold min-w-[120px]">If Drafted:</span>
                <span>Cost increases by +1 Cubuck next season</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold min-w-[120px]">If Undrafted:</span>
                <span>Cost decreases by -1 Cubuck next season (minimum 1)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold min-w-[120px]">Result:</span>
                <span>Popular cards become expensive, unpopular cards stay cheap!</span>
              </div>
            </div>
          </div>

          {/* Active Season */}
          {activeSeason && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {activeSeason.season_name} (Season {activeSeason.season_number})
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Allocation: {activeSeason.cubucks_allocation} Cubucks per team
                  </p>
                </div>
                <span className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
            </div>
          )}

            {/* Season Actions */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={handleRolloverCosts}
                disabled={rollingOver || !activeSeason}
                className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6"
              >
                <span className="text-3xl">🔄</span>
                <span className="font-semibold">Rollover Card Costs</span>
                <span className="text-sm opacity-90">
                  Calculate new costs for active season
                </span>
              </button>
  
              <button
                onClick={handleInitializeCosts}
                disabled={!activeSeason}
                className="admin-btn admin-btn-secondary flex flex-col items-center gap-2 py-6"
              >
                <span className="text-3xl">🎯</span>
                <span className="font-semibold">Initialize All Cards</span>
                <span className="text-sm opacity-90">
                  Set all cards to 1 Cubuck (Season 1 only)
                </span>
              </button>
            </div>
  
            {/* Rollover Details */}
            {showRolloverDetails && rolloverChanges.length > 0 && (
              <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Rollover Changes ({rolloverChanges.length} cards)
                  </h4>
                  <button
                    onClick={() => setShowRolloverDetails(false)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Hide
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Card</th>
                        <th className="px-4 py-2 text-center font-semibold">Old Cost</th>
                        <th className="px-4 py-2 text-center font-semibold">New Cost</th>
                        <th className="px-4 py-2 text-center font-semibold">Change</th>
                        <th className="px-4 py-2 text-center font-semibold">Drafted?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {rolloverChanges.map((change, idx) => {
                        const diff = change.new_cost - change.old_cost;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                              {change.card_name}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">
                              {change.old_cost} 💰
                            </td>
                            <td className="px-4 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">
                              {change.new_cost} 💰
                            </td>
                            <td
                              className={`px-4 py-2 text-center font-semibold ${
                                diff > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : diff < 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff < 0 ? diff : "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {change.was_drafted ? (
                                <span className="text-green-600 dark:text-green-400">✓ Yes</span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-500">✗ No</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
  
            {/* Create New Season */}
            <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Create New Season
              </h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Season Number
                  </label>
                  <input
                    type="number"
                    value={newSeasonNumber}
                    onChange={(e) => setNewSeasonNumber(e.target.value)}
                    placeholder="2"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Season Name
                  </label>
                  <input
                    type="text"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="Season 2"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cubucks Allocation
                  </label>
                  <input
                    type="number"
                    value={cubucksAllocation}
                    onChange={(e) => setCubucksAllocation(e.target.value)}
                    placeholder="1000"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateSeason}
                disabled={creating}
                className="admin-btn admin-btn-primary"
              >
                {creating ? "Creating..." : "Create Season"}
              </button>
            </div>
  
            {/* Seasons List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                All Seasons
              </h3>
              <div className="space-y-3">
                {seasons.map((season) => (
                  <div
                    key={season.id}
                    className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                      season.is_active
                        ? "border-blue-500 dark:border-blue-400 shadow-md"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {season.season_name}
                          </h4>
                          {season.is_active && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Season {season.season_number} • {season.cubucks_allocation} Cubucks per
                          team
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Started: {new Date(season.start_date).toLocaleDateString()}
                        </div>
                      </div>
                      {!season.is_active && (
                        <button
                          onClick={() => handleActivateSeason(season.id)}
                          className="admin-btn admin-btn-secondary text-sm"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </>
      )}

      {/* Schedule Tab */}
      {activeSubTab === "schedule" && activeSeason && (
        <div className="space-y-8">
          {/* Schedule Overview with Tabs */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <ScheduleTabContent seasonId={activeSeason.id} />
          </div>
        </div>
      )}

      {/* No Active Season Warning */}
      {activeSubTab === "schedule" && !activeSeason && (
        <div className="text-center py-12">
          <div className="mb-4 text-6xl">📅</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Active Season
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please create and activate a season first before managing the schedule.
          </p>
          <button
            onClick={() => setActiveSubTab("management")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go to Season Management
          </button>
        </div>
      )}
    </div>
  );
};

// Sub-component for Schedule Tab Content
const ScheduleTabContent: React.FC<{ seasonId: string }> = ({ seasonId }) => {
  const [scheduleTab, setScheduleTab] = useState<"overview" | "create-week" | "schedule-matches" | "extensions">("overview");

  return (
    <>
      {/* Schedule Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setScheduleTab("overview")}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
            scheduleTab === "overview"
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          📋 Schedule Overview
        </button>
        <button
          onClick={() => setScheduleTab("create-week")}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
            scheduleTab === "create-week"
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          ➕ Create Week
        </button>
        <button
          onClick={() => setScheduleTab("schedule-matches")}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
            scheduleTab === "schedule-matches"
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          🎮 Schedule Matches
        </button>
        <button
          onClick={() => setScheduleTab("extensions")}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
            scheduleTab === "extensions"
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          ⏰ Extensions
        </button>
      </div>

      {/* Schedule Content */}
      <div className="p-6">
        {scheduleTab === "overview" && <ScheduleOverview seasonId={seasonId} />}
        {scheduleTab === "create-week" && <WeekCreator seasonId={seasonId} />}
        {scheduleTab === "schedule-matches" && <MatchScheduler seasonId={seasonId} />}
        {scheduleTab === "extensions" && <MatchExtensionManager seasonId={seasonId} />}
      </div>
    </>
  );
};
