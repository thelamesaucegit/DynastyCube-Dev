// src/app/components/TimezoneSelector.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TIMEZONES, getBrowserTimezone, getTimezoneOffset } from "@/utils/timezoneUtils";
import { getUserTimezone, updateUserTimezone } from "@/app/actions/userSettingsActions";

export const TimezoneSelector: React.FC = () => {
  const [currentTimezone, setCurrentTimezone] = useState<string>("UTC");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserTimezone, setBrowserTimezone] = useState<string>("");

  useEffect(() => {
    loadTimezone();
    setBrowserTimezone(getBrowserTimezone());
  }, []);

  const loadTimezone = async () => {
    setLoading(true);
    try {
      const { timezone, error: fetchError } = await getUserTimezone();
      if (fetchError) {
        setError(fetchError);
      } else {
        const tz = timezone || "UTC";
        setCurrentTimezone(tz);
        setSelectedTimezone(tz);
      }
    } catch (err) {
      console.error("Error loading timezone:", err);
      setError("Failed to load timezone preference");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedTimezone === currentTimezone) {
      return; // No change
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { success: updateSuccess, error: updateError } =
        await updateUserTimezone(selectedTimezone);

      if (updateSuccess) {
        setCurrentTimezone(selectedTimezone);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(updateError || "Failed to update timezone");
      }
    } catch (err) {
      console.error("Error saving timezone:", err);
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleUseBrowserTimezone = () => {
    setSelectedTimezone(browserTimezone);
  };

  const hasChanges = selectedTimezone !== currentTimezone;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Timezone Settings
        </h3>
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Loading timezone settings...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
        🌍 Timezone Settings
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Set your timezone to see all times in your local time. This affects notifications,
        messages, deadlines, and game schedules.
      </p>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
          ✓ Timezone updated successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          ✗ {error}
        </div>
      )}

      {/* Browser Timezone Detection */}
      {browserTimezone && browserTimezone !== selectedTimezone && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Detected timezone:</strong> {browserTimezone}
              <br />
              <span className="text-xs">({getTimezoneOffset(browserTimezone)})</span>
            </div>
            <button
              onClick={handleUseBrowserTimezone}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium transition-colors"
            >
              Use This
            </button>
          </div>
        </div>
      )}

      {/* Timezone Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
          Select Your Timezone
        </label>
        <select
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label} ({tz.offset})
            </option>
          ))}
        </select>

        {/* Current Time Preview */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Current time in {selectedTimezone}:</strong>{" "}
          {new Intl.DateTimeFormat("en-US", {
            timeZone: selectedTimezone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date())}
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving..." : "Save Timezone"}
        </button>
        {hasChanges && (
          <button
            onClick={() => setSelectedTimezone(currentTimezone)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
