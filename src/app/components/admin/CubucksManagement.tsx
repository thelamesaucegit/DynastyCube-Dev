// src/app/components/admin/CubucksManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getTeamBalances,
  allocateCubucks,
  allocateCubucksToAllTeams,
  getActiveSeason,
  getAllTransactions,
  type TeamBalance,
  type Season,
  type CubucksTransaction,
} from "@/app/actions/cubucksActions";

export const CubucksManagement: React.FC = () => {
  const [teams, setTeams] = useState<TeamBalance[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [transactions, setTransactions] = useState<CubucksTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Allocation state
  const [allocatingTeamId, setAllocatingTeamId] = useState<string | null>(null);
  const [allocationAmount, setAllocationAmount] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsRes, seasonRes, transactionsRes] = await Promise.all([
        getTeamBalances(),
        getActiveSeason(),
        getAllTransactions(),
      ]);

      setTeams(teamsRes.teams);
      setActiveSeason(seasonRes.season);
      setTransactions(transactionsRes.transactions);
    } catch (error) {
      console.error("Error loading Cubucks data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async (teamId: string) => {
    const amount = parseInt(allocationAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    try {
      const result = await allocateCubucks(teamId, amount);
      if (result.success) {
        setMessage({ type: "success", text: `Successfully allocated ${amount} Cubucks` });
        setAllocationAmount("");
        setAllocatingTeamId(null);
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to allocate Cubucks" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleBulkAllocate = async () => {
    const amount = parseInt(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    if (!confirm(`Allocate ${amount} Cubucks to ALL ${teams.length} teams?`)) {
      return;
    }

    try {
      const result = await allocateCubucksToAllTeams(amount);
      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully allocated ${amount} Cubucks to ${result.allocatedCount} teams`,
        });
        setBulkAmount("");
        loadData();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to bulk allocate" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "allocation":
        return "text-green-600 dark:text-green-400";
      case "draft_pick":
        return "text-red-600 dark:text-red-400";
      case "refund":
        return "text-blue-600 dark:text-blue-400";
      case "adjustment":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Cubucks data...</p>
        </div>
      </div>
    );
  }

  const totalCubucks = teams.reduce((sum, team) => sum + team.cubucks_balance, 0);
  const totalEarned = teams.reduce((sum, team) => sum + team.cubucks_total_earned, 0);
  const totalSpent = teams.reduce((sum, team) => sum + team.cubucks_total_spent, 0);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">💰 Cubucks Management</h2>
        <p className="admin-section-description">
          Manage team currency and draft budgets
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
            <button
              onClick={() => setMessage(null)}
              className="text-sm opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active Season */}
      {activeSeason && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                {activeSeason.season_name}
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Allocation: {activeSeason.cubucks_allocation} Cubucks per team
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
              Active
            </span>
          </div>
        </div>
      )}

      {/* Overall Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <div className="text-sm text-green-700 dark:text-green-300 mb-1">
            Total in Circulation
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            {totalCubucks.toLocaleString()} 💰
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Earned</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {totalEarned.toLocaleString()} 💰
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
          <div className="text-sm text-red-700 dark:text-red-300 mb-1">Total Spent</div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-100">
            {totalSpent.toLocaleString()} 💰
          </div>
        </div>
      </div>

      {/* Bulk Allocation */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🎁 Bulk Allocation
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Give Cubucks to all teams at once (season starts, bonuses, etc.)
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            placeholder="Amount to allocate"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button onClick={handleBulkAllocate} className="admin-btn admin-btn-primary">
            Allocate to All Teams
          </button>
        </div>
      </div>

      {/* Team Balances */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Team Balances
        </h3>
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{team.emoji}</span>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {team.name}
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Balance:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        {team.cubucks_balance} 💰
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Earned:</span>
                      <span className="ml-2 font-semibold">
                        {team.cubucks_total_earned}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Spent:</span>
                      <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                        {team.cubucks_total_spent}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  {allocatingTeamId === team.id ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={allocationAmount}
                        onChange={(e) => setAllocationAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAllocate(team.id)}
                        className="admin-btn admin-btn-primary text-sm"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setAllocatingTeamId(null);
                          setAllocationAmount("");
                        }}
                        className="admin-btn admin-btn-secondary text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAllocatingTeamId(team.id)}
                      className="admin-btn admin-btn-secondary"
                    >
                      Add Cubucks
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Transactions
        </h3>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    Balance After
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.slice(0, 20).map((tx) => {
                  const team = teams.find((t) => t.id === tx.team_id);
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="mr-1">{team?.emoji}</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {team?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-gray-700 dark:text-gray-300">
                          {tx.transaction_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${getTransactionColor(tx.transaction_type)}`}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                        {tx.balance_after}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {tx.description || tx.card_name || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
