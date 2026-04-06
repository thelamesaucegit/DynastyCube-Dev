// src/app/components/vote/LeagueResults.tsx
"use client";

import React from "react";
import type { LeaguePollResult, TeamPollResult } from "@/app/actions/voteActions";

interface OptionWithTeams {
  option_id: string;
  option_text: string;
  teams_voting: { team_id: string; team_name: string; team_emoji: string }[] | null;
}

interface LeagueResultsProps {
  leagueResult: LeaguePollResult | null;
  teamResults: TeamPollResult[];
  allOptions: OptionWithTeams[];
}

export function LeagueResults({ leagueResult, teamResults, allOptions }: LeagueResultsProps) {
  // Count teams voting for each option
  const getTeamCountForOption = (optionId: string) => {
    const option = allOptions.find((o) => o.option_id === optionId);
    return option?.teams_voting?.length || 0;
  };

  // Sort options by team count
  const sortedOptions = [...allOptions].sort((a, b) => {
    const countA = a.teams_voting?.length || 0;
    const countB = b.teams_voting?.length || 0;
    return countB - countA;
  });

  const totalTeamsVoting = teamResults.filter((t) => t.winning_option_id).length;

  return (
    <div className="space-y-6">
      {/* League Winner Banner */}
      {leagueResult && leagueResult.winning_option_text && (
        <div className="bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 border-2 border-orange-300 dark:border-orange-600 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="text-sm text-orange-700 dark:text-orange-400 font-semibold mb-2">
            League Decision
          </p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {leagueResult.winning_option_text}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Chosen by {getTeamCountForOption(leagueResult.winning_option_id || "")} of {totalTeamsVoting} teams
          </p>
        </div>
      )}

      {!leagueResult?.winning_option_text && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No league decision yet. Teams are still voting.
          </p>
        </div>
      )}

      {/* Vote Distribution */}
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-4">
          Vote Distribution
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Each team counts as one vote toward the league decision.
        </p>

        <div className="space-y-4">
          {sortedOptions.map((option) => {
            const teamCount = option.teams_voting?.length || 0;
            const percentage = totalTeamsVoting > 0 ? (teamCount / totalTeamsVoting) * 100 : 0;
            const isWinner = leagueResult?.winning_option_id === option.option_id;

            return (
              <div
                key={option.option_id}
                className={`
                  border rounded-lg p-4 transition-all
                  ${
                    isWinner
                      ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600"
                      : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isWinner && <span className="text-lg">🏆</span>}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {option.option_text}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {teamCount} team{teamCount !== 1 ? "s" : ""} ({percentage.toFixed(0)}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isWinner ? "bg-orange-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>

                {/* Teams that voted for this option */}
                {option.teams_voting && option.teams_voting.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {option.teams_voting.map((team) => (
                      <span
                        key={team.team_id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm"
                      >
                        <span>{team.team_emoji}</span>
                        <span className="text-gray-700 dark:text-gray-300">{team.team_name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Breakdown */}
      {teamResults.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-4">
            Team Voting Details
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Each team&apos;s internal vote was weighted by member roles (Captain: 3x, Pilot/Broker: 2x, Others: 1x).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teamResults.map((teamResult) => (
              <div
                key={teamResult.team_id}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{teamResult.team_emoji}</span>
                  <div>
                    <h5 className="font-bold text-gray-900 dark:text-gray-100">
                      {teamResult.team_name}
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {teamResult.total_weighted_votes} weighted votes
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  {teamResult.winning_option_text ? (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Voted for: </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {teamResult.winning_option_text}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No votes yet
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
