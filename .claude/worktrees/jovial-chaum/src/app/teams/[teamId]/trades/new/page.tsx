// src/app/teams/[teamId]/trades/new/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { getTeamsWithMembers } from "@/app/actions/teamActions";
import { getTeamDraftPicks } from "@/app/actions/draftActions";
import { getSeasons } from "@/app/actions/cubucksActions";
import { createTrade, areTradesEnabled } from "@/app/actions/tradeActions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DraftPick } from "@/app/actions/draftActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, ArrowLeft, AlertCircle, Ban, Send } from "lucide-react";

interface Team {
  id: string;
  name: string;
  emoji: string;
}

interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

interface TradeItem {
  item_type: "card" | "draft_pick";
  draft_pick_id?: string;
  card_id?: string;
  card_name?: string;
  draft_pick_round?: number;
  draft_pick_season_id?: string;
}

interface TradePageProps {
  params: Promise<{ teamId: string }>;
}

export default function CreateTradePage({ params }: TradePageProps) {
  const { teamId } = use(params);
  const router = useRouter();

  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [myDraftPicks, setMyDraftPicks] = useState<DraftPick[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradesEnabled, setTradesEnabled] = useState(true);

  // Trade items
  const [myOfferedCards, setMyOfferedCards] = useState<string[]>([]);
  const [myOfferedPicks, setMyOfferedPicks] = useState<{ round: number; seasonId: string }[]>([]);
  const [theirOfferedPicks, setTheirOfferedPicks] = useState<{ round: number; seasonId: string }[]>([]);
  const [deadlineDays, setDeadlineDays] = useState<number>(3);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { enabled } = await areTradesEnabled();
      setTradesEnabled(enabled);

      const teams = await getTeamsWithMembers();
      const current = teams.find((t) => t.id === teamId);
      setCurrentTeam(current || null);
      setAllTeams(teams.filter((t) => t.id !== teamId));

      const { picks } = await getTeamDraftPicks(teamId);
      setMyDraftPicks(picks);

      const { seasons: allSeasons } = await getSeasons();
      setSeasons(allSeasons as unknown as Season[]);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCardOffer = (draftPickId: string) => {
    setMyOfferedCards((prev) =>
      prev.includes(draftPickId)
        ? prev.filter((id) => id !== draftPickId)
        : [...prev, draftPickId]
    );
  };

  const handleAddMyDraftPick = () => {
    setMyOfferedPicks((prev) => [...prev, { round: 1, seasonId: seasons[0]?.id || "" }]);
  };

  const handleRemoveMyDraftPick = (index: number) => {
    setMyOfferedPicks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMyDraftPick = (index: number, field: "round" | "seasonId", value: number | string) => {
    setMyOfferedPicks((prev) =>
      prev.map((pick, i) =>
        i === index ? { ...pick, [field]: value } : pick
      )
    );
  };

  const handleAddTheirDraftPick = () => {
    setTheirOfferedPicks((prev) => [...prev, { round: 1, seasonId: seasons[0]?.id || "" }]);
  };

  const handleRemoveTheirDraftPick = (index: number) => {
    setTheirOfferedPicks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTheirDraftPick = (index: number, field: "round" | "seasonId", value: number | string) => {
    setTheirOfferedPicks((prev) =>
      prev.map((pick, i) =>
        i === index ? { ...pick, [field]: value } : pick
      )
    );
  };

  const handleSubmitTrade = async () => {
    setError(null);

    if (!selectedTeamId) {
      setError("Please select a team to trade with");
      return;
    }

    if (myOfferedCards.length === 0 && myOfferedPicks.length === 0 && theirOfferedPicks.length === 0) {
      setError("Please add at least one item to the trade");
      return;
    }

    setSubmitting(true);

    try {
      const fromTeamItems: TradeItem[] = [
        ...myOfferedCards.map((draftPickId) => {
          const pick = myDraftPicks.find((p) => p.id === draftPickId);
          return {
            item_type: "card" as const,
            draft_pick_id: draftPickId,
            card_id: pick?.card_id || "",
            card_name: pick?.card_name || "",
          };
        }),
        ...myOfferedPicks.map((pick) => ({
          item_type: "draft_pick" as const,
          draft_pick_round: pick.round,
          draft_pick_season_id: pick.seasonId,
        })),
      ];

      const toTeamItems: TradeItem[] = theirOfferedPicks.map((pick) => ({
        item_type: "draft_pick" as const,
        draft_pick_round: pick.round,
        draft_pick_season_id: pick.seasonId,
      }));

      const result = await createTrade(
        teamId,
        selectedTeamId,
        deadlineDays,
        fromTeamItems as never,
        toTeamItems as never
      );

      if (result.success) {
        router.push(`/teams/${teamId}/trades`);
      } else {
        setError(result.error || "Failed to create trade");
      }
    } catch (err) {
      console.error("Error creating trade:", err);
      setError("An error occurred while creating the trade");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!tradesEnabled) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-orange-500/50">
          <CardContent className="pt-6 text-center">
            <Ban className="h-12 w-12 text-orange-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2">Trades Disabled</h2>
            <p className="text-muted-foreground mb-4">
              The trade system is currently disabled by an administrator.
            </p>
            <Button asChild>
              <Link href={`/teams/${teamId}`}>Back to Team</Link>
            </Button>
          </CardContent>
        </Card>
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

  const selectedTeam = allTeams.find((t) => t.id === selectedTeamId);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4 gap-2">
          <Link href={`/teams/${teamId}/trades`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Link>
        </Button>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Create Trade Proposal
        </h1>
        <p className="text-lg text-muted-foreground">
          Propose a trade with another team
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Select Team */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. Select Team to Trade With</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  selectedTeamId === team.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-4xl mb-2">{team.emoji}</div>
                <div className="font-semibold">{team.name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trade Items */}
      {selectedTeamId && (
        <>
          {/* What I'm Offering */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                2. What {currentTeam.emoji} {currentTeam.name} Offers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* My Cards */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Cards ({myOfferedCards.length} selected)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 bg-muted rounded-lg">
                  {myDraftPicks.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-4">
                      No cards available to trade
                    </p>
                  ) : (
                    myDraftPicks.map((pick) => (
                      <button
                        key={pick.id}
                        onClick={() => handleToggleCardOffer(pick.id!)}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          myOfferedCards.includes(pick.id!)
                            ? "border-emerald-500 bg-emerald-500/5"
                            : "border-border hover:border-emerald-500/50"
                        }`}
                      >
                        <div className="font-semibold text-sm">
                          {pick.card_name}
                        </div>
                        {myOfferedCards.includes(pick.id!) && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Selected
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* My Future Draft Picks */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Future Draft Picks ({myOfferedPicks.length} offered)
                </h3>
                <div className="space-y-3">
                  {myOfferedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <select
                        value={pick.round}
                        onChange={(e) => handleUpdateMyDraftPick(index, "round", parseInt(e.target.value))}
                        className="px-3 py-2 border rounded bg-background"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((round) => (
                          <option key={round} value={round}>
                            Round {round}
                          </option>
                        ))}
                      </select>
                      <select
                        value={pick.seasonId}
                        onChange={(e) => handleUpdateMyDraftPick(index, "seasonId", e.target.value)}
                        className="flex-1 px-3 py-2 border rounded bg-background"
                      >
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveMyDraftPick(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddMyDraftPick}
                    className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors font-semibold"
                  >
                    + Add Future Draft Pick
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What They're Offering */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                3. What You Want from {selectedTeam?.emoji} {selectedTeam?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-lg font-semibold mb-3">
                Future Draft Picks ({theirOfferedPicks.length} requested)
              </h3>
              <div className="space-y-3">
                {theirOfferedPicks.map((pick, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <select
                      value={pick.round}
                      onChange={(e) => handleUpdateTheirDraftPick(index, "round", parseInt(e.target.value))}
                      className="px-3 py-2 border rounded bg-background"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((round) => (
                        <option key={round} value={round}>
                          Round {round}
                        </option>
                      ))}
                    </select>
                    <select
                      value={pick.seasonId}
                      onChange={(e) => handleUpdateTheirDraftPick(index, "seasonId", e.target.value)}
                      className="flex-1 px-3 py-2 border rounded bg-background"
                    >
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveTheirDraftPick(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <button
                  onClick={handleAddTheirDraftPick}
                  className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors font-semibold"
                >
                  + Request Future Draft Pick
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Note: Currently, you can only request future draft picks. Card trading will be added soon!
              </p>
            </CardContent>
          </Card>

          {/* Trade Deadline */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>4. Set Trade Deadline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(parseInt(e.target.value))}
                  className="flex-1"
                />
                <div className="text-2xl font-bold text-primary">
                  {deadlineDays} {deadlineDays === 1 ? "Day" : "Days"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                The other team will have {deadlineDays} day{deadlineDays !== 1 ? "s" : ""} to accept or reject this trade
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSubmitTrade}
              disabled={submitting}
              className="flex-1 py-6 text-lg gap-2"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating Trade...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Trade Proposal
                </>
              )}
            </Button>
            <Button variant="outline" size="lg" className="py-6" asChild>
              <Link href={`/teams/${teamId}/trades`}>Cancel</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
