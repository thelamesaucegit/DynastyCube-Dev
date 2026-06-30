// src/app/components/DraftInterface.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addDraftPick } from "@/app/actions/draftActions";
import { getTeamBalance, spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import { getActiveDraftOrder, type DraftOrderEntry } from "@/app/actions/draftOrderActions";
import { conditionallyCleanupDraftQueues } from "@/app/actions/autoDraftActions";
import { advanceDraft, getActiveDraftSession } from "@/app/actions/draftSessionActions";
import type { DraftPick } from "@/app/actions/draftActions";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { Badge } from "@/app/components/ui/badge";
import { CardPreview } from "@/app/components/CardPreview"; 

const CARDS_PER_PAGE = 20;

const COLOR_LABELS: Record<string, { label: string; emoji: string; className: string }> = {
  W: { label: "White", emoji: "⚪", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" },
  U: { label: "Blue", emoji: "🔵", className: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200" },
  B: { label: "Black", emoji: "⚫", className: "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-200" },
  R: { label: "Red", emoji: "🔴", className: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200" },
  G: { label: "Green", emoji: "🟢", className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200" },
};

interface DraftInterfaceProps {
  teamId: string;
  teamName?: string;
  isUserTeamMember?: boolean;
  onDraftComplete?: () => void;
  isFreeAgencyEnabled: boolean;
}

export const DraftInterface: React.FC<DraftInterfaceProps> = ({
  teamId,
  teamName = "This team",
  isUserTeamMember = true,
  onDraftComplete,
  isFreeAgencyEnabled,
}) => {
  const { useOldestArt } = useSettings();
  const [availableCards, setAvailableCards] = useState<CardData[]>([]);
  const [draftedCards, setDraftedCards] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilters, setColorFilters] = useState<string[]>([]);
  const [matchAllColors, setMatchAllColors] = useState(false);
  const [excludeUnselected, setExcludeUnselected] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [filterCmc, setFilterCmc] = useState<string>("all");
  const [filterCubucks, setFilterCubucks] = useState<string>("all");
  
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cubucksBalance, setCubucksBalance] = useState<number>(0);
  const [_draftOrderEntries, setDraftOrderEntries] = useState<DraftOrderEntry[]>([]);
  const [sortBy, setSortBy] = useState<string>("card_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, colorFilters, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder]);

  const loadDraftData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { session } = await getActiveDraftSession();
      const sessionId = session?.id || null;
      setActiveSessionId(sessionId);
      const poolToFetch = isFreeAgencyEnabled ? 'free' : 'draft';
      const picksPromise = teamId 
        ? getTeamDraftPicks(teamId, sessionId || undefined) 
        : Promise.resolve({ picks: [] });
        
      const balancePromise = teamId 
        ? getTeamBalance(teamId) 
        : Promise.resolve({ team: null });
      const [{ cards }, { picks }, { team }, { order }] = await Promise.all([
        getAvailableCardsForDraft(poolToFetch), 
        picksPromise,
        balancePromise,
        getActiveDraftOrder(),
      ]);
      setAvailableCards(cards);
      setDraftedCards(picks);
      if (team) setCubucksBalance(team.cubucks_balance);
      setDraftOrderEntries(order);
    } catch (err) {
      console.error("Error loading draft data:", err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Failed to find Server Action')) {
        setError("Page is outdated — please refresh to continue.");
      } else {
        setError("Failed to load cards");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDraftCard = async (card: CardData) => {
    if (drafting) return;
    
    if (!isFreeAgencyEnabled && !activeSessionId) {
      setError("Cannot draft card: No active draft session.");
      return;
    }
    if (draftedCards.some((pick) => pick.card_pool_id === card.id)) {
      setError("This specific card has already been drafted by your team.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const cardCost = card.cubucks_cost || 1;
    if (cubucksBalance < cardCost) {
      setError(`Insufficient Çubucks! Need ${cardCost}, you have ${cubucksBalance}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    setDrafting(card.id!);
    setError(null);
    setSuccess(null);
    try {
      const cubucksResult = await spendCubucksOnDraft(teamId, card.card_id, card.card_name, cardCost, card.id);
      if (!cubucksResult.success) {
        setError(cubucksResult.error || "Failed to spend Çubucks");
        return;
      }
      const pick: DraftPick = {
        team_id: teamId,
        card_pool_id: card.id,
        draft_session_id: activeSessionId || undefined, 
        card_id: card.card_id,
        card_name: card.card_name,
        card_set: card.card_set,
        card_type: card.card_type,
        rarity: card.rarity,
        colors: card.colors,
        color_identity: card.color_identity || [],
        image_url: card.image_url ?? undefined,
        oldest_image_url: card.oldest_image_url ?? undefined,
        mana_cost: card.mana_cost ?? undefined,
        cmc: card.cmc ?? undefined,
        pick_number: draftedCards.length + 1,
        acquisition_method: isFreeAgencyEnabled ? 'free_agent' : 'draft', 
        acquired_at: new Date().toISOString(), 
      };
    
      const result = await addDraftPick(pick);
      if (result.success) {
        setSuccess(`Acquired ${card.card_name} for ${cardCost} Cubucks!`);
        await conditionallyCleanupDraftQueues(card.card_id);
        
        if (!isFreeAgencyEnabled) {
           await advanceDraft();
        }
        await loadDraftData();
        onDraftComplete?.();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to acquire card");
      }
    } catch (err) {
      console.error("Error drafting card:", err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Failed to find Server Action')) {
        setError("Page is outdated — please refresh to continue.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setDrafting(null);
    }
  };

  const draftedCardCounts = new Map<string, number>();
  draftedCards.forEach(pick => {
    draftedCardCounts.set(pick.card_id, (draftedCardCounts.get(pick.card_id) || 0) + 1);
  });

  const filteredCards = availableCards.filter((card) => {
    if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        if (!card.card_name.toLowerCase().includes(lowerSearch) && !(card.oracle_text && card.oracle_text.toLowerCase().includes(lowerSearch))) {
            return false;
        }
    }
    if (colorFilters.length > 0) {
      const wantColorless = colorFilters.includes("colorless");
      const wantedColors = colorFilters.filter(c => c !== "colorless");
      const cardColors = card.colors || [];
      const isColorless = cardColors.length === 0;
      if (wantColorless && wantedColors.length === 0) {
          if (!isColorless) return false;
      } else if (isColorless) {
          if (!(wantColorless && !matchAllColors)) return false;
      } else {
          const hasAll = wantedColors.every(c => cardColors.includes(c));
          const hasAny = wantedColors.some(c => cardColors.includes(c));
          const hasOnly = cardColors.every(c => wantedColors.includes(c));
          if (matchAllColors && excludeUnselected && !(hasAll && hasOnly)) return false;
          if (matchAllColors && !excludeUnselected && !hasAll) return false;
          if (!matchAllColors && excludeUnselected && !hasOnly) return false;
          if (!matchAllColors && !excludeUnselected && !hasAny && !(wantColorless && isColorless)) return false;
      }
    }
    if (filterType !== "all") {
      if (!card.card_type?.toLowerCase().includes(filterType.toLowerCase())) return false;
    }
    if (filterRarity !== "all") {
        if (!card.rarity || card.rarity.toLowerCase() !== filterRarity.toLowerCase()) return false;
    }
    if (filterCmc !== "all") {
      const cmc = card.cmc ?? 0;
      if (filterCmc === "0-1" && cmc > 1) return false;
      if (filterCmc === "2-3" && (cmc < 2 || cmc > 3)) return false;
      if (filterCmc === "4-5" && (cmc < 4 || cmc > 5)) return false;
      if (filterCmc === "6+" && cmc < 6) return false;
    }
    if (filterCubucks !== "all") {
      const cost = card.cubucks_cost ?? 1;
      if (filterCubucks === "0-1" && cost > 1) return false;
      if (filterCubucks === "2-3" && (cost < 2 || cost > 3)) return false;
      if (filterCubucks === "4-5" && (cost < 4 || cost > 5)) return false;
      if (filterCubucks === "6-9" && (cost < 6 || cost > 9)) return false;
      if (filterCubucks === "10+" && cost < 10) return false;
    }
    return true;
  });

  const sortedAndFilteredCards = filteredCards.sort((a, b) => {
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

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    availableCards.forEach((card) => {
        if (card.card_type) {
            const mainType = card.card_type.split(/[\s—–\/]+/)[0];
            types.add(mainType);
        }
    });
    return Array.from(types).sort();
  }, [availableCards]);

  const totalPages = Math.ceil(sortedAndFilteredCards.length / CARDS_PER_PAGE);
  const paginatedCards = sortedAndFilteredCards.slice(
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
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading card pool...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      {!isUserTeamMember && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            👀 You are viewing {teamName}&apos;s draft pool in read-only mode. Only team members can draft cards.
          </p>
        </div>
      )}

      <PoolFilterBar
        searchTerm={searchQuery} setSearchTerm={setSearchQuery}
        filterColors={colorFilters} setFilterColors={setColorFilters}
        matchAllColors={matchAllColors} setMatchAllColors={setMatchAllColors}
        excludeUnselected={excludeUnselected} setExcludeUnselected={setExcludeUnselected}
        filterType={filterType} setFilterType={setFilterType}
        filterRarity={filterRarity} setFilterRarity={setFilterRarity}
        filterCmc={filterCmc} setFilterCmc={setFilterCmc}
        filterCubucks={filterCubucks} setFilterCubucks={setFilterCubucks}
        sortBy={sortBy} setSortBy={setSortBy}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        uniqueTypes={uniqueTypes}
        filteredCount={sortedAndFilteredCards.length}
        totalCount={availableCards.length}
        currentPage={currentPage}
        cardsPerPage={CARDS_PER_PAGE}
      />

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Card Pool
          </h3>
          
          {isUserTeamMember && (
              <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center gap-2 font-semibold shadow-sm">
                  <span className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Your Balance:</span>
                  <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">Ç {cubucksBalance.toLocaleString()}</span>
              </div>
          )}
        </div>
        
        {sortedAndFilteredCards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No cards found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {getPageNumbers().map((page, idx) => page === "ellipsis" ? (<span key={`el-${idx}`} className="px-2 text-gray-400 select-none">…</span>) : (<button key={page} onClick={() => setCurrentPage(page as number)} className={`min-w-[2.75rem] h-11 px-2 rounded-lg font-medium transition-colors touch-manipulation ${currentPage === page ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>{page}</button>))}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {paginatedCards.map((card) => {
              const isThisInstanceDrafted = draftedCards.some(p => p.card_pool_id === card.id);
              const isDrafting = drafting === card.id;
              const notEnoughCubucks = cubucksBalance < (card.cubucks_cost || 1);
              const imageUrl = getCardImageUrl(card, useOldestArt);

              return (
                <CardPreview key={card.id} card={card}>
                  <div className={`group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 transition-all ${isThisInstanceDrafted ? "border-green-500 opacity-60" : "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-lg"}`}>
                    
                    {/*  Changed 'h-64 relative' and 'object-cover' to 'h-80 relative bg-zinc-950/40' and 'object-contain' */}
                    {imageUrl && (
                      <div className="relative h-80 bg-zinc-950/40 border-b border-border/10">
                        <Image 
                          src={imageUrl} 
                          alt={card.card_name} 
                          fill 
                          className="object-contain" 
                        />
                      </div>
                    )}
                    
                    <div className="p-2 bg-card">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{card.card_name}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{card.card_set}</p>
                      {card.cubecobra_elo != null && (<p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">ELO: {card.cubecobra_elo.toLocaleString()}</p>)}
                    </div>
                    
                    <div className="absolute top-2 left-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1"><span className="font-bold">Ç</span><span>{card.cubucks_cost || 1}</span></div>
                    
                    {!isThisInstanceDrafted && isUserTeamMember && (
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDraftCard(card); }} disabled={!isFreeAgencyEnabled || isDrafting || notEnoughCubucks} title={!isFreeAgencyEnabled ? "Free agency is only available during the 'season' phase." : notEnoughCubucks ? "Not enough Çubucks to acquire." : `Acquire ${card.card_name}`} className={`absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed z-10`}>
                        <span className={`px-4 py-2 rounded-lg font-semibold shadow-lg text-white ${notEnoughCubucks ? "bg-red-600" : "bg-blue-600 hover:bg-blue-700"} ${!isFreeAgencyEnabled ? "!bg-gray-600" : ""}`}>{isDrafting ? "Acquiring..." : notEnoughCubucks ? "Not Enough Çubucks" : !isFreeAgencyEnabled ? "FA Closed" : `Acquire FA for ${card.cubucks_cost || 1} Ç`}</span>
                      </button>
                    )}
                    {isThisInstanceDrafted && (<div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">✓ DRAFTED</div>)}
                  </div>
                </CardPreview>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
              <button onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Page {currentPage} of {totalPages}</span>
              <button onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};
