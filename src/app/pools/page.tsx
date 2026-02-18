// src/app/pools/page.tsx
"use client";

import React, { useState, useEffect } from "react";
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
        const mainType = card.card_type.split(/[\s\u2014-]/)[0];
        types.add(mainType);
      }
    });
    return Array.from(types).sort();
  };

  const colorMap: { [key: string]: { name: string; emoji: string } } = {
    W: { name: "White", emoji: "\u2600\uFE0F" },
    U: { name: "Blue", emoji: "\uD83D\uDCA7" },
    B: { name: "Black", emoji: "\uD83D\uDC80" },
    R: { name: "Red", emoji: "\uD83D\uDD25" },
    G: { name: "Green", emoji: "\uD83C\uDF32" },
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
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Card Pool
        </h1>
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
              <div className="text-3xl font-bold mb-1">
                {stats.totalCards}
              </div>
              <div className="text-sm text-muted-foreground">Total Cards</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <CircleDashed className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">
                {stats.availableCards}
              </div>
              <div className="text-sm text-muted-foreground">Available</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-5 w-5 text-orange-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">
                {stats.draftedCards}
              </div>
              <div className="text-sm text-muted-foreground">Drafted</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <BarChart3 className="h-5 w-5 text-violet-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">
                {stats.draftPercentage}%
              </div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="lg:col-span-3">
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

            {/* Status Filter */}
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

            {/* Color Filter */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Color
              </label>
              <Select value={filterColor} onValueChange={setFilterColor}>
                <SelectTrigger>
                  <SelectValue placeholder="All Colors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colors</SelectItem>
                  {getUniqueColors().map((color) => (
                    <SelectItem key={color} value={color}>
                      {colorMap[color]?.emoji || ""} {colorMap[color]?.name || color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
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
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CMC Filter */}
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
                  <SelectItem value="0-1">0-1 Mana</SelectItem>
                  <SelectItem value="2-3">2-3 Mana</SelectItem>
                  <SelectItem value="4-5">4-5 Mana</SelectItem>
                  <SelectItem value="6+">6+ Mana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cubucks Filter */}
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
                  <SelectItem value="0-50">0-50</SelectItem>
                  <SelectItem value="51-100">51-100</SelectItem>
                  <SelectItem value="101-200">101-200</SelectItem>
                  <SelectItem value="201+">201+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredCards.length} of {cards.length} cards
          </div>
        </CardContent>
      </Card>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg text-muted-foreground mb-2">
              No cards found
            </p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                card.is_drafted
                  ? "border-muted opacity-60 hover:opacity-80"
                  : "border-border hover:border-primary hover:shadow-xl hover:-translate-y-1"
              }`}
            >
              {/* Card Image */}
              {card.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={card.image_url}
                  alt={card.card_name}
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-full aspect-[5/7] bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-xs text-center px-2">
                    {card.card_name}
                  </span>
                </div>
              )}

              {/* Drafted Badge */}
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

              {/* Hover Overlay */}
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
          ))}
        </div>
      )}
    </div>
  );
}
