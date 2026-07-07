// src/app/pools/draft/page.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getPoolCardsWithStatus, getPoolStatistics, getCardsForPool } from "@/app/actions/poolActions";
import type { PoolCard } from "@/app/actions/poolActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { Search, Layers, CheckCircle2, CircleDashed, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

const CARDS_PER_PAGE = 20;

export default function PoolsPage() {
  const { useOldestArt } = useSettings();
  const [cards, setCards] = useState<PoolCard[]>([]);
  const [filteredAndSortedCards, setFilteredAndSortedCards] = useState<PoolCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "drafted">("all");
  const [filterColors, setFilterColors] = useState<string[]>([]);
  
  // NEW: Granular Color Logic States
  const [matchAllColors, setMatchAllColors] = useState(false);
  const [excludeUnselected, setExcludeUnselected] = useState(false);
  
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all"); 
  const [filterCmc, setFilterCmc] = useState("all");
  const [filterCubucks, setFilterCubucks] = useState("all");
  const [sortBy, setSortBy] = useState("card_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState<{
    totalCards: number;
    draftedCards: number;
    availableCards: number;
  } | null>(null);

  useEffect(() => {
    loadPoolData();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, searchTerm, filterStatus, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAndSortedCards]);

  const loadPoolData = async () => {
    setLoading(true);
    try {
      const { cards: poolCards, error: cardsError } = await getCardsForPool("draft");
      if (cardsError) {
        setError(cardsError);
      } else {
        setCards(poolCards);
      }
      const { stats: poolStats, error: statsError } = await getPoolStatistics("draft");
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

  const applyFiltersAndSorting = () => {
    let filtered = [...cards];
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(lowerSearch) ||
        (card.oracle_text && card.oracle_text.toLowerCase().includes(lowerSearch))
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
        const cardColors = card.colors || [];
        const isColorless = cardColors.length === 0;

        if (wantColorless && wantedColors.length === 0) return isColorless;
        if (isColorless) return wantColorless && !matchAllColors;

        const hasAll = wantedColors.every(c => cardColors.includes(c));
        const hasAny = wantedColors.some(c => cardColors.includes(c));
        const hasOnly = cardColors.every(c => wantedColors.includes(c));

        if (matchAllColors && excludeUnselected) return hasAll && hasOnly;
        if (matchAllColors) return hasAll;
        if (excludeUnselected) return hasOnly;
        
        return hasAny || (wantColorless && isColorless);
      });
    }

    if (filterType !== "all") {
      filtered = filtered.filter((card) =>
        card.card_type && card.card_type.toLowerCase().includes(filterType.toLowerCase())
      );
    }

    if (filterRarity !== "all") {
        filtered = filtered.filter((card) =>
            card.rarity && card.rarity.toLowerCase() === filterRarity.toLowerCase()
        );
    }

    if (filterCmc !== "all") {
        filtered = filtered.filter((card) => {
            const cmc = card.cmc ?? 0;
            if (filterCmc === "0-1") return cmc <= 1;
            if (filterCmc === "2-3") return cmc >= 2 && cmc <= 3;
            if (filterCmc === "4-5") return cmc >= 4 && cmc <= 5;
            if (filterCmc === "6+") return cmc >= 6;
            return true;
        });
    }

    if (filterCubucks !== "all") {
        filtered = filtered.filter((card) => {
            const cost = card.cubucks_cost ?? 1;
            if (filterCubucks === "0-1") return cost <= 1;
            if (filterCubucks === "2-3") return cost >= 1 && cost <= 3;
            if (filterCubucks === "4-6") return cost >= 4 && cost <= 6;
            if (filterCubucks === "7+") return cost >= 7;
            return true;
        });
    }

    const sorted = filtered.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'cmc':
          valA = a.cmc ?? 0;
          valB = b.cmc ?? 0;
          break;
        case 'cubucks_cost':
          valA = a.cubucks_cost ?? 1;
          valB = b.cubucks_cost ?? 1;
          break;
        case 'elo':
          valA = a.cubecobra_elo ?? 0;
          valB = b.cubecobra_elo ?? 0;
          break;
        default: 
          valA = a.card_name.toLowerCase();
          valB = b.card_name.toLowerCase();
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        const numA = typeof valA === 'number' ? valA : 0;
        const numB = typeof valB === 'number' ? valB : 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
    });

    setFilteredAndSortedCards(sorted);
  };

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    cards.forEach((card) => {
        if (card.card_type) {
            const mainType = card.card_type.split(/[\s—–\/]+/)[0];
            types.add(mainType);
        }
    });
    return Array.from(types).sort();
  }, [cards]);
 
  const totalPages = Math.ceil(filteredAndSortedCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredAndSortedCards.slice(
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
                      <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Pool</h2>
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
          <h1 className="text-4xl font-bold tracking-tight mb-2">The Draft Pool</h1>
          <p className="text-muted-foreground text-lg">Browse all cards in The Draft Pool</p>
      </div>

      {/* Statistics */}
      {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card><CardContent className="pt-6 text-center"><Layers className="h-5 w-5 text-primary mx-auto mb-2" /><div className="text-3xl font-bold mb-1">{stats.totalCards}</div><div className="text-sm text-muted-foreground">Total Cards</div></CardContent></Card>
          </div>
      )}

      <PoolFilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        filterColors={filterColors} setFilterColors={setFilterColors}
        matchAllColors={matchAllColors} setMatchAllColors={setMatchAllColors}
        excludeUnselected={excludeUnselected} setExcludeUnselected={setExcludeUnselected}
        filterType={filterType} setFilterType={setFilterType}
        filterRarity={filterRarity} setFilterRarity={setFilterRarity}
        filterCmc={filterCmc} setFilterCmc={setFilterCmc}
        filterCubucks={filterCubucks} setFilterCubucks={setFilterCubucks}
        sortBy={sortBy} setSortBy={setSortBy}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        uniqueTypes={uniqueTypes}
        showStatusFilter={true} 
        filterStatus={filterStatus} 
        setFilterStatus={(val) => setFilterStatus(val as "all" | "available" | "drafted")}
        filteredCount={filteredAndSortedCards.length}
        totalCount={cards.length}
        currentPage={currentPage}
        cardsPerPage={CARDS_PER_PAGE}
      />

      {/* Cards Grid */}
      {filteredAndSortedCards.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><p className="text-lg text-muted-foreground mb-2">No cards found</p><p className="text-sm text-muted-foreground">Try adjusting your filters</p></CardContent></Card>
      ) : (
          <>
              {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
                      <div className="flex items-center gap-1 flex-wrap justify-center">
                          {getPageNumbers().map((page, idx) => page === "ellipsis" ? (<span key={`el-${idx}`} className="px-2 text-muted-foreground select-none">…</span>) : (<button key={page} onClick={() => setCurrentPage(page as number)} className={`min-w-[2.75rem] h-11 px-2 rounded-lg font-medium transition-colors touch-manipulation ${currentPage === page ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{page}</button>))}
                      </div>
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
                  </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {paginatedCards.map((card) => {
                      const imageUrl = getCardImageUrl(card, useOldestArt);
                      return (
                          // THE FIX: Added data-mtg-card-container and data-card-name here!
                          <div 
                              key={card.id} 
                              data-mtg-card-container="true"
                              data-card-name={card.card_name}
                              className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 ${card.is_drafted ? "border-muted opacity-60 hover:opacity-80" : "border-border hover:border-primary hover:shadow-xl hover:-translate-y-1"}`}
                          >
                              {imageUrl ? (<Image src={imageUrl} alt={card.card_name} width={745} height={1040} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="w-full h-auto" unoptimized />) : (<div className="w-full aspect-[5/7] bg-muted flex items-center justify-center"><span className="text-muted-foreground text-xs text-center px-2">{card.card_name}</span></div>)}
                              
                              {card.is_drafted && card.drafted_by_team && (
                                  <div className="absolute top-2 right-2"><Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-lg gap-1" title={`Drafted by ${card.drafted_by_team.name}`}><span className="text-base">{card.drafted_by_team.emoji}</span><span>DRAFTED</span></Badge></div>
                              )}
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                                  <div className="text-white">
                                      <p className="font-bold text-sm mb-1">{card.card_name}</p>
                                      <p className="text-xs opacity-90">{card.card_type}</p>
                                      {card.card_set && (<p className="text-xs opacity-75 mt-1">{card.card_set}</p>)}
                                      {card.cubecobra_elo != null && (<p className="text-xs mt-1"><span className="bg-purple-500/80 px-1.5 py-0.5 rounded text-white font-medium">ELO: {card.cubecobra_elo.toLocaleString()}</span></p>)}
                                      {card.is_drafted && card.drafted_by_team && (
                                          <div className="mt-2 pt-2 border-t border-white/20">
                                              <p className="text-xs">{card.drafted_by_team.emoji} {card.drafted_by_team.name}</p>
                                              {card.drafted_at && (<p className="text-xs opacity-75">{new Date(card.drafted_at).toLocaleDateString()}</p>)}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>

              {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
                      <button onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
                      <span className="text-sm text-muted-foreground font-medium">Page {currentPage} of {totalPages}</span>
                      <button onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
                  </div>
              )}
          </>
      )}
    </div>
  );
}
