// src/app/teams/[teamId]/trades/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
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
import { Card, CardContent, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Loader2, ArrowLeft, AlertCircle, X, Send, MessageSquare } from "lucide-react";

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
      const { enabled } = await areTradesEnabled();
      setTradesEnabled(enabled);

      const teams = await getTeamsWithMembers();
      const current = teams.find((t) => t.id === teamId);
      setCurrentTeam(current || null);

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

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "accepted": return "default";
      case "pending": return "secondary";
      case "rejected": return "destructive";
      default: return "outline";
    }
  };

  const filteredTrades = getFilteredTrades();

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-muted-foreground">Team not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-4 gap-2">
            <Link href={`/teams/${teamId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to Team
            </Link>
          </Button>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            {currentTeam.emoji} {currentTeam.name} Trades
          </h1>
          <p className="text-lg text-muted-foreground">
            {isUserTeamMember
              ? "Manage your trade proposals and negotiate with other teams"
              : `View ${currentTeam.name}'s trade proposals and negotiations`}
          </p>
        </div>
        {tradesEnabled && isUserTeamMember && (
          <Button asChild>
            <Link href={`/teams/${teamId}/trades/new`}>+ New Trade</Link>
          </Button>
        )}
      </div>

      {!tradesEnabled && (
        <Card className="mb-6 border-orange-500/50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
            <p className="text-muted-foreground">Trades are currently disabled by an administrator</p>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {(["all", "incoming", "outgoing", "history"] as const).map((f) => {
          const counts = {
            all: trades.length,
            incoming: trades.filter((t) => t.to_team_id === teamId && t.status === "pending").length,
            outgoing: trades.filter((t) => t.from_team_id === teamId && t.status === "pending").length,
            history: trades.filter((t) => ["accepted", "rejected", "cancelled", "expired"].includes(t.status)).length,
          };
          const labels = { all: "All", incoming: "Incoming", outgoing: "Outgoing", history: "History" };
          return (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {labels[f]} ({counts[f]})
            </Button>
          );
        })}
      </div>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Trades Found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === "all" && (isUserTeamMember
                ? "You don't have any trade proposals yet"
                : `${currentTeam.name} doesn't have any trade proposals yet`)}
              {filter === "incoming" && "No incoming trade proposals"}
              {filter === "outgoing" && "No outgoing trade proposals"}
              {filter === "history" && "No trade history"}
            </p>
            {tradesEnabled && filter !== "history" && isUserTeamMember && (
              <Button asChild>
                <Link href={`/teams/${teamId}/trades/new`}>Create a Trade</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTrades.map((trade) => {
            const isIncoming = trade.to_team_id === teamId;
            const isPending = trade.status === "pending";
            const otherTeam = isIncoming
              ? { name: trade.from_team_name, emoji: trade.from_team_emoji }
              : { name: trade.to_team_name, emoji: trade.to_team_emoji };

            return (
              <Card
                key={trade.id}
                className={`transition-shadow hover:shadow-lg ${
                  isPending ? "border-primary/50" : ""
                }`}
              >
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{otherTeam.emoji}</span>
                        <h3 className="text-lg font-bold">
                          {isIncoming ? "From" : "To"} {otherTeam.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(trade.status)}>
                          {trade.status.toUpperCase()}
                        </Badge>
                        {isPending && (
                          <span className="text-xs text-muted-foreground">
                            {formatTimeRemaining(trade.deadline)} left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Created {new Date(trade.created_at).toLocaleDateString()}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => setSelectedTradeId(trade.id)}
                    >
                      View Details
                    </Button>
                    {isPending && isIncoming && isUserTeamMember && (
                      <>
                        <Button
                          variant="outline"
                          className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleAcceptTrade(trade.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleRejectTrade(trade.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {isPending && !isIncoming && isUserTeamMember && (
                      <Button
                        variant="outline"
                        onClick={() => handleCancelTrade(trade.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trade Details Modal */}
      {selectedTradeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1040]">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b p-6 flex items-center justify-between">
              <CardTitle>Trade Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTradeId(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Trade Items */}
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-4">Trade Items</h3>
              <div className="space-y-3">
                {selectedTradeItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-muted rounded-lg flex items-center justify-between"
                  >
                    <div className="font-semibold">
                      {item.item_type === "card"
                        ? `Card: ${item.card_name}`
                        : `Round ${item.draft_pick_round} Pick`}
                    </div>
                    <Badge variant="outline">
                      Team {item.offering_team_id.slice(0, 8)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>

            {/* Messages */}
            <div className="p-6 border-t">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages ({selectedTradeMessages.length})
              </h3>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {selectedTradeMessages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  selectedTradeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 bg-primary/5 rounded-lg"
                    >
                      <p>{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type your message..."
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="gap-2"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
