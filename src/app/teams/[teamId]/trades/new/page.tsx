// src/app/teams/[teamId]/trades/new/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import Layout from "@/components/Layout";
import { getTeamsWithMembers } from "@/app/actions/teamActions";
import { getTeamDraftPicks } from "@/app/actions/draftActions";
import { getSeasons } from "@/app/actions/cubucksActions";
import { createTrade, areTradesEnabled } from "@/app/actions/tradeActions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DraftPick } from "@/app/actions/draftActions";

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
  const [myOfferedCards, setMyOfferedCards] = useState<string[]>([]); // draft_pick_ids
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
      // Check if trades are enabled
      const { enabled } = await areTradesEnabled();
      setTradesEnabled(enabled);

      // Load teams
      const teams = await getTeamsWithMembers();
      const current = teams.find((t) => t.id === teamId);
      setCurrentTeam(current || null);
      setAllTeams(teams.filter((t) => t.id !== teamId));

      // Load my draft picks
      const { picks } = await getTeamDraftPicks(teamId);
      setMyDraftPicks(picks);

      // Load seasons
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

    // Validation
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
      // Build trade items for "from team" (current team)
      const fromTeamItems: TradeItem[] = [
        // Cards I'm offering
        ...myOfferedCards.map((draftPickId) => {
          const pick = myDraftPicks.find((p) => p.id === draftPickId);
          return {
            item_type: "card" as const,
            draft_pick_id: draftPickId,
            card_id: pick?.card_id || "",
            card_name: pick?.card_name || "",
          };
        }),
        // Future picks I'm offering
        ...myOfferedPicks.map((pick) => ({
          item_type: "draft_pick" as const,
          draft_pick_round: pick.round,
          draft_pick_season_id: pick.seasonId,
        })),
      ];

      // Build trade items for "to team" (their team)
      const toTeamItems: TradeItem[] = theirOfferedPicks.map((pick) => ({
        item_type: "draft_pick" as const,
        draft_pick_round: pick.round,
        draft_pick_season_id: pick.seasonId,
      }));

      // Create trade
      const result = await createTrade(
        teamId,
        selectedTeamId,
        deadlineDays,
        fromTeamItems as never,
        toTeamItems as never
      );

      if (result.success) {
        // Navigate to trades page
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
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!tradesEnabled) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-2">
              Trades Disabled
            </h2>
            <p className="text-orange-800 dark:text-orange-200 mb-4">
              The trade system is currently disabled by an administrator.
            </p>
            <Link
              href={`/teams/${teamId}`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              ← Back to Team
            </Link>
          </div>
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

  const selectedTeam = allTeams.find((t) => t.id === selectedTeamId);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/teams/${teamId}/trades`}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
          >
            ← Back to Trades
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🔄 Create Trade Proposal
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Propose a trade with another team
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
            ✗ {error}
          </div>
        )}

        {/* Select Team */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            1. Select Team to Trade With
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  selectedTeamId === team.id
                    ? "border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                <div className="text-4xl mb-2">{team.emoji}</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {team.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trade Items */}
        {selectedTeamId && (
          <>
            {/* What I'm Offering */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                2. What {currentTeam.emoji} {currentTeam.name} Offers
              </h2>

              {/* My Cards */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  📇 Cards ({myOfferedCards.length} selected)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  {myDraftPicks.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-4">
                      No cards available to trade
                    </p>
                  ) : (
                    myDraftPicks.map((pick) => (
                      <button
                        key={pick.id}
                        onClick={() => handleToggleCardOffer(pick.id!)}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          myOfferedCards.includes(pick.id!)
                            ? "border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-green-400"
                        }`}
                      >
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {pick.card_name}
                        </div>
                        {myOfferedCards.includes(pick.id!) && (
                          <div className="text-green-600 dark:text-green-400 text-xs font-bold mt-1">
                            ✓ Selected
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* My Future Draft Picks */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  🎯 Future Draft Picks ({myOfferedPicks.length} offered)
                </h3>
                <div className="space-y-3">
                  {myOfferedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <select
                        value={pick.round}
                        onChange={(e) => handleUpdateMyDraftPick(index, "round", parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemoveMyDraftPick(index)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddMyDraftPick}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold"
                  >
                    + Add Future Draft Pick
                  </button>
                </div>
              </div>
            </div>

            {/* What They're Offering */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                3. What You Want from {selectedTeam?.emoji} {selectedTeam?.name}
              </h2>

              {/* Their Future Draft Picks */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  🎯 Future Draft Picks ({theirOfferedPicks.length} requested)
                </h3>
                <div className="space-y-3">
                  {theirOfferedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <select
                        value={pick.round}
                        onChange={(e) => handleUpdateTheirDraftPick(index, "round", parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemoveTheirDraftPick(index)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddTheirDraftPick}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold"
                  >
                    + Request Future Draft Pick
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  💡 Note: Currently, you can only request future draft picks. Card trading will be added soon!
                </p>
              </div>
            </div>

            {/* Trade Deadline */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                4. Set Trade Deadline
              </h2>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(parseInt(e.target.value))}
                  className="flex-1"
                />
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {deadlineDays} {deadlineDays === 1 ? "Day" : "Days"}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                The other team will have {deadlineDays} day{deadlineDays !== 1 ? "s" : ""} to accept or reject this trade
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSubmitTrade}
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors disabled:cursor-not-allowed"
              >
                {submitting ? "Creating Trade..." : "📨 Send Trade Proposal"}
              </button>
              <Link
                href={`/teams/${teamId}/trades`}
                className="px-8 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
