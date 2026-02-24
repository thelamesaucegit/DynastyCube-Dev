// src/app/components/TeamCubucksDisplay.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getTeamBalance,
  getTeamTransactions,
  getActiveSeason,
  type TeamBalance,
  type CubucksTransaction,
  type Season,
} from "@/app/actions/cubucksActions";

interface TeamCubucksDisplayProps {
  teamId: string;
  showTransactions?: boolean;
  compact?: boolean;
  refreshKey?: number; // Increment this to trigger a refresh
  isUserTeamMember?: boolean;
}

export const TeamCubucksDisplay: React.FC<TeamCubucksDisplayProps> = ({
  teamId,
  showTransactions = false,
  compact = false,
  refreshKey = 0,
  isUserTeamMember = true,
}) => {
  const [team, setTeam] = useState<TeamBalance | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [transactions, setTransactions] = useState<CubucksTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamRes, seasonRes] = await Promise.all([
        getTeamBalance(teamId),
        getActiveSeason(),
      ]);

      setTeam(teamRes.team);
      setActiveSeason(seasonRes.season);

      if (showTransactions) {
        const txRes = await getTeamTransactions(teamId);
        setTransactions(txRes.transactions);
      }
    } catch (error) {
      console.error("Error loading team Çubucks:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "allocation":
        return "➕";
      case "draft_pick":
        return "🎴";
      case "refund":
        return "↩️";
      case "adjustment":
        return "⚙️";
      default:
        return "•";
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400 py-4">
        Team not found
      </div>
    );
  }

  // Compact view for navigation/header
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
        <span className="text-xl">💰</span>
        <div className="flex flex-col">
          <span className="text-xs text-gray-600 dark:text-gray-400">Çubucks</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {team.cubucks_balance.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{team.emoji}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {team.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Çubucks Balance</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400">
              {team.cubucks_balance.toLocaleString()} 💰
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-yellow-300 dark:border-yellow-700">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Season {activeSeason?.season_number || "?"} Cap
            </div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {(activeSeason?.cubucks_allocation || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Spent</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              -{team.cubucks_total_spent.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      {showTransactions && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Transaction History
            </h4>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showHistory ? "Hide" : "Show"} History
            </button>
          </div>

          {showHistory && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {transactions.length === 0 ? (
                <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                  No transactions yet
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getTransactionIcon(tx.transaction_type)}</span>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {tx.description || tx.card_name || "Transaction"}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(tx.created_at)}
                            </div>
                            {tx.card_name && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Card: {tx.card_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${
                              tx.amount > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Balance: {tx.balance_after}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 About Çubucks
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
          <li>Çubucks are a finite resource that each Team allocates to the cards in their Pool.</li>
                    <li>As you add and remove cards from your Team Pool, your Çubucks Balance will adjust to reflect the allocated funds.</li>
          <li>Each card has a different value based on power level and how frequently it has been drafted.</li>
          <li>The Season Cap ({(activeSeason?.cubucks_allocation || 0).toLocaleString()} this season) is set at the beginning of each season and remains fixed.</li>
          <li>
            {isUserTeamMember
              ? "Your Çubucks Balance reflects remaining funds for the Draft, Free Agency, Waivers, and Trades."
              : "The Çubucks Balance reflects remaining funds for the Draft, Free Agency, Waivers, and Trades."}
          </li>
          <li>Budget wisely - cards will be cut automatically from your Team Pool if you exceed The Cap before a match!</li>
        </ul>
      </div>
    </div>
  );
};
