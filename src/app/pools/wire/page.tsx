// src/app/pools/wire/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, AlertCircle, Layers } from "lucide-react";
import { WireCardComponent } from "@/app/components/WireCardComponent";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { Card, CardContent } from "@/app/components/ui/card";
import { useUserTimezone } from "@/hooks/useUserTimezone"; // <-- IMPORT HOOK
import { formatInTimezone } from "@/utils/timezoneUtils"; // <-- IMPORT FORMATTER

const CARDS_PER_PAGE = 50;

export default function WirePage() {
  const [wireCards, setWireCards] = useState<WireCard[]>([]);
  const [filteredAndSortedCards, setFilteredAndSortedCards] = useState<WireCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timezone Hook
  const { timezone } = useUserTimezone();

  // Filter and Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [matchAllColors, setMatchAllColors] = useState(false);
  const [excludeUnselected, setExcludeUnselected] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterCmc, setFilterCmc] = useState("all");
  const [filterCubucks, setFilterCubucks] = useState("all");
  const [sortBy, setSortBy] = useState("color");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

 const getNextProcessingTime = () => {
    // Get the current date and time
    const now = new Date();

    // Find the current day of the week (0=Sun, 1=Mon, ..., 3=Wed, ...)
    const currentDay = now.getDay();
    
    // Calculate how many days we need to add to get to the next Wednesday.
    // If today is Wednesday (3), it will calculate for next week (7 days away).
    const daysUntilWednesday = (3 - currentDay + 7) % 7;
    
    const nextWednesday = new Date(now);
    // Set the date to the next Wednesday
    nextWednesday.setDate(now.getDate() + (daysUntilWednesday === 0 ? 7 : daysUntilWednesday));
    // Set the time to midnight. The server is in CT, so this is midnight CT.
    nextWednesday.setHours(0, 0, 0, 0);

    // Now format this correct date using your existing timezone utility
    return formatInTimezone(nextWednesday, timezone, {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
  };

  useEffect(() => { loadWireData(); }, []);

  useEffect(() => {
    applyFiltersAndSorting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireCards, searchTerm, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder]);

  useEffect(() => { setCurrentPage(1); }, [filteredAndSortedCards]);

  const loadWireData = async (isBidUpdate = false) => {
    if (!isBidUpdate) setLoading(true);
    setError(null);
    try {
      const { cards, error: fetchError } = await getWireCards();
      if (fetchError) setError(fetchError);
      else setWireCards(cards);
    } catch (err) {
      setError("An unexpected error occurred while fetching wire data.");
    } finally {
      if (!isBidUpdate) {
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBidSuccess = () => { loadWireData(true); };

  const getColorSortValue = (colors?: string[] | null) => {
    if (!colors || colors.length === 0) return 7; 
    if (colors.length > 1) return 6; 
    const c = colors[0];
    if (c === 'W') return 1; if (c === 'U') return 2; if (c === 'B') return 3; if (c === 'R') return 4; if (c === 'G') return 5;
    return 8;
  };

  const applyFiltersAndSorting = () => {
    let filtered = [...wireCards];
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
      let valA: string | number, valB: string | number;
      switch (sortBy) {
        case 'cmc': valA = a.cmc ?? 0; valB = b.cmc ?? 0; break;
        case 'cubucks_cost': valA = a.cubucks_cost ?? 1; valB = b.cubucks_cost ?? 1; break;
        case 'elo': valA = a.cubecobra_elo ?? 0; valB = b.cubecobra_elo ?? 0; break;
        case 'color': valA = getColorSortValue(a.colors); valB = getColorSortValue(b.colors); break;
        default: valA = a.card_name.toLowerCase(); valB = b.card_name.toLowerCase();
      }
      if (sortBy === 'color') {
        if (valA === valB) return a.card_name.localeCompare(b.card_name);
        return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
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
    wireCards.forEach((card) => {
        if (card.card_type) {
            const mainType = card.card_type.split(/[\s—–\/]+/)[0];
            types.add(mainType);
        }
    });
    return Array.from(types).sort();
  }, [wireCards]);

  const customCubuckRanges = [
    { value: "all", label: "All Costs" },
    { value: "0-1", label: "0-1 Ç" },
    { value: "2-3", label: "2-3 Ç" },
    { value: "4-6", label: "4-6 Ç" },
    { value: "7+", label: "7+ Ç" },
  ];

  const totalPages = Math.ceil(filteredAndSortedCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredAndSortedCards.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  if (loading && wireCards.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading The Wire...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
          {/* THE FIX: Output the precise local processing time! */}
          <p className="text-muted-foreground text-lg font-medium">
            Bid on unclaimed cards. Bids are processed <span className="text-foreground font-bold">{getNextProcessingTime()}</span>.
          </p>
        </div>
        <div className="text-sm font-medium bg-secondary/50 px-4 py-2 rounded-full border flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {filteredAndSortedCards.length} Cards Available
        </div>
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
        totalCount={wireCards.length}
        currentPage={currentPage}
        cardsPerPage={CARDS_PER_PAGE}
      />

      {error && (
        <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {filteredAndSortedCards.length === 0 && !loading ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <p className="text-xl font-semibold">No cards found.</p>
          <p className="text-muted-foreground mt-2">Try adjusting your search filters.</p>
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
              <WireCardComponent key={card.id} card={card} onBidSuccess={handleBidSuccess} />
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

      {loading && wireCards.length > 0 && (
        <div className="fixed inset-0 bg-background/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
