// src/app/pools/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { getPoolCardsWithStatus, getPoolStatistics } from "@/app/actions/poolActions";
import type { PoolCard } from "@/app/actions/poolActions";

export default function PoolsPage() {
  const [cards, setCards] = useState<PoolCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<PoolCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "drafted">("all");
  const [filterColor, setFilterColor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCmc, setFilterCmc] = useState<string>("all");
  const [filterCubucks, setFilterCubucks] = useState<string>("all");
  const [stats, setStats] = useState<{
    totalCards: number;
    draftedCards: number;
    availableCards: number;
    draftPercentage: number;
  } | null>(null);

  useEffect(() => {
    loadPoolData();
  }, []);

  useEffect(() => {
    filterCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, searchTerm, filterStatus, filterColor, filterType, filterCmc, filterCubucks]);

  const loadPoolData = async () => {
    setLoading(true);
    try {
      const { cards: poolCards, error: cardsError } = await getPoolCardsWithStatus();
      if (cardsError) {
        setError(cardsError);
      } else {
        setCards(poolCards);
      }

      const { stats: poolStats, error: statsError } = await getPoolStatistics();
      if (!statsError && poolStats) {
        setStats(poolStats);
      }
    } catch (err) {
      console.error("Error loading pool data:", err);
      setError("Failed to load pool data");
    } finally {
      setLoading(false);
    }
  };

  const filterCards = () => {
    let filtered = [...cards];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus === "available") {
      filtered = filtered.filter((card) => !card.is_drafted);
    } else if (filterStatus === "drafted") {
      filtered = filtered.filter((card) => card.is_drafted);
    }

    // Color filter
    if (filterColor !== "all") {
      filtered = filtered.filter((card) =>
        card.colors && card.colors.includes(filterColor)
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((card) =>
        card.card_type && card.card_type.toLowerCase().includes(filterType.toLowerCase())
      );
    }

    // CMC filter
    if (filterCmc !== "all") {
      filtered = filtered.filter((card) => {
        const cmc = card.cmc ?? 0;
        if (filterCmc === "0-1") return cmc >= 0 && cmc <= 1;
        if (filterCmc === "2-3") return cmc >= 2 && cmc <= 3;
        if (filterCmc === "4-5") return cmc >= 4 && cmc <= 5;
        if (filterCmc === "6+") return cmc >= 6;
        return true;
      });
    }

    // Cubucks filter
    if (filterCubucks !== "all") {
      filtered = filtered.filter((card) => {
        const cost = card.cubucks_cost ?? 1;
        if (filterCubucks === "0-50") return cost >= 0 && cost <= 50;
        if (filterCubucks === "51-100") return cost >= 51 && cost <= 100;
        if (filterCubucks === "101-200") return cost >= 101 && cost <= 200;
        if (filterCubucks === "201+") return cost >= 201;
        return true;
      });
    }

    setFilteredCards(filtered);
  };

  const getUniqueColors = () => {
    const colors = new Set<string>();
    cards.forEach((card) => {
      if (card.colors) {
        card.colors.forEach((c) => colors.add(c));
      }
    });
    return Array.from(colors).sort();
  };

  const getUniqueTypes = () => {
    const types = new Set<string>();
    cards.forEach((card) => {
      if (card.card_type) {
        const mainType = card.card_type.split(/[\s—-]/)[0];
        types.add(mainType);
      }
    });
    return Array.from(types).sort();
  };

  const colorMap: { [key: string]: { name: string; emoji: string } } = {
    W: { name: "White", emoji: "☀️" },
    U: { name: "Blue", emoji: "💧" },
    B: { name: "Black", emoji: "💀" },
    R: { name: "Red", emoji: "🔥" },
    G: { name: "Green", emoji: "🌲" },
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading card pool...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Error Loading Pool
            </h2>
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🎴 Card Pool
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse all cards in the Dynasty Cube draft pool
          </p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                {stats.totalCards}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">Total Cards</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                {stats.availableCards}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">Available</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border border-orange-200 dark:border-orange-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                {stats.draftedCards}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">Drafted</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {stats.draftPercentage}%
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">Completion</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔍 Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Card name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "available" | "drafted")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Cards</option>
                <option value="available">Available</option>
                <option value="drafted">Drafted</option>
              </select>
            </div>

            {/* Color Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Colors</option>
                {getUniqueColors().map((color) => (
                  <option key={color} value={color}>
                    {colorMap[color]?.emoji || ""} {colorMap[color]?.name || color}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                {getUniqueTypes().map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                value={filterCmc}
                onChange={(e) => setFilterCmc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All CMC</option>
                <option value="0-1">0-1 Mana</option>
                <option value="2-3">2-3 Mana</option>
                <option value="4-5">4-5 Mana</option>
                <option value="6+">6+ Mana</option>
              </select>
            </div>

            {/* Cubucks Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cubucks Cost
              </label>
              <select
                value={filterCubucks}
                onChange={(e) => setFilterCubucks(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Costs</option>
                <option value="0-50">0-50 💰</option>
                <option value="51-100">51-100 💰</option>
                <option value="101-200">101-200 💰</option>
                <option value="201+">201+ 💰</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredCards.length} of {cards.length} cards
          </div>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <p className="text-lg text-gray-500 dark:text-gray-500 mb-2">
              No cards found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-600">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  card.is_drafted
                    ? "border-gray-400 dark:border-gray-600 opacity-60 hover:opacity-80"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl"
                }`}
              >
                {/* Card Image */}
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.card_name}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="w-full aspect-[5/7] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400 text-xs text-center px-2">
                      {card.card_name}
                    </span>
                  </div>
                )}

                {/* Drafted Badge */}
                {card.is_drafted && card.drafted_by_team && (
                  <div className="absolute top-2 right-2">
                    <div
                      className="bg-gray-900/90 dark:bg-gray-800/90 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-lg"
                      title={`Drafted by ${card.drafted_by_team.name}`}
                    >
                      <span className="text-base">{card.drafted_by_team.emoji}</span>
                      <span>DRAFTED</span>
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <div className="text-white">
                    <p className="font-bold text-sm mb-1">{card.card_name}</p>
                    <p className="text-xs opacity-90">{card.card_type}</p>
                    {card.card_set && (
                      <p className="text-xs opacity-75 mt-1">{card.card_set}</p>
                    )}
                    {card.is_drafted && card.drafted_by_team && (
                      <div className="mt-2 pt-2 border-t border-white/20">
                        <p className="text-xs">
                          {card.drafted_by_team.emoji} {card.drafted_by_team.name}
                        </p>
                        {card.drafted_at && (
                          <p className="text-xs opacity-75">
                            {new Date(card.drafted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
