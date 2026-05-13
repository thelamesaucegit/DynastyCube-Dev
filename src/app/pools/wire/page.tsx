// src/app/pools/wire/page.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, AlertCircle, Search, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { WireCardComponent } from "@/app/components/WireCardComponent"; 
import { Input } from "@/app/components/ui/input";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

const CARDS_PER_PAGE = 50;

const COLOR_OPTIONS = [
  { value: "all", label: "All", emoji: "🌈" },
  { value: "W", label: "White", emoji: "⚪" },
  { value: "U", label: "Blue", emoji: "🔵" },
  { value: "B", label: "Black", emoji: "⚫" },
  { value: "R", label: "Red", emoji: "🔴" },
  { value: "G", label: "Green", emoji: "🟢" },
  { value: "colorless", label: "Colorless", emoji: "◇" },
];

export default function WirePage() {
  const [wireCards, setWireCards] = useState<WireCard[]>([]);
  const [filteredAndSortedCards, setFilteredAndSortedCards] = useState<WireCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [filterCmc, setFilterCmc] = useState("all");
  const [filterCubucks, setFilterCubucks] = useState("all");
  
  // Default to color sorting
  const [sortBy, setSortBy] = useState("color");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadWireData();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireCards, searchTerm, filterColors, filterType, filterCmc, filterCubucks, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAndSortedCards]);

  // isBidUpdate prevents the loading spinner and scroll-to-top from triggering when just placing a bid
  const loadWireData = async (isBidUpdate = false) => {
    if (!isBidUpdate) setLoading(true);
    setError(null);
    try {
      const { cards, error: fetchError } = await getWireCards();
      if (fetchError) {
        setError(fetchError);
      } else {
        setWireCards(cards);
      }
    } catch (err) {
      setError("An unexpected error occurred while fetching wire data.");
    } finally {
      if (!isBidUpdate) {
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBidSuccess = () => {
    loadWireData(true); 
  };

  // Helper for WUBRG Sorting
  const getColorSortValue = (colors?: string[] | null) => {
    if (!colors || colors.length === 0) return 7; // Colorless
    if (colors.length > 1) return 6; // Multicolored
    const c = colors[0];
    if (c === 'W') return 1;
    if (c === 'U') return 2;
    if (c === 'B') return 3;
    if (c === 'R') return 4;
    if (c === 'G') return 5;
    return 8;
  };

  const applyFiltersAndSorting = () => {
    // 1. Filtering
    let filtered = [...wireCards];

    if (searchTerm) {
      filtered = filtered.filter((card) =>
        card.card_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
        if (filterCubucks === "0-50") return cost <= 50;
        if (filterCubucks === "51-100") return cost >= 51 && cost <= 100;
        if (filterCubucks === "101-200") return cost >= 101 && cost <= 200;
        if (filterCubucks === "201+") return cost >= 201;
        return true;
      });
    }

    // 2. Sorting
    const sorted = filtered.sort((a, b) => {
      let valA: string | number, valB: string | number;

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
        case 'color':
          valA = getColorSortValue(a.colors);
          valB = getColorSortValue(b.colors);
          break;
        default: // 'card_name'
          valA = a.card_name.toLowerCase();
          valB = b.card_name.toLowerCase();
      }

      if (sortBy === 'color') {
        if (valA === valB) {
            return a.card_name.localeCompare(b.card_name);
        }
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
            // Get the primary type before '—', '–', or '//'
            const mainType = card.card_type.split(/[\s—–\/]+/)[0];
            types.add(mainType);
        }
    });
    return Array.from(types).sort();
  }, [wireCards]);

  const toggleColor = (value: string) => {
    if (value === "all") {
      setFilterColors([]);
      return;
    }
    setFilterColors((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  // Pagination Logic
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
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
          <p className="text-muted-foreground text-lg">
            Bid on unclaimed cards. Bids processed every Wednesday at Midnight (UTC).
          </p>
        </div>
        <div className="text-sm font-medium bg-secondary/50 px-4 py-2 rounded-full border flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {filteredAndSortedCards.length} Cards Available
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-8">
          <CardContent className="pt-6 space-y-4">
              <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Search</label>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Card name..." className="pl-10" />
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Color <span className="text-xs font-normal opacity-60">(select multiple)</span></label>
                  <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => {
                          const isActive = color.value === "all" ? filterColors.length === 0 : filterColors.includes(color.value);
                          return (
                              <button key={color.value} onClick={() => toggleColor(color.value)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                  {color.emoji} {color.label}
                              </button>
                          );
                      })}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
                      <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                      </Select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Mana Cost (CMC)</label>
                      <Select value={filterCmc} onValueChange={setFilterCmc}>
                          <SelectTrigger><SelectValue placeholder="All CMC" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All CMC</SelectItem><SelectItem value="0-1">0–1 Mana</SelectItem><SelectItem value="2-3">2–3 Mana</SelectItem><SelectItem value="4-5">4–5 Mana</SelectItem><SelectItem value="6+">6+ Mana</SelectItem></SelectContent>
                      </Select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Cubucks Cost</label>
                      <Select value={filterCubucks} onValueChange={setFilterCubucks}>
                          <SelectTrigger><SelectValue placeholder="All Costs" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All Costs</SelectItem><SelectItem value="0-50">0–50</SelectItem><SelectItem value="51-100">51–100</SelectItem><SelectItem value="101-200">101–200</SelectItem><SelectItem value="201+">201+</SelectItem></SelectContent>
                      </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="color">Card Color</SelectItem>
                            <SelectItem value="card_name">Card Name</SelectItem>
                            <SelectItem value="cmc">Mana Cost (CMC)</SelectItem>
                            <SelectItem value="cubucks_cost">Cubucks Cost</SelectItem>
                            <SelectItem value="elo">ELO</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Order</label>
                      <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                          <SelectTrigger>
                              <div className="flex items-center gap-2">
                                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                  <SelectValue placeholder="Order" />
                              </div>
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
          </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Cards Grid or Empty States */}
      {filteredAndSortedCards.length === 0 && !loading ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <p className="text-xl font-semibold">No cards found.</p>
          <p className="text-muted-foreground mt-2">
            {searchTerm || filterColors.length > 0 ? "Try adjusting your search filters." : "The Wire is currently empty."}
          </p>
        </div>
      ) : (
        <>
          {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                      {getPageNumbers().map((page, idx) => page === "ellipsis" ? (<span key={`el-${idx}`} className="px-2 text-muted-foreground select-none">…</span>) : (<button key={page} onClick={() => setCurrentPage(page)} className={`min-w-[2.75rem] h-11 px-2 rounded-lg font-medium transition-colors touch-manipulation ${currentPage === page ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{page}</button>))}
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
      
      {/* Loading Overlay for full-page transitions only */}
      {loading && wireCards.length > 0 && (
        <div className="fixed inset-0 bg-background/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
