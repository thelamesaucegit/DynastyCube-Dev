// src/app/pools/resort/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getResortCards, type ResortCard } from "@/app/actions/resortActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTeam } from "@/app/actions/teamActions";
import { Loader2, AlertCircle, Info, Layers } from "lucide-react";
import { ResortNominationCard } from "@/app/components/ResortNominationCard";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { Card, CardContent } from "@/app/components/ui/card";

interface Team {
  id: string;
  name: string;
  emoji: string;
}

const CARDS_PER_PAGE = 20;

export default function ResortPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [resortCards, setResortCards] = useState<ResortCard[]>([]);
  const [filteredAndSortedCards, setFilteredAndSortedCards] = useState<ResortCard[]>([]);
  const [isPostseason, setIsPostseason] = useState(false);
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

  const loadPageData = useCallback(async () => {
    if (user === undefined) return;
    setLoading(true);
    setError(null);
    try {
      const [cardResult, seasonResult, teamResult] = await Promise.all([
        getResortCards(),
        getCurrentSeason(),
        user?.email ? getUserTeam(user.email) : Promise.resolve({ team: null, error: undefined })
      ]);

      if (cardResult.error) setError(cardResult.error);
      else setResortCards(cardResult.cards || []);

      if (seasonResult.error || !seasonResult.season) {
         setIsPostseason(false);
      } else {
         setIsPostseason(seasonResult.season.phase === 'postseason');
      }
      
      setTeam(teamResult.team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPageData(); }, [loadPageData]);

  useEffect(() => {
    applyFiltersAndSorting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resortCards, searchTerm, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder]);

  useEffect(() => { setCurrentPage(1); }, [filteredAndSortedCards]);

  const applyFiltersAndSorting = () => {
    let filtered = [...resortCards];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(lowerSearch) ||
        (card.oracle_text && card.oracle_text.toLowerCase().includes(lowerSearch))
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
        case 'cmc': valA = a.cmc ?? 0; valB = b.cmc ?? 0; break;
        case 'cubucks_cost': valA = a.cubucks_cost ?? 1; valB = b.cubucks_cost ?? 1; break;
        case 'elo': valA = a.cubecobra_elo ?? 0; valB = b.cubecobra_elo ?? 0; break;
        default: valA = a.card_name.toLowerCase(); valB = b.card_name.toLowerCase();
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
    resortCards.forEach((card) => {
        if (card.card_type) {
            const mainType = card.card_type.split(/[\s—–\/]+/)[0];
            types.add(mainType);
        }
    });
    return Array.from(types).sort();
  }, [resortCards]);

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
        <div className="container mx-auto px-4 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading The Resort Pool...</p>
        </div>
    );
  }
  
  if (error) {
    return (
        <div className="container mx-auto px-4 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="mt-4 font-bold text-destructive">Error Loading The Resort Pool</p>
            <p className="text-muted-foreground">{error}</p>
        </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">The Resort Pool</h1>
        <p className="text-muted-foreground text-lg">Nominate a card for your Team&apos;s Off-Season vote.</p>

        {!isPostseason ? (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-3">
                <Info className="h-5 w-5" />
                <span>Nominations are only open during the Post-Season.</span>
            </div>
        ) : (
             <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded-lg text-sm text-green-800 dark:text-green-200 flex items-center gap-3">
                <Info className="h-5 w-5" />
                <span>Nominations are currently open! Nominated cards will appear as voting options on your Team Page.</span>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="pt-6 text-center"><Layers className="h-5 w-5 text-primary mx-auto mb-2" /><div className="text-3xl font-bold mb-1">{resortCards.length}</div><div className="text-sm text-muted-foreground">Total Cards</div></CardContent></Card>
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
        totalCount={resortCards.length}
        currentPage={currentPage}
        cardsPerPage={CARDS_PER_PAGE}
      />

      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">No cards found matching your filters.</p>
        </div>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {paginatedCards.map((card) => (
              <ResortNominationCard key={card.id} card={card} teamId={team?.id} isPostseason={isPostseason} />
            ))}
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
