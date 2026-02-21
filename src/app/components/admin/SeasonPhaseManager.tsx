// src/app/components/admin/SeasonPhaseManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getCurrentSeason,
  updateSeasonPhase,
  type Season,
} from "@/app/actions/seasonPhaseActions";
import {
  createDraftSession,
  getActiveDraftSession,
  type DraftSessionWithStatus,
} from "@/app/actions/draftSessionActions";
import { getActiveDraftOrder } from "@/app/actions/draftOrderActions";
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

  // Draft modal state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [activeSession, setActiveSession] = useState<DraftSessionWithStatus | null>(null);
  const [draftOrderCount, setDraftOrderCount] = useState<number | null>(null);
  const [totalRounds, setTotalRounds] = useState("45");
  const [hoursPerPick, setHoursPerPick] = useState("24");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);

  const phases: SeasonPhase[] = ["preseason", "draft", "season", "playoffs", "postseason"];

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

    // Draft phase opens the settings modal instead of transitioning directly
    if (newPhase === "draft") {
      setDraftLoading(true);
      try {
        const [sessionRes, orderRes] = await Promise.all([
          getActiveDraftSession(),
          getActiveDraftOrder(),
        ]);
        setActiveSession(sessionRes.session);
        setDraftOrderCount(orderRes.order.length);
      } catch (err) {
        console.error("Error loading draft data:", err);
      } finally {
        setDraftLoading(false);
      }
      setShowDraftModal(true);
      return;
    }

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

  const handleScheduleDraft = async () => {
    if (!season) return;
    if (!startDate || !startTime) {
      setError("Start date and time are required.");
      return;
    }

    const rounds = parseInt(totalRounds);
    const hours = parseFloat(hoursPerPick);

    if (isNaN(rounds) || rounds < 1 || rounds > 999) {
      setError("Total rounds must be between 1 and 999.");
      return;
    }
    if (isNaN(hours) || hours < 0.5 || hours > 168) {
      setError("Hours per pick must be between 0.5 and 168.");
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : undefined;

    setDraftLoading(true);
    setError(null);

    try {
      // 1. Create the draft session
      const sessionResult = await createDraftSession({
        totalRounds: rounds,
        hoursPerPick: hours,
        startTime: startISO,
        endTime: endISO,
      });

      if (!sessionResult.success) {
        setError(sessionResult.error || "Failed to create draft session.");
        setDraftLoading(false);
        return;
      }

      // 2. Transition the season phase to "draft"
      const phaseResult = await updateSeasonPhase(season.id, "draft");

      if (!phaseResult.success) {
        setError(phaseResult.error || "Draft session created but failed to update season phase.");
        setDraftLoading(false);
        return;
      }

      setShowDraftModal(false);
      resetDraftForm();
      setSuccess(
        `Draft scheduled! ${phaseResult.notificationsSent || 0} users notified. Season is now in Draft phase.`
      );
      await loadSeason();
      setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      console.error("Error scheduling draft:", err);
      setError("An unexpected error occurred.");
    } finally {
      setDraftLoading(false);
    }
  };

  const resetDraftForm = () => {
    setTotalRounds("45");
    setHoursPerPick("24");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setDraftOrderCount(null);
    setActiveSession(null);
  };

  const handleCancelModal = () => {
    setShowDraftModal(false);
    resetDraftForm();
    setError(null);
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
      {error && !showDraftModal && (
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

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {phases.map((phase) => {
            const isCurrent = season.phase === phase;
            const isDraft = phase === "draft";

            return (
              <button
                key={phase}
                onClick={() => handlePhaseChange(phase)}
                disabled={isCurrent || updating || draftLoading}
                className={`p-6 rounded-lg border-2 transition-all text-center relative ${
                  isCurrent
                    ? `${getPhaseColor(phase)} cursor-not-allowed`
                    : updating || draftLoading
                      ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50"
                      : isDraft
                        ? "border-green-300 dark:border-green-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer hover:scale-105 active:scale-100"
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
                {isDraft && !isCurrent && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Configure &amp; Schedule
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Draft Settings Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCancelModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🃏</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">Schedule Draft</h2>
                    <p className="text-green-100 text-sm">
                      Configure draft settings before initiating
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelModal}
                  className="text-white/80 hover:text-white text-2xl font-light leading-none transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* No draft order — hard blocker */}
              {draftOrderCount === 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🚫</span>
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100 text-sm">
                        No draft order found for the active season
                      </p>
                      <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                        Please generate a draft order in the <strong>Draft Order</strong> admin tab before scheduling a draft.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Draft order OK — show count */}
              {draftOrderCount !== null && draftOrderCount > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
                    <span>✓</span>
                    <span>Draft order found: <strong>{draftOrderCount} teams</strong> in queue</span>
                  </div>
                </div>
              )}

              {/* Existing session warning */}
              {activeSession && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm">
                        An existing draft session is already {activeSession.status}
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                        Complete or delete it from the <strong>Draft Session</strong> admin tab before creating a new one.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error inside modal */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <span>✗</span>
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </div>
              )}

              {/* Start Date/Time */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                  Draft Start
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* End Date/Time */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                  Draft End <span className="text-gray-400 font-normal normal-case">(optional hard deadline)</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rounds & Pick Timer */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                  Draft Rules
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Rounds
                    </label>
                    <input
                      type="number"
                      value={totalRounds}
                      onChange={(e) => setTotalRounds(e.target.value)}
                      min="1"
                      max="999"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Picks per team (e.g. 45)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hours Per Pick
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={hoursPerPick}
                      onChange={(e) => setHoursPerPick(e.target.value)}
                      min="0.5"
                      max="168"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Auto-draft triggers after this time
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <span className="font-semibold">Summary:</span>{" "}
                  {parseInt(totalRounds) || 0} rounds, {parseFloat(hoursPerPick) || 0}h per pick.{" "}
                  Draft {startDate && startTime
                    ? `starts ${new Date(`${startDate}T${startTime}`).toLocaleString()}`
                    : "start time not set"}.{" "}
                  {endDate && endTime
                    ? `Ends ${new Date(`${endDate}T${endTime}`).toLocaleString()}.`
                    : "No hard end deadline."}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={handleCancelModal}
                disabled={draftLoading}
                className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleDraft}
                disabled={draftLoading || !startDate || !startTime || draftOrderCount === 0 || !!activeSession}
                className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center gap-2"
              >
                {draftLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    🃏 Schedule &amp; Initiate Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              The <strong>Draft</strong> phase will open a configuration menu to set draft length, rounds, and pick timer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
