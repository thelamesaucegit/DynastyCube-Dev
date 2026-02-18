// src/app/components/admin/EssenceManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAllUserEssenceBalances,
  grantEssence,
  grantEssenceToAllUsers,
  grantEssenceToTeamMembers,
  getAllEssenceTransactions,
  type EssenceBalance,
  type EssenceTransaction,
} from "@/app/actions/essenceActions";
import { getAllTeams } from "@/app/actions/teamActions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

export const EssenceManagement: React.FC = () => {
  const [users, setUsers] = useState<EssenceBalance[]>([]);
  const [transactions, setTransactions] = useState<EssenceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Allocation state
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");

  // Team grant state
  const [teams, setTeams] = useState<{ id: string; name: string; emoji: string; motto: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [teamGrantAmount, setTeamGrantAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, transactionsRes, teamsRes] = await Promise.all([
        getAllUserEssenceBalances(),
        getAllEssenceTransactions(),
        getAllTeams(),
      ]);

      setUsers(usersRes.users);
      setTransactions(transactionsRes.transactions);
      setTeams(teamsRes.teams || []);
    } catch (error) {
      console.error("Error loading Essence data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async (userId: string) => {
    const amount = parseInt(grantAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid positive amount" });
      return;
    }

    try {
      const result = await grantEssence(userId, amount);
      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully granted ${amount} Essence`,
        });
        setGrantAmount("");
        setGrantingUserId(null);
        loadData();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to grant Essence",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleBulkGrant = async () => {
    const amount = parseInt(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid positive amount" });
      return;
    }

    if (
      !confirm(
        `Grant ${amount} Essence to ALL ${users.length} users?`
      )
    ) {
      return;
    }

    try {
      const result = await grantEssenceToAllUsers(amount);
      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully granted ${amount} Essence to ${result.grantedCount} users`,
        });
        setBulkAmount("");
        loadData();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to bulk grant Essence",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleTeamGrant = async () => {
    const amount = parseInt(teamGrantAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid positive amount" });
      return;
    }

    if (!selectedTeamId) {
      setMessage({ type: "error", text: "Please select a team" });
      return;
    }

    const selectedTeam = teams.find((t) => t.id === selectedTeamId);
    const teamName = selectedTeam ? `${selectedTeam.emoji} ${selectedTeam.name}` : selectedTeamId;

    if (
      !confirm(
        `Grant ${amount} Essence to all members of ${teamName}?`
      )
    ) {
      return;
    }

    try {
      const result = await grantEssenceToTeamMembers(selectedTeamId, amount);
      if (result.success) {
        setMessage({
          type: "success",
          text: `Successfully granted ${amount} Essence to ${result.grantedCount} of ${result.totalMembers} members of ${teamName}`,
        });
        setTeamGrantAmount("");
        setSelectedTeamId("");
        loadData();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to grant Essence to team",
        });
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
      case "grant":
        return "text-green-600 dark:text-green-400";
      case "spend":
        return "text-red-600 dark:text-red-400";
      case "refund":
        return "text-blue-600 dark:text-blue-400";
      case "adjustment":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getUserDisplay = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    return user?.display_name || user?.discord_username || userId.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading Essence data...
          </p>
        </div>
      </div>
    );
  }

  const totalEssence = users.reduce(
    (sum, u) => sum + u.essence_balance,
    0
  );
  const totalEarned = users.reduce(
    (sum, u) => sum + u.essence_total_earned,
    0
  );
  const totalSpent = users.reduce(
    (sum, u) => sum + u.essence_total_spent,
    0
  );

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">✨ Essence Management</h2>
        <p className="admin-section-description">
          Manage personal user currency
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

      {/* Overall Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-300 dark:border-teal-700 rounded-lg p-4">
          <div className="text-sm text-teal-700 dark:text-teal-300 mb-1">
            Total in Circulation
          </div>
          <div className="text-3xl font-bold text-teal-900 dark:text-teal-100">
            {totalEssence.toLocaleString()} ✨
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg p-4">
          <div className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">
            Total Earned
          </div>
          <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {totalEarned.toLocaleString()} ✨
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-300 dark:border-rose-700 rounded-lg p-4">
          <div className="text-sm text-rose-700 dark:text-rose-300 mb-1">
            Total Spent
          </div>
          <div className="text-3xl font-bold text-rose-900 dark:text-rose-100">
            {totalSpent.toLocaleString()} ✨
          </div>
        </div>
      </div>

      {/* Bulk Grant */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🎁 Bulk Grant
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Grant Essence to all users at once (rewards, events, etc.)
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            placeholder="Amount to grant"
            min={1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleBulkGrant}
            className="admin-btn admin-btn-primary"
          >
            Grant to All Users
          </button>
        </div>
      </div>

      {/* Team Grant */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Team Grant
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Grant Essence to all members of a specific team
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.emoji} {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            type="number"
            value={teamGrantAmount}
            onChange={(e) => setTeamGrantAmount(e.target.value)}
            placeholder="Amount"
            min={1}
            className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleTeamGrant}
            disabled={!selectedTeamId || !teamGrantAmount}
            className="admin-btn admin-btn-primary"
          >
            Grant to Team
          </button>
        </div>
      </div>

      {/* User Balances */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          User Balances ({users.length} users)
        </h3>
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.user_id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {u.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-teal-200 dark:bg-teal-800 flex items-center justify-center text-sm font-bold text-teal-700 dark:text-teal-300">
                        {(u.display_name || u.discord_username || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {u.display_name || u.discord_username || "Unknown User"}
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Balance:
                      </span>
                      <span className="ml-2 font-semibold text-teal-600 dark:text-teal-400">
                        {u.essence_balance} ✨
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Earned:
                      </span>
                      <span className="ml-2 font-semibold">
                        {u.essence_total_earned}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Spent:
                      </span>
                      <span className="ml-2 font-semibold text-rose-600 dark:text-rose-400">
                        {u.essence_total_spent}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  {grantingUserId === u.user_id ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={grantAmount}
                        onChange={(e) => setGrantAmount(e.target.value)}
                        placeholder="Amount"
                        min={1}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleGrant(u.user_id)}
                        className="admin-btn admin-btn-primary text-sm"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setGrantingUserId(null);
                          setGrantAmount("");
                        }}
                        className="admin-btn admin-btn-secondary text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setGrantingUserId(u.user_id)}
                      className="admin-btn admin-btn-secondary"
                    >
                      Add Essence
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
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No transactions yet
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">
                      User
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
                  {transactions.slice(0, 20).map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    >
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {getUserDisplay(tx.user_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-gray-700 dark:text-gray-300">
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${getTransactionColor(
                          tx.transaction_type
                        )}`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                        {tx.balance_after}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {tx.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
