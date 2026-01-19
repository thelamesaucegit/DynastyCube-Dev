// src/app/components/admin/SeasonPhaseManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getCurrentSeason,
  updateSeasonPhase,
  type Season,
} from "@/app/actions/seasonPhaseActions";
import {
  getPhaseDisplayName,
  getPhaseIcon,
  getPhaseColor,
  type SeasonPhase,
} from "@/utils/seasonPhaseUtils";

export const SeasonPhaseManager: React.FC = () => {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phases: SeasonPhase[] = ["preseason", "season", "playoffs", "postseason"];

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    setLoading(true);
    try {
      const result = await getCurrentSeason();
      if (result.success && result.season) {
        setSeason(result.season);
      } else if (!result.season) {
        setError("No active season found. Please create a season first.");
      }
    } catch (err) {
      console.error("Error loading season:", err);
      setError("Failed to load season");
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = async (newPhase: SeasonPhase) => {
    if (!season || season.phase === newPhase) return;

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateSeasonPhase(season.id, newPhase);

      if (result.success) {
        setSuccess(
          `Season phase updated to ${getPhaseDisplayName(newPhase)}! ${result.notificationsSent || 0} users notified.`
        );
        await loadSeason();

        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || "Failed to update phase");
      }
    } catch (err) {
      console.error("Error updating phase:", err);
      setError("An error occurred while updating the phase");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading season...</span>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Active Season
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {error || "Please create an active season before managing phases."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Season Info */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {season.name || (season.season_number ? `Season ${season.season_number}` : "Current Season")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(season.start_date).toLocaleDateString()} -{" "}
              {new Date(season.end_date).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Current Phase
            </div>
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-lg ${getPhaseColor(season.phase)}`}
            >
              <span className="text-2xl">{getPhaseIcon(season.phase)}</span>
              <span>{getPhaseDisplayName(season.phase)}</span>
            </div>
          </div>
        </div>

        {season.phase_changed_at && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last changed: {new Date(season.phase_changed_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <span className="text-2xl">✓</span>
            <span className="font-semibold">{success}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <span className="text-2xl">✗</span>
            <span className="font-semibold">{error}</span>
          </div>
        </div>
      )}

      {/* Phase Selection */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Change Season Phase
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Select a new phase to transition the season. All users will be notified of the change.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {phases.map((phase) => {
            const isCurrent = season.phase === phase;

            return (
              <button
                key={phase}
                onClick={() => handlePhaseChange(phase)}
                disabled={isCurrent || updating}
                className={`p-6 rounded-lg border-2 transition-all text-center ${
                  isCurrent
                    ? `${getPhaseColor(phase)} cursor-not-allowed`
                    : updating
                      ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer hover:scale-105 active:scale-100"
                }`}
              >
                <div className="text-5xl mb-3">{getPhaseIcon(phase)}</div>
                <div className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
                  {getPhaseDisplayName(phase)}
                </div>
                {isCurrent && (
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
                    Current
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-1">
              Important Note
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Changing the season phase will send notifications to <strong>all users</strong> in the system.
              Make sure you&apos;re ready to transition to the next phase before clicking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
