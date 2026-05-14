// src/app/components/vote/BlessingsResults.tsx
"use client";

import React from "react";
import { Sparkles, Dices, Trophy, XCircle } from "lucide-react";

interface BlessingResultRaw {
  roll_value: number;
  team_odds: Record<string, number>;
  poll_options: { id: string; option_text: string };
  teams?: { id: string; name: string; emoji: string };
}

interface BlessingsResultsProps {
  rawData: any; // We receive this from the TypedPollResults
}

export function BlessingsResults({ rawData }: BlessingsResultsProps) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No results available for this blessing event yet.
      </div>
    );
  }

  const results = rawData as BlessingResultRaw[];

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2 mb-2">
          <Dices className="size-4" /> Official Lottery Results
        </h4>
        <p className="text-sm text-purple-800 dark:text-purple-200">
          Blessings were rolled in order of total league popularity. If a team won a blessing, they were removed from all subsequent rolls. The random roll (0-100) must land within a team's odds bracket to win.
        </p>
      </div>

      <div className="space-y-4">
        {results.map((result, index) => {
          const hasWinner = !!result.teams;
          
          return (
            <div 
              key={result.poll_options.id || index} 
              className={`border-2 rounded-xl overflow-hidden transition-all ${
                hasWinner 
                  ? "border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-900/10" 
                  : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20"
              }`}
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border/50 gap-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Sparkles className={`size-5 ${hasWinner ? "text-purple-500" : "text-muted-foreground"}`} /> 
                  {result.poll_options.option_text}
                </h3>
                
                <div className="flex items-center gap-3 bg-background border border-border px-3 py-1.5 rounded-md text-sm font-medium shadow-sm">
                  <Dices className="size-4 text-muted-foreground" />
                  <span>Roll: <span className="font-mono font-bold text-primary">{result.roll_value.toFixed(2)}</span></span>
                </div>
              </div>

              {/* Winner Banner */}
              <div className="p-4">
                {hasWinner ? (
                  <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-lg p-3 shadow-sm mb-4">
                    <Trophy className="size-6 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Winner</div>
                      <div className="font-bold text-lg leading-none">
                        <span className="mr-2 text-2xl">{result.teams.emoji}</span>
                        {result.teams.name}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm mb-4 opacity-75">
                    <XCircle className="size-6 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="font-bold text-muted-foreground">The Fates Denied</div>
                      <div className="text-xs text-muted-foreground mt-0.5">The roll did not land in any eligible team's bracket.</div>
                    </div>
                  </div>
                )}

                {/* Odds Breakdown */}
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Team Odds at time of roll</h5>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.team_odds || {}).length === 0 ? (
                      <span className="text-sm text-muted-foreground italic">No eligible teams remaining for this roll.</span>
                    ) : (
                      Object.entries(result.team_odds).map(([teamId, odds]) => {
                        const isWinner = result.teams?.id === teamId;
                        return (
                          <div 
                            key={teamId} 
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-sm border ${
                              isWinner 
                                ? "bg-purple-100 border-purple-300 dark:bg-purple-900/40 dark:border-purple-600 font-medium" 
                                : "bg-background border-border text-muted-foreground"
                            }`}
                          >
                            <span>{odds}%</span>
                            {isWinner && <CheckCircle2 className="size-3 text-purple-600 dark:text-purple-400" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
