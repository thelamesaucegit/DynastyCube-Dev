// src/app/components/DraftInterface.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAvailableCardsForDraft } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addDraftPick } from "@/app/actions/draftActions";
import { getTeamBalance, spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import type { CardData } from "@/app/actions/cardActions";
import type { DraftPick } from "@/app/actions/draftActions";

interface DraftInterfaceProps {
  teamId: string;
  onDraftComplete?: () => void;
}

export const DraftInterface: React.FC<DraftInterfaceProps> = ({
  teamId,
  onDraftComplete,
}) => {
  const [availableCards, setAvailableCards] = useState<CardData[]>([]);
  const [draftedCards, setDraftedCards] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cmcFilter, setCmcFilter] = useState<string>("all");
  const [cubucksFilter, setCubucksFilter] = useState<string>("all");
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cubucksBalance, setCubucksBalance] = useState<number>(0);

  useEffect(() => {
    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadDraftData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load available cards from pool (excludes cards already drafted by other teams)
      const { cards } = await getAvailableCardsForDraft();
      setAvailableCards(cards);

      // Load already drafted cards for this team
      const { picks } = await getTeamDraftPicks(teamId);
      setDraftedCards(picks);

      // Load team's cubucks balance
      const { team } = await getTeamBalance(teamId);
      if (team) {
        setCubucksBalance(team.cubucks_balance);
      }
    } catch (err) {
      console.error("Error loading draft data:", err);
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const handleDraftCard = async (card: CardData) => {
    if (drafting) return;

    // Check if already drafted
    if (draftedCards.some((pick) => pick.card_id === card.card_id)) {
      setError("This card has already been drafted by your team");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check if team has enough cubucks
    const cardCost = card.cubucks_cost || 1;
    if (cubucksBalance < cardCost) {
      setError(`Insufficient Cubucks! Need ${cardCost}, you have ${cubucksBalance}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setDrafting(card.card_id);
    setError(null);
    setSuccess(null);

    // First, spend the cubucks (this also marks the card as drafted for dynamic pricing)
    const cubucksResult = await spendCubucksOnDraft(
      teamId,
      card.card_id,
      card.card_name,
      cardCost,
      card.id, // card_pool_id - important for dynamic pricing!
      undefined // draft_pick_id - will be set after we create the pick
    );

    if (!cubucksResult.success) {
      setError(cubucksResult.error || "Failed to spend Cubucks");
      setDrafting(null);
      return;
    }

    // Then, add the draft pick to the team
    const pick: DraftPick = {
      team_id: teamId,
      card_id: card.card_id,
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
      setSuccess(`Drafted ${card.card_name} for ${cardCost} Cubucks!`);
      await loadDraftData(); // Reload to update balance
      onDraftComplete?.();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to draft card");
    }

    setDrafting(null);
  };

  // Filter cards based on search and filters
  const filteredCards = availableCards.filter((card) => {
    // Search filter
    if (
      searchQuery &&
      !card.card_name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Color filter
    if (colorFilter !== "all") {
      if (colorFilter === "colorless") {
        if (card.colors && card.colors.length > 0) return false;
      } else {
        if (!card.colors?.includes(colorFilter)) return false;
      }
    }

    // Type filter
    if (typeFilter !== "all") {
      if (!card.card_type?.toLowerCase().includes(typeFilter.toLowerCase())) {
        return false;
      }
    }

    // CMC filter
    if (cmcFilter !== "all") {
      const cmc = card.cmc ?? 0;
      if (cmcFilter === "0-1" && (cmc < 0 || cmc > 1)) return false;
      if (cmcFilter === "2-3" && (cmc < 2 || cmc > 3)) return false;
      if (cmcFilter === "4-5" && (cmc < 4 || cmc > 5)) return false;
      if (cmcFilter === "6+" && cmc < 6) return false;
    }

    // Cubucks filter
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
        <p className="text-gray-600 dark:text-gray-400">Loading draft pool...</p>
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
              Your team has drafted{" "}
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

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🔍 Search Cards
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

            {/* Balance Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Balance
              </label>
              <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center gap-2 font-semibold">
                <span className="text-lg">💰</span>
                <span>{cubucksBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result count */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCards.length} of {availableCards.length} cards
        </div>
      </div>

      {/* Available Cards Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Available Cards
        </h3>

        {filteredCards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No cards found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCards.map((card) => {
              const isDrafted = draftedCards.some(
                (pick) => pick.card_id === card.card_id
              );
              const isDrafting = drafting === card.card_id;

              return (
                <div
                  key={card.id || card.card_id}
                  className={`
                    group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 transition-all
                    ${
                      isDrafted
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
                  </div>

                  {/* Cubucks Cost Badge */}
                  <div className="absolute top-2 left-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
                    <span>💰</span>
                    <span>{card.cubucks_cost || 1}</span>
                  </div>

                  {/* Draft Button Overlay */}
                  {!isDrafted && (
                    <button
                      onClick={() => handleDraftCard(card)}
                      disabled={isDrafting || cubucksBalance < (card.cubucks_cost || 1)}
                      className={`
                        absolute inset-0 bg-black/60 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <span className={`
                        px-4 py-2 rounded-lg font-semibold shadow-lg
                        ${cubucksBalance < (card.cubucks_cost || 1)
                          ? "bg-red-600 text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                        }
                      `}>
                        {isDrafting
                          ? "Drafting..."
                          : cubucksBalance < (card.cubucks_cost || 1)
                          ? "Not Enough Cubucks"
                          : `Draft for ${card.cubucks_cost || 1} 💰`
                        }
                      </span>
                    </button>
                  )}

                  {/* Already Drafted Badge */}
                  {isDrafted && (
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
