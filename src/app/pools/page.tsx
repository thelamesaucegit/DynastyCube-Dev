// src/app/pools/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { getPoolCardsWithStatus, getPoolStatistics } from "@/app/actions/poolActions";
import type { PoolCard } from "@/app/actions/poolActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Search, Layers, CheckCircle2, CircleDashed, BarChart3, Loader2 } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

const CARDS_PER_PAGE = 20;

const COLOR_OPTIONS = [
  { value: "all",       label: "All",      emoji: "🌈" },
  { value: "W",         label: "White",    emoji: "⚪" },
  { value: "U",         label: "Blue",     emoji: "🔵" },
  { value: "B",         label: "Black",    emoji: "⚫" },
  { value: "R",         label: "Red",      emoji: "🔴" },
  { value: "G",         label: "Green",    emoji: "🟢" },
  { value: "colorless", label: "Colorless",emoji: "◇"  },
];

export default function PoolsPage() {
  const { useOldestArt } = useSettings();
  const [cards, setCards] = useState<PoolCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<PoolCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "drafted">("all");
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCmc, setFilterCmc] = useState<string>("all");
  const [filterCubucks, setFilterCubucks] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
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
    filterAndSetCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, searchTerm, filterStatus, filterColors, filterType, filterCmc, filterCubucks]);

  // Reset to page 1 whenever the filtered results change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredCards]);

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

  const filterAndSetCards = () => {
    let filtered = [...cards];

    if (searchTerm) {
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus === "available") {
      filtered = filtered.filter((card) => !card.is_drafted);
    } else if (filterStatus === "drafted") {
      filtered = filtered.filter((card) => card.is_drafted);
    }

    if (filterColors.length > 0) {
      const wantColorless = filterColors.includes("colorless");
      const wantedColors = filterColors.filter((c) => c !== "colorless");
      filtered = filtered.filter((card) => {
        const cardIsColorless = !card.colors || card.colors.length === 0;
        const cardMatchesColor = wantedColors.some((c) => card.colors?.includes(c));
        return (wantColorless && cardIsColorless) || cardMatchesColor;
      });
    }

    if (filterType !== "all") {
      filtered = filtered.filter((card) =>
        card.card_type && card.card_type.toLowerCase().includes(filterType.toLowerCase())
      );
    }

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

  const getUniqueTypes = () => {
    const types = new Set<string>();
    cards.forEach((card) => {
      if (card.card_type) {
        const mainType = card.card_type.split(/[\s—-]+/)[0];
        types.add(mainType);
      }
    });
    return Array.from(types).sort();
  };

  const toggleColor = (value: string) => {
    if (value === "all") {
      setFilterColors([]);
      return;
    }
    setFilterColors((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  );

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading card pool...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">
              Error Loading Pool
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Card Pool</h1>
        <p className="text-muted-foreground text-lg">
          Browse all cards in the Dynasty Cube draft pool
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <Layers className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">{stats.totalCards}</div>
              <div className="text-sm text-muted-foreground">Total Cards</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CircleDashed className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">{stats.availableCards}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-5 w-5 text-orange-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">{stats.draftedCards}</div>
              <div className="text-sm text-muted-foreground">Drafted</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BarChart3 className="h-5 w-5 text-violet-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">{stats.draftPercentage}%</div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Card name..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Color Filter — multi-select toggles */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Color <span className="text-xs font-normal opacity-60">(select multiple)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => {
                const isActive = color.value === "all"
                  ? filterColors.length === 0
                  : filterColors.includes(color.value);
                return (
                  <button
                    key={color.value}
                    onClick={() => toggleColor(color.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {color.emoji} {color.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Other filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Status
              </label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "available" | "drafted")}>
                <SelectTrigger>
                  <SelectValue placeholder="All Cards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cards</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="drafted">Drafted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Type
              </label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {getUniqueTypes().map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Mana Cost (CMC)
              </label>
              <Select value={filterCmc} onValueChange={setFilterCmc}>
                <SelectTrigger>
                  <SelectValue placeholder="All CMC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CMC</SelectItem>
                  <SelectItem value="0-1">0–1 Mana</SelectItem>
                  <SelectItem value="2-3">2–3 Mana</SelectItem>
                  <SelectItem value="4-5">4–5 Mana</SelectItem>
                  <SelectItem value="6+">6+ Mana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Cubucks Cost
              </label>
              <Select value={filterCubucks} onValueChange={setFilterCubucks}>
                <SelectTrigger>
                  <SelectValue placeholder="All Costs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Costs</SelectItem>
                  <SelectItem value="0-50">0–50</SelectItem>
                  <SelectItem value="51-100">51–100</SelectItem>
                  <SelectItem value="101-200">101–200</SelectItem>
                  <SelectItem value="201+">201+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {filteredCards.length === 0
              ? `0 of ${cards.length} cards`
              : `Showing ${(currentPage - 1) * CARDS_PER_PAGE + 1}–${Math.min(currentPage * CARDS_PER_PAGE, filteredCards.length)} of ${filteredCards.length} cards`
            }
          </div>
        </CardContent>
      </Card>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg text-muted-foreground mb-2">No cards found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {getPageNumbers().map((page, idx) =>
                  page === "ellipsis" ? (
                    <span key={`el-${idx}`} className="px-2 text-muted-foreground select-none">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2.75rem] h-11 px-2 rounded-lg font-medium transition-colors touch-manipulation ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation"
              >
                Next →
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {paginatedCards.map((card) => {
              const imageUrl = getCardImageUrl(card, useOldestArt);
              return (
                <div
                  key={card.id}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    card.is_drafted
                      ? "border-muted opacity-60 hover:opacity-80"
                      : "border-border hover:border-primary hover:shadow-xl hover:-translate-y-1"
                  }`}
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={card.card_name}
                      width={745}
                      height={1040}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="w-full aspect-[5/7] bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs text-center px-2">
                        {card.card_name}
                      </span>
                    </div>
                  )}

                  {card.is_drafted && card.drafted_by_team && (
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant="secondary"
                        className="bg-background/90 backdrop-blur-sm shadow-lg gap-1"
                        title={`Drafted by ${card.drafted_by_team.name}`}
                      >
                        <span className="text-base">{card.drafted_by_team.emoji}</span>
                        <span>DRAFTED</span>
                      </Badge>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                    <div className="text-white">
                      <p className="font-bold text-sm mb-1">{card.card_name}</p>
                      <p className="text-xs opacity-90">{card.card_type}</p>
                      {card.card_set && (
                        <p className="text-xs opacity-75 mt-1">{card.card_set}</p>
                      )}
                      {card.cubecobra_elo != null && (
                        <p className="text-xs mt-1">
                          <span className="bg-purple-500/80 px-1.5 py-0.5 rounded text-white font-medium">
                            ELO: {card.cubecobra_elo.toLocaleString()}
                          </span>
                        </p>
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
              );
            })}
          </div>

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
              <button
                onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation"
              >
                ← Prev
              </button>
              <span className="text-sm text-muted-foreground font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
