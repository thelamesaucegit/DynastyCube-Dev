// src/app/teams/[teamId]/trades/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsWithMembers } from "@/app/actions/teamActions";
import {
  getTeamTrades,
  getTradeDetails,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  addTradeMessage,
  getTradeMessages,
  areTradesEnabled,
  type TradeItem as TradeItemType,
} from "@/app/actions/tradeActions";
import Link from "next/link";

interface TeamMember {
  user_id: string;
}

interface Team {
  id: string;
  name: string;
  emoji: string;
  members?: TeamMember[];
}

interface Trade {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: string;
  deadline: string;
  created_at: string;
  from_team_name?: string;
  from_team_emoji?: string;
  to_team_name?: string;
  to_team_emoji?: string;
}

interface TradeMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface TradesPageProps {
  params: Promise<{ teamId: string }>;
}

export default function TradesPage({ params }: TradesPageProps) {
  const { teamId } = use(params);
  const { user } = useAuth();
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  // Check if current user is a member of this team
  const isUserTeamMember = currentTeam?.members?.some(
    (member) => member.user_id === user?.id
  ) ?? false;
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradesEnabled, setTradesEnabled] = useState(true);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedTradeItems, setSelectedTradeItems] = useState<TradeItemType[]>([]);
  const [selectedTradeMessages, setSelectedTradeMessages] = useState<TradeMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing" | "history">("all");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (selectedTradeId) {
      loadTradeDetails(selectedTradeId);
    }
  }, [selectedTradeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check if trades enabled
      const { enabled } = await areTradesEnabled();
      setTradesEnabled(enabled);

      // Load team
      const teams = await getTeamsWithMembers();
      const current = teams.find((t) => t.id === teamId);
      setCurrentTeam(current || null);

      // Load trades
      const { trades: teamTrades } = await getTeamTrades(teamId);
      setTrades(teamTrades || []);
    } catch (error) {
      console.error("Error loading trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTradeDetails = async (tradeId: string) => {
    try {
      const { items } = await getTradeDetails(tradeId);
      setSelectedTradeItems(items || []);

      const { messages } = await getTradeMessages(tradeId);
      setSelectedTradeMessages(messages || []);
    } catch (error) {
      console.error("Error loading trade details:", error);
    }
  };

  const handleAcceptTrade = async (tradeId: string) => {
    if (!confirm("Are you sure you want to accept this trade?")) return;

    try {
      const result = await acceptTrade(tradeId);
      if (result.success) {
        await loadData();
        setSelectedTradeId(null);
      } else {
        alert(result.error || "Failed to accept trade");
      }
    } catch (error) {
      console.error("Error accepting trade:", error);
      alert("An error occurred");
    }
  };

  const handleRejectTrade = async (tradeId: string) => {
    if (!confirm("Are you sure you want to reject this trade?")) return;

    try {
      const result = await rejectTrade(tradeId);
      if (result.success) {
        await loadData();
        setSelectedTradeId(null);
      } else {
        alert(result.error || "Failed to reject trade");
      }
    } catch (error) {
      console.error("Error rejecting trade:", error);
      alert("An error occurred");
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    if (!confirm("Are you sure you want to cancel this trade proposal?")) return;

    try {
      const result = await cancelTrade(tradeId);
      if (result.success) {
        await loadData();
        setSelectedTradeId(null);
      } else {
        alert(result.error || "Failed to cancel trade");
      }
    } catch (error) {
      console.error("Error cancelling trade:", error);
      alert("An error occurred");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTradeId || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const result = await addTradeMessage(selectedTradeId, newMessage);
      if (result.success) {
        setNewMessage("");
        await loadTradeDetails(selectedTradeId);
      } else {
        alert(result.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("An error occurred");
    } finally {
      setSendingMessage(false);
    }
  };

  const getFilteredTrades = () => {
    switch (filter) {
      case "incoming":
        return trades.filter((t) => t.to_team_id === teamId && t.status === "pending");
      case "outgoing":
        return trades.filter((t) => t.from_team_id === teamId && t.status === "pending");
      case "history":
        return trades.filter((t) => ["accepted", "rejected", "cancelled", "expired"].includes(t.status));
      default:
        return trades;
    }
  };

  const formatTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) return "Expired";
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-400",
      accepted: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-400",
      rejected: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-400",
      cancelled: "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 border-gray-400",
      expired: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-400",
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const filteredTrades = getFilteredTrades();

  if (loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trades...</p>
        </div>
      </Layout>
    );
  }

  if (!currentTeam) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <p className="text-red-600 dark:text-red-400">Team not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href={`/teams/${teamId}`}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
            >
              ← Back to Team
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              🔄 {currentTeam.emoji} {currentTeam.name} Trades
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isUserTeamMember
                ? "Manage your trade proposals and negotiate with other teams"
                : `View ${currentTeam.name}'s trade proposals and negotiations`}
            </p>
          </div>
          {tradesEnabled && (
            <Link
              href={`/teams/${teamId}/trades/new`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + New Trade
            </Link>
          )}
        </div>

        {!tradesEnabled && (
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg text-orange-800 dark:text-orange-200">
            ⚠️ Trades are currently disabled by an administrator
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setFilter("incoming")}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                filter === "incoming"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              📨 Incoming ({trades.filter((t) => t.to_team_id === teamId && t.status === "pending").length})
            </button>
            <button
              onClick={() => setFilter("outgoing")}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                filter === "outgoing"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              📤 Outgoing ({trades.filter((t) => t.from_team_id === teamId && t.status === "pending").length})
            </button>
            <button
              onClick={() => setFilter("history")}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                filter === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              📜 History ({trades.filter((t) => ["accepted", "rejected", "cancelled", "expired"].includes(t.status)).length})
            </button>
          </div>
        </div>

        {/* Trades List */}
        {filteredTrades.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Trades Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {filter === "all" && (isUserTeamMember
                ? "You don't have any trade proposals yet"
                : `${currentTeam.name} doesn't have any trade proposals yet`)}
              {filter === "incoming" && "No incoming trade proposals"}
              {filter === "outgoing" && "No outgoing trade proposals"}
              {filter === "history" && "No trade history"}
            </p>
            {tradesEnabled && filter !== "history" && isUserTeamMember && (
              <Link
                href={`/teams/${teamId}/trades/new`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Create a Trade
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTrades.map((trade) => {
              const isIncoming = trade.to_team_id === teamId;
              const isPending = trade.status === "pending";
              const otherTeam = isIncoming
                ? { name: trade.from_team_name, emoji: trade.from_team_emoji }
                : { name: trade.to_team_name, emoji: trade.to_team_emoji };

              return (
                <div
                  key={trade.id}
                  className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-5 transition-all hover:shadow-lg ${
                    isPending
                      ? "border-blue-400 dark:border-blue-600"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{otherTeam.emoji}</span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {isIncoming ? "From" : "To"} {otherTeam.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(trade.status)}`}>
                          {trade.status.toUpperCase()}
                        </span>
                        {isPending && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            ⏰ {formatTimeRemaining(trade.deadline)} left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Summary */}
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Created {new Date(trade.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTradeId(trade.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                    >
                      View Details
                    </button>
                    {isPending && isIncoming && (
                      <>
                        <button
                          onClick={() => handleAcceptTrade(trade.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRejectTrade(trade.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {isPending && !isIncoming && (
                      <button
                        onClick={() => handleCancelTrade(trade.id)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trade Details Modal */}
        {selectedTradeId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1040]">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Trade Details
                </h2>
                <button
                  onClick={() => setSelectedTradeId(null)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Trade Items */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Trade Items
                </h3>
                <div className="space-y-3">
                  {selectedTradeItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        {item.item_type === "card" ? (
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            🃏 {item.card_name}
                          </div>
                        ) : (
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            🎯 Round {item.draft_pick_round} Pick
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Offered by: Team {item.offering_team_id.slice(0, 8)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  💬 Messages ({selectedTradeMessages.length})
                </h3>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {selectedTradeMessages.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    selectedTradeMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                      >
                        <p className="text-gray-900 dark:text-gray-100">{msg.message}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded font-semibold transition-colors"
                  >
                    {sendingMessage ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
