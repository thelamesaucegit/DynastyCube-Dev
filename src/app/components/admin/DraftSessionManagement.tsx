// src/app/components/admin/DraftSessionManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  createDraftSession,
  getActiveDraftSession,
  getDraftSessions,
  updateDraftSession,
  deleteDraftSession,
  activateDraft,
  pauseDraft,
  resumeDraft,
  completeDraft,
  checkDraftTimer,
  type DraftSession,
  type DraftSessionWithStatus,
} from "@/app/actions/draftSessionActions";
import { getActiveDraftOrder, type DraftOrderEntry } from "@/app/actions/draftOrderActions";

export const DraftSessionManagement: React.FC = () => {
  // Data state
  const [activeSession, setActiveSession] = useState<DraftSessionWithStatus | null>(null);
  const [allSessions, setAllSessions] = useState<DraftSession[]>([]);
  const [draftOrder, setDraftOrder] = useState<DraftOrderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [totalRounds, setTotalRounds] = useState("45");
  const [hoursPerPick, setHoursPerPick] = useState("24");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // Edit state
  const [editingHours, setEditingHours] = useState(false);
  const [editHoursValue, setEditHoursValue] = useState("");

  // UI state
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Countdown timer state
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  // Live countdown timer
  useEffect(() => {
    if (!activeSession?.current_pick_deadline || activeSession.status !== "active") {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const deadline = new Date(activeSession.current_pick_deadline!).getTime();
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setCountdown("Auto-draft imminent...");
        // Trigger a timer check
        checkDraftTimer().then(() => loadData());
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionRes, sessionsRes, orderRes] = await Promise.all([
        getActiveDraftSession(),
        getDraftSessions(),
        getActiveDraftOrder(),
      ]);

      setActiveSession(sessionRes.session);
      setAllSessions(sessionsRes.sessions);
      setDraftOrder(orderRes.order);
    } catch (error) {
      console.error("Error loading draft session data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!startDate || !startTime) {
      setMessage({ type: "error", text: "Start date and time are required" });
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : undefined;

    setActionLoading(true);
    try {
      const result = await createDraftSession({
        totalRounds: parseInt(totalRounds) || 45,
        hoursPerPick: parseFloat(hoursPerPick) || 24,
        startTime: startISO,
        endTime: endISO,
      });

      if (result.success) {
        setMessage({ type: "success", text: "Draft session created successfully!" });
        setShowCreateForm(false);
        resetForm();
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to create draft session" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setTotalRounds("45");
    setHoursPerPick("24");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
  };

  const handleActivate = async (sessionId: string) => {
    if (!confirm("Start the draft now? This will notify all players.")) return;
    setActionLoading(true);
    try {
      const result = await activateDraft(sessionId);
      if (result.success) {
        setMessage({ type: "success", text: "Draft activated! All players have been notified." });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to activate draft" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (sessionId: string) => {
    if (!confirm("Pause the draft? The pick timer will be stopped.")) return;
    setActionLoading(true);
    try {
      const result = await pauseDraft(sessionId);
      if (result.success) {
        setMessage({ type: "success", text: "Draft paused." });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to pause draft" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (sessionId: string) => {
    if (!confirm("Resume the draft? The pick timer will restart.")) return;
    setActionLoading(true);
    try {
      const result = await resumeDraft(sessionId);
      if (result.success) {
        setMessage({ type: "success", text: "Draft resumed! Timer restarted." });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to resume draft" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (sessionId: string) => {
    if (!confirm("End the draft early? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const result = await completeDraft(sessionId);
      if (result.success) {
        setMessage({ type: "success", text: "Draft completed." });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to complete draft" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Delete this scheduled draft session?")) return;
    setActionLoading(true);
    try {
      const result = await deleteDraftSession(sessionId);
      if (result.success) {
        setMessage({ type: "success", text: "Draft session deleted." });
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to delete session" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateHours = async (sessionId: string) => {
    const newHours = parseFloat(editHoursValue);
    if (isNaN(newHours) || newHours < 0.5 || newHours > 168) {
      setMessage({ type: "error", text: "Hours must be between 0.5 and 168" });
      return;
    }
    setActionLoading(true);
    try {
      const result = await updateDraftSession(sessionId, { hoursPerPick: newHours });
      if (result.success) {
        setMessage({ type: "success", text: `Hours per pick updated to ${newHours}` });
        setEditingHours(false);
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to update" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
            Scheduled
          </span>
        );
      case "active":
        return (
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium animate-pulse">
            Live
          </span>
        );
      case "paused":
        return (
          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-medium">
            Paused
          </span>
        );
      case "completed":
        return (
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-sm font-medium">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading draft session data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Draft Sessions</h2>
        <p className="admin-section-description">
          Schedule and manage draft sessions. Set start/end times and per-pick timer for auto-draft.
        </p>
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
            <button onClick={() => setMessage(null)} className="text-sm opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active / Current Session Panel */}
      {activeSession && (
        <div
          className={`mb-6 p-5 rounded-lg border-2 ${
            activeSession.status === "active"
              ? "border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10"
              : activeSession.status === "paused"
              ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/10"
              : "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Current Draft Session
            </h3>
            {getStatusBadge(activeSession.status)}
          </div>

          {/* Session Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Start</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDateTime(activeSession.start_time)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">End</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {activeSession.end_time ? formatDateTime(activeSession.end_time) : "No deadline"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Rounds</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {activeSession.draftStatus
                  ? `Round ${activeSession.draftStatus.currentRound} of ${activeSession.total_rounds}`
                  : activeSession.total_rounds}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Hours/Pick</div>
              {editingHours ? (
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    step="0.5"
                    value={editHoursValue}
                    onChange={(e) => setEditHoursValue(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdateHours(activeSession.id)}
                    disabled={actionLoading}
                    className="admin-btn admin-btn-primary text-xs py-1 px-2"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingHours(false)}
                    className="admin-btn admin-btn-secondary text-xs py-1 px-2"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600"
                  onClick={() => {
                    setEditHoursValue(String(activeSession.hours_per_pick));
                    setEditingHours(true);
                  }}
                  title="Click to edit"
                >
                  {activeSession.hours_per_pick}h
                </div>
              )}
            </div>
          </div>

          {/* On the Clock / Pick Deadline */}
          {activeSession.status === "active" && activeSession.draftStatus && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{activeSession.draftStatus.onTheClock.teamEmoji}</span>
                    <span className="font-bold text-amber-900 dark:text-amber-100 text-lg">
                      {activeSession.draftStatus.onTheClock.teamName}
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 text-sm">is on the clock</span>
                  </div>
                  {activeSession.draftStatus.onDeck && (
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      On Deck: {activeSession.draftStatus.onDeck.teamEmoji} {activeSession.draftStatus.onDeck.teamName}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                    Auto-draft in
                  </div>
                  <div className="text-2xl font-mono font-bold text-amber-900 dark:text-amber-100">
                    {countdown || "..."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scheduled - waiting to start */}
          {activeSession.status === "scheduled" && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Draft is scheduled to start at {formatDateTime(activeSession.start_time)}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    The draft will activate automatically at the scheduled time, or you can start it manually.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Paused message */}
          {activeSession.status === "paused" && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Draft is paused. Pick timers are frozen.
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Resume the draft to restart the pick timer.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {activeSession.status === "scheduled" && (
              <>
                <button
                  onClick={() => handleActivate(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-primary"
                >
                  {actionLoading ? "Starting..." : "Start Draft Now"}
                </button>
                <button
                  onClick={() => handleDelete(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-danger"
                >
                  Delete
                </button>
              </>
            )}
            {activeSession.status === "active" && (
              <>
                <button
                  onClick={() => handlePause(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-secondary"
                >
                  {actionLoading ? "Pausing..." : "Pause Draft"}
                </button>
                <button
                  onClick={() => handleComplete(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-danger"
                >
                  {actionLoading ? "Ending..." : "End Draft Early"}
                </button>
              </>
            )}
            {activeSession.status === "paused" && (
              <>
                <button
                  onClick={() => handleResume(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-primary"
                >
                  {actionLoading ? "Resuming..." : "Resume Draft"}
                </button>
                <button
                  onClick={() => handleComplete(activeSession.id)}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-danger"
                >
                  {actionLoading ? "Ending..." : "End Draft Early"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create New Session */}
      {!activeSession && (
        <div className="mb-6">
          {showCreateForm ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Schedule New Draft
              </h3>

              {/* Draft Order Preview */}
              {draftOrder.length > 0 ? (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draft Order:</p>
                  <div className="flex flex-wrap gap-2">
                    {draftOrder.map((entry) => {
                      const team = Array.isArray(entry.team) ? entry.team[0] : entry.team;
                      return (
                        <span
                          key={entry.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm"
                        >
                          <span className="font-bold text-gray-500 dark:text-gray-400 text-xs">
                            {entry.pick_position}.
                          </span>
                          <span>{team?.emoji}</span>
                          <span className="text-gray-900 dark:text-gray-100">{team?.name}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    No draft order found. Please generate a draft order in the Draft Order tab first.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Start Date/Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* End Date/Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Rounds */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Total Rounds (picks per team)
                  </label>
                  <input
                    type="number"
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(e.target.value)}
                    min="1"
                    max="999"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total picks = {parseInt(totalRounds) || 0} rounds × {draftOrder.length || 8} teams = {(parseInt(totalRounds) || 0) * (draftOrder.length || 8)} picks
                  </p>
                </div>

                {/* Hours per Pick */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hours Per Pick (auto-draft timer)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={hoursPerPick}
                    onChange={(e) => setHoursPerPick(e.target.value)}
                    min="0.5"
                    max="168"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    If a team doesn&apos;t pick within this time, auto-draft will take over
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={actionLoading || draftOrder.length === 0}
                  className="admin-btn admin-btn-primary"
                >
                  {actionLoading ? "Creating..." : "Schedule Draft"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="admin-btn admin-btn-primary"
            >
              + Schedule New Draft
            </button>
          )}
        </div>
      )}

      {/* Session History */}
      {allSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Draft Session History
          </h3>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Start</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">End</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Rounds</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Hours/Pick</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">{getStatusBadge(session.status)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                        {formatDateTime(session.start_time)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                        {session.end_time ? formatDateTime(session.end_time) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900 dark:text-gray-100">
                        {session.total_rounds}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900 dark:text-gray-100">
                        {session.hours_per_pick}h
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {formatDateTime(session.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
