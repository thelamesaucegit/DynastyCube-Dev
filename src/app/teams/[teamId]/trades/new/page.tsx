// src/app/teams/[teamId]/trades/new/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { getTeamsWithMembers, getTeamsWithDetails } from "@/app/actions/teamActions";
import { getTeamDraftPicks } from "@/app/actions/draftActions";
import { getSeasons } from "@/app/actions/cubucksActions";
import { createTrade, areTradesEnabled, type TradeItem } from "@/app/actions/tradeActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions"; // Added to fetch active phase
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DraftPick } from "@/app/actions/draftActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, ArrowLeft, AlertCircle, Ban, Send, Sparkles } from "lucide-react";

interface Team {
  id: string;
  short_name: string;
  name: string;
  emoji: string;
  is_hidden?: boolean;
  is_escaped?: boolean; // Track escape status
}

interface Season {
  id: string;
  name: string;
  is_active: boolean;
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
  const [theirDraftPicks, setTheirDraftPicks] = useState<DraftPick[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradesEnabled, setTradesEnabled] = useState(true);
  const [seasonPhase, setSeasonPhase] = useState<string | null>(null);

  // My Trade items
  const [myOfferedCards, setMyOfferedCards] = useState<string[]>([]);
  const [myOfferedPicks, setMyOfferedPicks] = useState<{ round: number; seasonId: string }[]>([]);
  const [myOfferedEssence, setMyOfferedEssence] = useState<number>(0);

