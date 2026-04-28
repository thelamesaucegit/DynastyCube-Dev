// src/app/components/admin/FullSeasonScheduler.tsx

"use client";

import React, { useState, useTransition } from "react";
import { generateFullSeasonSchedule } from "@/app/actions/seasonSchedulerActions";

interface FullSeasonSchedulerProps {
  seasonId: string;
  regularSeasonWeeks: number;
  includeRivalsWeek: boolean;
  onScheduleGenerated?: () => void;
}

export const FullSeasonScheduler: React.FC<FullSeasonSchedulerProps> = ({
  seasonId,
  regularSeasonWeeks,
  includeRivalsWeek,
  onScheduleGenerated,
}) => {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGenerateSchedule = () => {
    if (!confirm(
      "Are you sure you want to generate the full season schedule?\n\nThis will create all simulated game entries for the configured weeks. This action should only be performed once per season and may take a moment to complete."
    )) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await generateFullSeasonSchedule(
        seasonId,
        regularSeasonWeeks,
        includeRivalsWeek
      );

      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully scheduled ${result.scheduledGamesCount || 0} games for the season!`,
        });
        if (onScheduleGenerated) {
          onScheduleGenerated();
        }
      } else {
        setMessage({
          type: "error",
          text: `Error: ${result.error || "An unknown error occurred."}`,
        });
      }
    });
  };

  return (
    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-700 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
            Automated Season Scheduler
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
            Automatically generate all simulated match pairings and game schedules for the entire season.
          </p>
        </div>
        <button
          onClick={handleGenerateSchedule}
          disabled={isPending}
          className="w-full md:w-auto px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {isPending ? "Generating Schedule..." : "Generate Full Schedule"}
        </button>
      </div>
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
