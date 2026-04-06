// src/app/components/admin/TradeSettings.tsx
"use client";

import React, { useState, useEffect } from "react";
import { areTradesEnabled, setTradesEnabled } from "@/app/actions/tradeActions";

export const TradeSettings: React.FC = () => {
  const [tradesEnabled, setTradesEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { enabled, error: loadError } = await areTradesEnabled();
      if (loadError) {
        setError(loadError);
      } else {
        setTradesEnabledState(enabled);
      }
    } catch (err) {
      console.error("Error loading trade settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTrades = async () => {
    if (!confirm(`Are you sure you want to ${tradesEnabled ? "disable" : "enable"} trades?`)) {
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const { success: updateSuccess, error: updateError } = await setTradesEnabled(!tradesEnabled);

      if (updateSuccess) {
        setTradesEnabledState(!tradesEnabled);
        setSuccess(`Trades ${!tradesEnabled ? "enabled" : "disabled"} successfully!`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(updateError || "Failed to update setting");
      }
    } catch (err) {
      console.error("Error toggling trades:", err);
      setError("Failed to toggle trades");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <span>🔄</span>
            Trade System
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Control whether teams can create and accept trades
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${tradesEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {tradesEnabled ? "ENABLED" : "DISABLED"}
          </span>
          <button
            onClick={handleToggleTrades}
            disabled={updating}
            className={`
              relative inline-flex h-8 w-14 items-center rounded-full transition-colors
              ${tradesEnabled ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}
              ${updating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <span
              className={`
                inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                ${tradesEnabled ? "translate-x-7" : "translate-x-1"}
              `}
            />
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
          ✓ {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          ✗ {error}
        </div>
      )}

      {/* Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          How Trade System Works
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
          <li>Teams can propose trades with cards and future draft picks</li>
          <li>Captains and Brokers receive notifications about trades</li>
          <li>Trades have deadlines (1-7 days) and auto-expire</li>
          <li>Built-in message system for negotiations</li>
          <li>When disabled, no new trades can be created</li>
        </ul>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">-</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Pending Trades</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">-</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">-</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">This Week</div>
        </div>
      </div>
    </div>
  );
};