  // Their Trade items
  const [theirOfferedCards, setTheirOfferedCards] = useState<string[]>([]);
  const [theirOfferedPicks, setTheirOfferedPicks] = useState<{ round: number; seasonId: string }[]>([]);
  const [theirOfferedEssence, setTheirOfferedEssence] = useState<number>(0);
  const [deadlineDays, setDeadlineDays] = useState<number>(3);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (selectedTeamId) {
      getTeamDraftPicks(selectedTeamId).then(({ picks }) => {
        setTheirDraftPicks(picks);
        setTheirOfferedCards([]); 
      });
    } else {
      setTheirDraftPicks([]);
      setTheirOfferedCards([]);
    }
  }, [selectedTeamId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { enabled } = await areTradesEnabled();
      setTradesEnabled(enabled);

      const seasonResult = await getCurrentSeason();
      const phase = seasonResult.season?.phase || null;
      setSeasonPhase(phase);

      if (phase === "playoffs") {
        setError("Trades are completely locked during the Playoffs.");
      }

      // Fetch teams with detail stats to extract the is_escaped status
      const detailsResult = await getTeamsWithDetails(true);
      const teamsDetails = detailsResult.teams || [];

      const teams = await getTeamsWithMembers();
      
      const enrichedTeams: Team[] = teams.map(t => {
          const detail = teamsDetails.find(d => d.id === t.id);
          return {
              ...t,
              is_escaped: detail?.is_escaped || false,
              is_hidden: detail?.is_hidden || false
          };
      });

      const current = enrichedTeams.find((t) => t.short_name === teamId);
      setCurrentTeam(current || null);

      // Filter eligible partners: Escape statuses must match exactly!
      if (current) {
          const partners = enrichedTeams.filter(
              (t) => t.id !== current.id && 
              t.is_hidden === false && 
              (current.is_escaped === t.is_escaped) // Strict escape matching
          );
          setAllTeams(partners);
      }

      const { picks } = await getTeamDraftPicks(current?.id ?? teamId);
      setMyDraftPicks(picks);

      const { seasons: allSeasons } = await getSeasons();
      setSeasons(allSeasons as unknown as Season[]);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load trade parameters.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMyCardOffer = (draftPickId: string) => {
    setMyOfferedCards((prev) =>
      prev.includes(draftPickId)
        ? prev.filter((id) => id !== draftPickId)
        : [...prev, draftPickId]
    );
  };

  const handleToggleTheirCardOffer = (draftPickId: string) => {
    setTheirOfferedCards((prev) =>
      prev.includes(draftPickId)
        ? prev.filter((id) => id !== draftPickId)
        : [...prev, draftPickId]
    );
  };

  const handleAddMyDraftPick = () => setMyOfferedPicks((prev) => [...prev, { round: 1, seasonId: seasons[0]?.id || "" }]);
  const handleRemoveMyDraftPick = (index: number) => setMyOfferedPicks((prev) => prev.filter((_, i) => i !== index));
  const handleUpdateMyDraftPick = (index: number, field: "round" | "seasonId", value: number | string) => {
    setMyOfferedPicks((prev) => prev.map((pick, i) => (i === index ? { ...pick, [field]: value } : pick)));
  };

  const handleAddTheirDraftPick = () => setTheirOfferedPicks((prev) => [...prev, { round: 1, seasonId: seasons[0]?.id || "" }]);
  const handleRemoveTheirDraftPick = (index: number) => setTheirOfferedPicks((prev) => prev.filter((_, i) => i !== index));
  const handleUpdateTheirDraftPick = (index: number, field: "round" | "seasonId", value: number | string) => {
    setTheirOfferedPicks((prev) => prev.map((pick, i) => (i === index ? { ...pick, [field]: value } : pick)));
  };

  const handleSubmitTrade = async () => {
    setError(null);
    if (seasonPhase === "playoffs") {
      setError("Trades are completely locked during the Playoffs.");
      return;
    }
    if (!selectedTeamId) {
      setError("Please select a team to trade with");
      return;
    }

    const partner = allTeams.find(t => t.id === selectedTeamId);
    if (currentTeam?.is_escaped !== partner?.is_escaped) {
      setError("Escape misalignment: Escaped teams can only trade with other escaped teams.");
      return;
    }

    if (
      myOfferedCards.length === 0 &&
      myOfferedPicks.length === 0 &&
      myOfferedEssence === 0 &&
      theirOfferedCards.length === 0 &&
      theirOfferedPicks.length === 0 &&
      theirOfferedEssence === 0
    ) {
      setError("Please add at least one item or Essence amount to the trade");
      return;
    }

    setSubmitting(true);
    try {
      const fromTeamItems: Partial<TradeItem>[] = [
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

      if (myOfferedEssence > 0) {
        fromTeamItems.push({
          item_type: "essence" as const,
          essence_amount: myOfferedEssence,
        });
      }

      const toTeamItems: Partial<TradeItem>[] = [
        ...theirOfferedCards.map((draftPickId) => {
          const pick = theirDraftPicks.find((p) => p.id === draftPickId);
          return {
            item_type: "card" as const,
            draft_pick_id: draftPickId,
            card_id: pick?.card_id || "",
            card_name: pick?.card_name || "",
          };
        }),
        ...theirOfferedPicks.map((pick) => ({
          item_type: "draft_pick" as const,
          draft_pick_round: pick.round,
          draft_pick_season_id: pick.seasonId,
        }))
      ];

      if (theirOfferedEssence > 0) {
        toTeamItems.push({
          item_type: "essence" as const,
          essence_amount: theirOfferedEssence,
        });
      }

      const result = await createTrade(
        currentTeam!.id,
        selectedTeamId,
        deadlineDays,
        fromTeamItems,
        toTeamItems
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
          <p className="text-muted-foreground">Loading trade variables...</p>
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
            <p className="text-muted-foreground mb-4">The trade system is currently disabled by an administrator.</p>
            <Button asChild><Link href={`/teams/${teamId}`}>Back to Team</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (seasonPhase === "playoffs") {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <Ban className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2 text-destructive">Trades Locked</h2>
            <p className="text-muted-foreground mb-4 font-semibold">Trading is completely frozen during the active Playoff phase.</p>
            <Button asChild><Link href={`/teams/${teamId}`}>Back to Team</Link></Button>
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
        <h1 className="text-4xl font-bold tracking-tight mb-2">Create Trade Proposal</h1>
        <p className="text-lg text-muted-foreground">Propose a trade with another team</p>
        <div className="mt-3">
          {currentTeam.is_escaped ? (
             <Badge className="bg-emerald-600">Escaped Team (Eligible only with other Escaped Teams)</Badge>
          ) : (
             <Badge variant="outline">Regular Season Team (No Escaped Partners)</Badge>
          )}
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-destructive bg-destructive/10">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="font-semibold text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Select Team */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. Select Team to Trade With</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-60 overflow-y-auto pr-2 pb-2">
            {allTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  selectedTeamId === team.id
                    ? "border-primary bg-primary/5 shadow-md scale-105"
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
          <Card className="mb-6 border-blue-500/30">
            <CardHeader className="bg-blue-500/5">
              <CardTitle>2. What {currentTeam.emoji} {currentTeam.name} Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              {/* My Cards */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Cards ({myOfferedCards.length} selected)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 bg-muted rounded-lg border border-border">
                  {myDraftPicks.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-4">No cards available to trade</p>
                  ) : (
                    myDraftPicks.map((pick) => (
                      <button
                        key={pick.id}
                        onClick={() => handleToggleMyCardOffer(pick.id!)}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          myOfferedCards.includes(pick.id!)
                            ? "border-blue-500 bg-blue-500/10 shadow-sm"
                            : "border-border hover:border-blue-500/50 bg-background"
                        }`}
                      >
                        <div className="font-semibold text-sm truncate">{pick.card_name}</div>
                        {myOfferedCards.includes(pick.id!) && <Badge variant="secondary" className="mt-1 text-[10px] bg-blue-500 text-white">Selected</Badge>}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* My Future Draft Picks */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Future Draft Picks ({myOfferedPicks.length} offered)</h3>
                <div className="space-y-3">
                  {myOfferedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <select
                        value={pick.round}
                        onChange={(e) => handleUpdateMyDraftPick(index, "round", parseInt(e.target.value))}
                        className="px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((round) => <option key={round} value={round}>Round {round}</option>)}
                      </select>
                      <select
                        value={pick.seasonId}
                        onChange={(e) => handleUpdateMyDraftPick(index, "seasonId", e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
                      </select>
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveMyDraftPick(index)}>Remove</Button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddMyDraftPick}
                    className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-blue-500 hover:text-blue-500 hover:bg-blue-500/5 transition-all font-semibold"
                  >
                    + Add Future Draft Pick
                  </button>
                </div>
              </div>

              {/* My Essence */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="size-5 text-teal-500" /> Team Essence
                </h3>
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
                  <span className="font-semibold text-muted-foreground">Offer Amount:</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={myOfferedEssence}
                    onChange={(e) => setMyOfferedEssence(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                  />
                  <span className="text-sm text-teal-600 font-bold tracking-widest">✨ ESSENCE</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What They're Offering */}
          <Card className="mb-6 border-orange-500/30">
            <CardHeader className="bg-orange-500/5">
              <CardTitle>3. What You Want from {selectedTeam?.emoji} {selectedTeam?.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              {/* Their Cards */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Cards ({theirOfferedCards.length} requested)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 bg-muted rounded-lg border border-border">
                  {theirDraftPicks.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-4">No cards available to request</p>
                  ) : (
                    theirDraftPicks.map((pick) => (
                      <button
                        key={pick.id}
                        onClick={() => handleToggleTheirCardOffer(pick.id!)}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          theirOfferedCards.includes(pick.id!)
                            ? "border-orange-500 bg-orange-500/10 shadow-sm"
                            : "border-border hover:border-orange-500/50 bg-background"
                        }`}
                      >
                        <div className="font-semibold text-sm truncate">{pick.card_name}</div>
                        {theirOfferedCards.includes(pick.id!) && <Badge variant="secondary" className="mt-1 text-[10px] bg-orange-500 text-white">Requested</Badge>}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Their Future Draft Picks */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Future Draft Picks ({theirOfferedPicks.length} requested)</h3>
                <div className="space-y-3">
                  {theirOfferedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <select
                        value={pick.round}
                        onChange={(e) => handleUpdateTheirDraftPick(index, "round", parseInt(e.target.value))}
                        className="px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((round) => <option key={round} value={round}>Round {round}</option>)}
                      </select>
                      <select
                        value={pick.seasonId}
                        onChange={(e) => handleUpdateTheirDraftPick(index, "seasonId", e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
                      </select>
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveTheirDraftPick(index)}>Remove</Button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddTheirDraftPick}
                    className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5 transition-all font-semibold"
                  >
                    + Request Future Draft Pick
                  </button>
                </div>
              </div>

              {/* Their Essence */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="size-5 text-teal-500" /> Team Essence
                </h3>
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
                  <span className="font-semibold text-muted-foreground">Request Amount:</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={theirOfferedEssence}
                    onChange={(e) => setTheirOfferedEssence(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                  />
                  <span className="text-sm text-teal-600 font-bold tracking-widest">✨ ESSENCE</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trade Deadline */}
          <Card className="mb-8 border-primary/20">
            <CardHeader className="bg-primary/5">
              <CardTitle>4. Set Trade Deadline</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6 p-4 bg-muted rounded-lg border border-border">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(parseInt(e.target.value))}
                  className="flex-1 accent-primary cursor-pointer h-2 bg-border rounded-lg appearance-none"
                />
                <div className="text-3xl font-black text-primary min-w-[80px] text-right">
                  {deadlineDays} {deadlineDays === 1 ? "Day" : "Days"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 font-medium">
                {selectedTeam?.name} will have exactly {deadlineDays} day{deadlineDays !== 1 ? "s" : ""} to accept or reject this trade proposal before it naturally expires.
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center gap-4 sticky bottom-6 bg-background/80 backdrop-blur-sm p-4 rounded-xl border shadow-xl">
            <Button
              onClick={handleSubmitTrade}
              disabled={submitting}
              className="flex-1 py-7 text-lg font-bold tracking-wide"
            >
              {submitting ? (
                <><Loader2 className="h-6 w-6 animate-spin mr-2" /> Negotiating...</>
              ) : (
                <><Send className="h-6 w-6 mr-2" /> Send Official Proposal</>
              )}
            </Button>
            <Button variant="outline" size="lg" className="py-7 font-bold" asChild>
              <Link href={`/teams/${teamId}/trades`}>Cancel</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
