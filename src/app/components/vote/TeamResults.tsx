// src/app/components/vote/TeamResults.tsx
"use client";

import React from "react";
import type { TeamPollResult } from "@/app/actions/voteActions";

interface TeamResultsProps {
  teamResults: TeamPollResult[];
}

export function TeamResults({ teamResults }: TeamResultsProps) {
  if (!teamResults || teamResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No team votes recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
        Team Results
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Each team&apos;s members voted internally to determine their team&apos;s choice.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {teamResults.map((teamResult) => (
          <div
            key={teamResult.team_id}
            className={`
              border rounded-lg p-4 transition-all
              ${
                teamResult.winning_option_text
                  ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700"
                  : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              }
            `}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{teamResult.team_emoji}</span>
              <div>
                <h5 className="font-bold text-gray-900 dark:text-gray-100">
                  {teamResult.team_name}
                </h5>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {teamResult.total_weighted_votes} weighted vote{teamResult.total_weighted_votes !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              {teamResult.winning_option_text ? (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Team&apos;s Choice:
                  </p>
                  <p className="font-semibold text-purple-700 dark:text-purple-300">
                    {teamResult.winning_option_text}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No votes from this team yet
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
