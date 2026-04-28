// src/app/components/admin/FullSeasonScheduler.tsx

"use client";

import React, { useState, useTransition, useEffect } from "react";
import { generateFullSeasonSchedule } from "@/app/actions/seasonSchedulerActions";
import { getScheduleWeeks } from "@/app/actions/scheduleActions";
import { getActiveSeasonDetails } from "@/app/actions/scheduleActions";

interface FullSeasonSchedulerProps {
  seasonId: string;
  onScheduleGenerated?: () => void;
}

// This component now fetches its own configuration, making it more robust.
export const FullSeasonScheduler: React.FC<FullSeasonSchedulerProps> = ({
  seasonId,
  onScheduleGenerated,
}) => {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // NEW STATE: To hold the configuration fetched from the database.
  const [config, setConfig] = useState<{
    regularSeasonWeeks: number;
    includeRivalsWeek: boolean;
    isReady: boolean;
    error?: string;
  } | null>(null);

  // NEW EFFECT: Fetches the required configuration when the component mounts.
  useEffect(() => {
    async function loadSchedulerConfig() {
      // Fetch both the created weeks and the season's rival setting in parallel.
      const [weeksResult, seasonResult] = await Promise.all([
        getScheduleWeeks(seasonId),
        getActiveSeasonDetails(),
      ]);

      // Handle errors from either fetch.
      if (weeksResult.error || !weeksResult.weeks) {
        setConfig({
          isReady: false,
          error: `Could not load weeks: ${weeksResult.error || "No weeks found."}`,
          regularSeasonWeeks: 0,
          includeRivalsWeek: false
        });
        return;
      }
      if (seasonResult.error || !seasonResult.season) {
        setConfig({
          isReady: false,
          error: `Could not load season config: ${seasonResult.error || "No active season found."}`,
          regularSeasonWeeks: 0,
          includeRivalsWeek: false
        });
        return;
      }

      // Logic to determine the number of regular season weeks based on fetched data.
      const regularWeeksCount = weeksResult.weeks.filter(
        w => !w.is_playoff_week && !w.is_championship_week
      ).length;
      
      setConfig({
        regularSeasonWeeks: regularWeeksCount,
        includeRivalsWeek: seasonResult.season.has_rivals_week,
        isReady: true,
      });
    }

    loadSchedulerConfig();
  }, [seasonId]);

  const handleGenerateSchedule = () => {
    // Guard against running if config isn't ready.
    if (!config || !config.isReady) {
        alert("Scheduler configuration is not ready. Please refresh.");
        return;
    }

    if (!confirm(
      `Ready to generate schedule with:\n\n- ${config.regularSeasonWeeks} Regular Season Weeks\n- Rivals Week: ${config.includeRivalsWeek ? 'Yes' : 'No'}\n\nThis should only be done once. Proceed?`
    )) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      // Use the config from the component's state, not from props.
      const result = await generateFullSeasonSchedule(
        seasonId,
        config.regularSeasonWeeks,
        config.includeRivalsWeek
      );

      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully scheduled ${result.scheduledGamesCount || 0} games for the season!`,
        });
        if (onScheduleGenerated) onScheduleGenerated();
      } else {
        setMessage({
          type: "error",
          text: `Error: ${result.error || "An unknown error occurred."}`,
        });
      }
    });
  };
  
  // NEW RENDER LOGIC: Handle loading and error states for the config fetch.
  if (!config) {
    return (
        <div className="p-6 text-center text-sm text-gray-500 rounded-lg bg-gray-50 dark:bg-gray-800">
            Loading scheduler configuration...
        </div>
    );
  }

  return (
    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-700 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
            Automated Season Scheduler
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
            Generate all simulated pairings and game schedules for the season.
          </p>
        </div>
        <button
          onClick={handleGenerateSchedule}
          disabled={isPending || !config.isReady}
          className="w-full md:w-auto px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {isPending ? "Generating..." : "Generate Full Schedule"}
        </button>
      </div>

      {config.error && (
        <div className="mt-4 p-3 rounded-md text-sm border bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200">
            <strong>Configuration Error:</strong> {config.error}
        </div>
      )}

      {message && (
        <div className={`mt-4 p-3 rounded-md text-sm border ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};
