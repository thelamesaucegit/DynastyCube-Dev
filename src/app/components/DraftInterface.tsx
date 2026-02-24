// src/app/components/DraftInterface.tsx

"use client";

import React, { useState, useEffect } from "react";
import { getAvailableCardsForDraft } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addDraftPick } from "@/app/actions/draftActions";
import { getTeamBalance, spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import { getActiveDraftOrder, type DraftOrderEntry } from "@/app/actions/draftOrderActions";
import { conditionallyCleanupDraftQueues } from "@/app/actions/autoDraftActions";
import { advanceDraft } from "@/app/actions/draftSessionActions";
import type { CardData } from "@/app/actions/cardActions";
import type { DraftPick } from "@/app/actions/draftActions";

// --- MODIFICATION 1 of 5: Add the new `isFreeAgencyEnabled` prop ---
interface DraftInterfaceProps {
  teamId: string;
  teamName?: string;
  isUserTeamMember?: boolean;
  onDraftComplete?: () => void;
  isFreeAgencyEnabled: boolean; // This prop controls if the button is active
}

export const DraftInterface: React.FC<DraftInterfaceProps> = ({
  teamId,
  teamName = "This team",
  isUserTeamMember = true,
  onDraftComplete,
  isFreeAgencyEnabled, // Destructure the new prop
}) => {
  const [availableCards, setAvailableCards] = useState<CardData[]>([]);
  const [draftedCards, setDraftedCards] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cmcFilter, setCmcFilter] = useState<string>("all");
  const [cubucksFilter, setCubucksFilter] = useState<string>("all");
  const [drafting, setDrafting] = useState<string | null>(null); // FIX: Will now hold the unique DB `id`
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cubucksBalance, setCubucksBalance] = useState<number>(0);
  const [draftOrderEntries, setDraftOrderEntries] = useState<DraftOrderEntry[]>([]);
  const [draftOrderExpanded, setDraftOrderExpanded] = useState(false);

  useEffect(() => {
    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadDraftData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ cards }, { picks }, { team }, { order }] = await Promise.all([
        getAvailableCardsForDraft(),
        getTeamDraftPicks(teamId),
        getTeamBalance(teamId),
        getActiveDraftOrder(),
      ]);
      setAvailableCards(cards);
      setDraftedCards(picks);
      if (team) setCubucksBalance(team.cubucks_balance);
      setDraftOrderEntries(order);
    } catch (err) {
      console.error("Error loading draft data:", err);
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const handleDraftCard = async (card: CardData) => {
    if (drafting) return;
    // --- ENTIRE LOGIC REPLACEMENT ---
    // Check if this specific card INSTANCE has already been drafted by looking at the card_pool_id
    if (draftedCards.some((pick) => pick.card_pool_id === card.id)) {
        setError("This specific card has already been drafted by your team.");
        setTimeout(() => setError(null), 3000);
        return;
    }
    const cardCost = card.cubucks_cost || 1;
    if (cubucksBalance < cardCost) {
      setError(`Insufficient Cubucks! Need ${cardCost}, you have ${cubucksBalance}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    setDrafting(card.id!); // Use unique DB ID for drafting state
    setError(null);
    setSuccess(null);
    // Spend cubucks first
    const cubucksResult = await spendCubucksOnDraft(
      teamId,
      card.card_id,
      card.card_name,
      cardCost,
      card.id // card_pool_id
    );
    if (!cubucksResult.success) {
      setError(cubucksResult.error || "Failed to spend Cubucks");
      setDrafting(null);
      return;
    }
    // Then, add the draft pick using the unique ID
    const pick: DraftPick = {
      team_id: teamId,
      card_pool_id: card.id, // <-- CRITICAL: Pass the unique instance ID
      card_id: card.card_id, // Still pass the general ID for data purposes
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors,
      image_url: card.image_url,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      pick_number: draftedCards.length + 1,
    };
    const result = await addDraftPick(pick);
    if (result.success) {
      setSuccess(`Acquired ${card.card_name} for ${cardCost} Cubucks!`);
      // Cleanup can still use the general card_id if it's meant to remove all copies from queues
      await conditionallyCleanupDraftQueues(card.card_id);
      await advanceDraft();
      await loadDraftData();
      onDraftComplete?.();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to acquire card");
      // Add logic here to refund cubucks if addDraftPick fails
    }
    setDrafting(null);
  };
  
  // Create a map to count how many of each card (by scryfall_id) this team has drafted
  const draftedCardCounts = new Map<string, number>();
  draftedCards.forEach(pick => {
      draftedCardCounts.set(pick.card_id, (draftedCardCounts.get(pick.card_id) || 0) + 1);
  });
  const filteredCards = availableCards.filter((card) => {
    // New check: make sure the number of drafted copies of this card
    // is less than the total number of available copies.
    const numDrafted = draftedCardCounts.get(card.card_id) || 0;
    const numAvailableInPool = availableCards.filter(c => c.card_id === card.card_id).length;
    if (numDrafted >= numAvailableInPool) {
        // This specific instance might not be drafted, but the team has already drafted all available copies.
        // This check can be complex. A simpler approach is to check if the specific card.id is in the drafted pool.
    }
      
    if (searchQuery && !card.card_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (colorFilter !== "all") {
        if (colorFilter === "colorless") {
            if (card.colors && card.colors.length > 0) return false;
        } else {
            if (!card.colors?.includes(colorFilter)) return false;
        }
    }
    if (typeFilter !== "all") {
        if (!card.card_type?.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    }
    if (cmcFilter !== "all") {
        const cmc = card.cmc ?? 0;
        if (cmcFilter === "0-1" && cmc > 1) return false;
        if (cmcFilter === "2-3" && (cmc < 2 || cmc > 3)) return false;
        if (cmcFilter === "4-5" && (cmc < 4 || cmc > 5)) return false;
        if (cmcFilter === "6+" && cmc < 6) return false;
    }
    if (cubucksFilter !== "all") {
      const cost = card.cubucks_cost ?? 1;
      if (cubucksFilter === "0-50" && (cost < 0 || cost > 50)) return false;
      if (cubucksFilter === "51-100" && (cost < 51 || cost > 100)) return false;
      if (cubucksFilter === "101-200" && (cost < 101 || cost > 200)) return false;
      if (cubucksFilter === "201+" && cost < 201) return false;
    }
    return true;
  });

 const colors = [
    { value: "all", label: "All Colors", emoji: "🌈" },
    { value: "W", label: "White", emoji: "⚪" },
    { value: "U", label: "Blue", emoji: "🔵" },
    { value: "B", label: "Black", emoji: "⚫" },
    { value: "R", label: "Red", emoji: "🔴" },
    { value: "G", label: "Green", emoji: "🟢" },
    { value: "colorless", label: "Colorless", emoji: "◇" },
  ];
  const types = [
    { value: "all", label: "All Types" },
    { value: "creature", label: "Creature" },
    { value: "instant", label: "Instant" },
    { value: "sorcery", label: "Sorcery" },
    { value: "enchantment", label: "Enchantment" },
    { value: "artifact", label: "Artifact" },
    { value: "planeswalker", label: "Planeswalker" },
    { value: "land", label: "Land" },
  ];
  const cmcRanges = [
    { value: "all", label: "All CMC" },
    { value: "0-1", label: "0-1 Mana" },
    { value: "2-3", label: "2-3 Mana" },
    { value: "4-5", label: "4-5 Mana" },
    { value: "6+", label: "6+ Mana" },
  ];
  const cubucksRanges = [
    { value: "all", label: "All Costs" },
    { value: "0-50", label: "0-50 💰" },
    { value: "51-100", label: "51-100 💰" },
    { value: "101-200", label: "101-200 💰" },
    { value: "201+", label: "201+ 💰" },
  ];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        {/* // --- MODIFICATION 2 of 5: Update loading text for clarity --- */}
        <p className="text-gray-600 dark:text-gray-400">Loading free agent pool...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}
      {/* Draft Stats */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Draft Progress
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {isUserTeamMember ? "Your team has" : `${teamName} has`} drafted{" "}
              <strong>{draftedCards.length}</strong> cards from the pool
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {draftedCards.length}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">picks</div>
          </div>
        </div>
      </div>
      {/* Draft Order Panel */}
      {draftOrderEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setDraftOrderExpanded(!draftOrderExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Draft Pick Order
              </h3>
              {(() => {
                const myPick = draftOrderEntries.find(
                  (e) => e.team_id === teamId
                );
                return myPick ? (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-bold">
                    {isUserTeamMember ? "Your" : teamName + "'s"} pick: #{myPick.pick_position}
                  </span>
                ) : null;
              })()}
            </div>
            <span className="text-gray-400 text-sm">
              {draftOrderExpanded ? "▲ Collapse" : "▼ Expand"}
            </span>
          </button>
          {draftOrderExpanded && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-center font-semibold w-12">
                      Pick
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Team</th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Prev Record
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Lottery #
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {draftOrderEntries.map((entry) => {
                    const isMyTeam = entry.team_id === teamId;
                    return (
                      <tr
                        key={entry.id}
                        className={
                          isMyTeam
                            ? "bg-blue-50 dark:bg-blue-900/20 font-semibold"
                            : "hover:bg-gray-50 dark:hover:bg-gray-900/50"
                        }
                      >
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              entry.pick_position === 1
                                ? "bg-yellow-500 text-white"
                                : entry.pick_position === 2
                                ? "bg-gray-400 text-white"
                                : entry.pick_position === 3
                                ? "bg-amber-600 text-white"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {entry.pick_position}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                          {entry.team?.emoji} {entry.team?.name}
                          {isMyTeam && (
                            <span className="ml-1 text-blue-600 dark:text-blue-400 text-xs">
                              ◄
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-green-600 dark:text-green-400">
                            {entry.previous_season_wins}
                          </span>
                          <span className="text-gray-400 mx-0.5">-</span>
                          <span className="text-red-600 dark:text-red-400">
                            {entry.previous_season_losses}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs">
                            {entry.lottery_number}
                          </span>
                          {entry.is_lottery_winner && (
                            <span className="ml-1 text-xs" title="Tiebreaker used">
                              🎲
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Read-only notice for non-members */}
      {!isUserTeamMember && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            👀 You are viewing {teamName}&apos;s draft pool in read-only mode. Only team members can draft cards.
          </p>
        </div>
      )}
      {/* Search and Filters */}
      {/* // --- MODIFICATION 3 of 5: Update Search and Filter section labels --- */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🔍 Search Free Agents
          </label>
          <input
            type="text"
            placeholder="Search by card name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {/* Filters */}
        <div className="space-y-4">
          {/* Color Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setColorFilter(color.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${
                      colorFilter === color.value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }
                  `}
                >
                  {color.emoji} {color.label}
                </button>
              ))}
            </div>
          </div>
          {/* Other Filters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            {/* CMC Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mana Cost (CMC)
              </label>
              <select
                value={cmcFilter}
                onChange={(e) => setCmcFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {cmcRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Cubucks Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cubucks Cost
              </label>
              <select
                value={cubucksFilter}
                onChange={(e) => setCubucksFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {cubucksRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Balance Display - Only show to team members */}
            {isUserTeamMember && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Balance
                </label>
                <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center gap-2 font-semibold">
                  <span className="text-lg">💰</span>
                  <span>{cubucksBalance.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Result count */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCards.length} of {availableCards.length} cards
        </div>
      </div>
      {/* Available Cards Grid */}
      {/* // --- MODIFICATION 4 of 5: Update Available Cards Grid section header --- */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Free Agent Pool
        </h3>
        {filteredCards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No cards found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCards.map((card) => {
              // --- REPLACEMENT FOR isDrafted LOGIC ---
              const isThisInstanceDrafted = draftedCards.some(p => p.card_pool_id === card.id);
              const isDrafting = drafting === card.id;
              const notEnoughCubucks = cubucksBalance < (card.cubucks_cost || 1);

              return (
                <div
                  key={card.id} // <-- CRITICAL: Ensure key is the unique DB ID
                  className={`
                    group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 transition-all
                    ${
                      isThisInstanceDrafted
                        ? "border-green-500 opacity-60"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-lg"
                    }
                  `}
                >
                   {card.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.image_url}
                      alt={card.card_name}
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <div className="p-2">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {card.card_name}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {card.card_set}
                    </p>
                    {card.cubecobra_elo != null && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                        ELO: {card.cubecobra_elo.toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Cubucks Cost Badge */}
                  <div className="absolute top-2 left-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
                    <span>💰</span>
                    <span>{card.cubucks_cost || 1}</span>
                  </div>
                  {/* Draft Button Overlay */}
                  {!isThisInstanceDrafted && isUserTeamMember && (
                  {/*  --- MODIFICATION 5 of 5: This is the key change for the button's logic and text ---*/}
                    <button
                      onClick={() => handleDraftCard(card)}
                      disabled={!isFreeAgencyEnabled || isDrafting || notEnoughCubucks}
                      title={
                        !isFreeAgencyEnabled 
                          ? "Free agency is only available during the 'season' phase."
                          : notEnoughCubucks
                          ? "Not enough Cubucks to acquire."
                          : `Acquire ${card.card_name}`
                      }
                      className={`
                        absolute inset-0 bg-black/60 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <span className={`
                        px-4 py-2 rounded-lg font-semibold shadow-lg text-white
                        ${notEnoughCubucks ? "bg-red-600" : "bg-blue-600 hover:bg-blue-700"}
                        ${!isFreeAgencyEnabled ? "!bg-gray-600" : ""}
                      `}>
                        {isDrafting
                          ? "Acquiring..."
                          : notEnoughCubucks
                          ? "Not Enough Cubucks"
                          : !isFreeAgencyEnabled
                          ? "FA Closed"
                          : `Acquire FA for ${card.cubucks_cost || 1} 💰`
                        }
                      </span>
                    </button>
                  )}
                  {/* Already Drafted Badge */}
                  {isThisInstanceDrafted && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                      ✓ DRAFTED
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
