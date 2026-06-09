// src/app/pools/retired/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getRetiredCards, type RetiredCard } from "@/app/actions/retiredActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { Ghost, Loader2 } from "lucide-react";

const CARDS_PER_PAGE = 20;

export default function RetiredPoolPage() {
  const { useOldestArt } = useSettings();
  const [cards, setCards] = useState<RetiredCard[]>([]);
  const [filteredAndSortedCards, setFilteredAndSortedCards] = useState<RetiredCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [matchAllColors, setMatchAllColors] = useState(false);
  const [excludeUnselected, setExcludeUnselected] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterCmc, setFilterCmc] = useState("all");
  const [filterCubucks, setFilterCubucks] = useState("all");
  const [sortBy, setSortBy] = useState("card_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadPoolData();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, searchTerm, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAndSortedCards]);

  const loadPoolData = async () => {
    setLoading(true);
    try {
      const { cards: retiredCards, error: cardsError } = await getRetiredCards();
      if (cardsError) {
        setError(cardsError);
      } else {
        setCards(retiredCards || []);
      }
    } catch (err) {
      console.error("Error loading retired cards:", err);
      setError("Failed to load retired cards pool");
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSorting = () => {
    let filtered = [...cards];

    if (searchTerm) {
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
            if (filterCubucks === "2-3") return cost >= 2 && cost <= 3;
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

  const customCubuckRanges = [
    { value: "all", label: "All Costs" },
    { value: "0-1", label: "0-1 Ç" },
    { value: "2-3", label: "2-3 Ç" },
    { value: "4-6", label: "4-6 Ç" },
    { value: "7+", label: "7+ Ç" },
  ];

  const totalPages = Math.ceil(filteredAndSortedCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredAndSortedCards.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  );

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  if (loading) {
    return (
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading Retirement Hall...</p>
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
      <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">The Retirement Pool</h1>
          <p className="text-muted-foreground text-lg">Where cards go once they are ready to Rest. These cards are excluded from active play.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <Ghost className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <div className="text-3xl font-bold mb-1">{cards.length}</div>
              <div className="text-sm text-muted-foreground">Retired Cards</div>
            </CardContent>
          </Card>
      </div>

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
        cubucksRanges={customCubuckRanges}
        filteredCount={filteredAndSortedCards.length}
        totalCount={cards.length}
        currentPage={currentPage}
        cardsPerPage={CARDS_PER_PAGE}
      />

      {filteredAndSortedCards.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><p className="text-lg text-muted-foreground mb-2">No cards in retirement match your filters.</p></CardContent></Card>
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
                          <div key={card.id} className="relative group rounded-lg overflow-hidden border-2 border-border bg-zinc-950/40 opacity-70 hover:opacity-100 transition-all duration-200">
                              {imageUrl ? (<Image src={imageUrl} alt={card.card_name} width={745} height={1040} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-300" />) : (<div className="w-full aspect-[5/7] bg-muted flex items-center justify-center"><span className="text-muted-foreground text-xs text-center px-2">{card.card_name}</span></div>)}
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                                  <div className="text-white font-mono">
                                      <p className="font-bold text-sm mb-1">{card.card_name}</p>
                                      <p className="text-xs opacity-90">{card.card_type}</p>
                                      {card.card_set && (<p className="text-xs opacity-75 mt-1">{card.card_set}</p>)}
                                      {card.retired_at && (
                                          <p className="text-[10px] text-red-500 uppercase tracking-widest font-black mt-2">
                                              Retired {new Date(card.retired_at).toLocaleDateString()}
                                          </p>
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
