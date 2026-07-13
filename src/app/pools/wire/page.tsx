// src/app/pools/wire/page.tsx

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getPaginatedWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, Layers } from "lucide-react";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { WireGrid } from "@/app/components/WireGrid";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatInTimezone } from "@/utils/timezoneUtils";

const CARDS_PER_PAGE = 50;

function WirePageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { timezone } = useUserTimezone();

    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
    const [filterColors, setFilterColors] = useState<string[]>(searchParams.get('colors')?.split(',').filter(Boolean) || []);
    const [matchAllColors, setMatchAllColors] = useState(searchParams.get('matchAll') === 'true');
    const [excludeUnselected, setExcludeUnselected] = useState(searchParams.get('exclude') === 'true');
    const [filterType, setFilterType] = useState(searchParams.get('type') || 'all');
    const [filterRarity, setFilterRarity] = useState(searchParams.get('rarity') || 'all');
    const [filterCmc, setFilterCmc] = useState(searchParams.get('cmc') || 'all');
    const [filterCubucks, setFilterCubucks] = useState(searchParams.get('cubucks') || 'all');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'color');
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get('sortOrder') as "asc" | "desc") || "asc");
    
    // Add explicitly tracked page state
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));

    const [cards, setCards] = useState<WireCard[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // A key to force a refetch when a bid is successfully placed
    const [refreshKey, setRefreshKey] = useState(0);

    // Sync all states to the URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (filterColors.length > 0) params.set('colors', filterColors.join(','));
        if (matchAllColors) params.set('matchAll', 'true');
        if (excludeUnselected) params.set('exclude', 'true');
        if (filterType !== 'all') params.set('type', filterType);
        if (filterRarity !== 'all') params.set('rarity', filterRarity);
        if (filterCmc !== 'all') params.set('cmc', filterCmc);
        if (filterCubucks !== 'all') params.set('cubucks', filterCubucks);
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
        params.set('page', currentPage.toString());

        router.replace(`${pathname}?${params.toString()}`);
    }, [searchTerm, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder, currentPage, router, pathname]);

    // Fetch Data whenever the URL parameters or refresh key changes
    useEffect(() => {
        const fetchCards = async () => {
            setLoading(true);
            const params = Object.fromEntries(searchParams.entries());
            const result = await getPaginatedWireCards({
                currentPage: parseInt(params.page || '1', 10),
                sortBy: params.sortBy || 'color',
                sortOrder: (params.sortOrder as 'asc' | 'desc') || 'asc',
                searchTerm: params.q,
                filterColors: params.colors?.split(','),
                matchAllColors: params.matchAll === 'true',
                excludeUnselected: params.exclude === 'true',
                filterType: params.type,
                filterRarity: params.rarity,
                filterCmc: params.cmc,
                filterCubucks: params.cubucks
            });
            
            if (result.cards) {
                setCards(result.cards);
                setTotalCount(result.totalCount);
            }
            setLoading(false);
        };
        fetchCards();
    }, [searchParams, refreshKey]);

    // Helpers to reset the page to 1 whenever a user changes a filter!
    const handleSetSearchTerm = (val: string) => { setSearchTerm(val); setCurrentPage(1); };
    const handleSetFilterColors = (val: string[] | ((prev: string[]) => string[])) => { setFilterColors(val); setCurrentPage(1); };
    const handleSetMatchAllColors = (val: boolean) => { setMatchAllColors(val); setCurrentPage(1); };
    const handleSetExcludeUnselected = (val: boolean) => { setExcludeUnselected(val); setCurrentPage(1); };
    const handleSetFilterType = (val: string) => { setFilterType(val); setCurrentPage(1); };
    const handleSetFilterRarity = (val: string) => { setFilterRarity(val); setCurrentPage(1); };
    const handleSetFilterCmc = (val: string) => { setFilterCmc(val); setCurrentPage(1); };
    const handleSetFilterCubucks = (val: string) => { setFilterCubucks(val); setCurrentPage(1); };
    const handleSetSortBy = (val: string) => { setSortBy(val); setCurrentPage(1); };
    const handleSetSortOrder = (val: "asc" | "desc") => { setSortOrder(val); setCurrentPage(1); };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const getNextProcessingTime = () => {
        const now = new Date();
        const daysUntilWednesday = (3 - now.getDay() + 7) % 7;
        const nextWednesday = new Date(now);
        nextWednesday.setDate(now.getDate() + (daysUntilWednesday === 0 ? 7 : daysUntilWednesday));
        nextWednesday.setHours(0, 0, 0, 0);
        return formatInTimezone(nextWednesday, timezone, {
            weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
        });
    };

    // --- Pagination Calculation Logic ---
    const totalPages = Math.ceil(totalCount / CARDS_PER_PAGE);

    const getPageNumbers = (): (number | "ellipsis")[] => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | "ellipsis")[] = [1];
        if (currentPage > 3) pages.push("ellipsis");
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("ellipsis");
        pages.push(totalPages);
        return pages;
    };

    return (
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Bid on unclaimed cards. Bids are processed <span className="text-foreground font-bold">{getNextProcessingTime()}</span>.
                    </p>
                </div>
                <div className="text-sm font-medium bg-secondary/50 px-4 py-2 rounded-full border flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    {totalCount} Cards Available
                </div>
            </div>
            
            <PoolFilterBar
                searchTerm={searchTerm} setSearchTerm={handleSetSearchTerm}
                filterColors={filterColors} setFilterColors={handleSetFilterColors}
                matchAllColors={matchAllColors} setMatchAllColors={handleSetMatchAllColors}
                excludeUnselected={excludeUnselected} setExcludeUnselected={handleSetExcludeUnselected}
                filterType={filterType} setFilterType={handleSetFilterType}
                filterRarity={filterRarity} setFilterRarity={handleSetFilterRarity}
                filterCmc={filterCmc} setFilterCmc={handleSetFilterCmc}
                filterCubucks={filterCubucks} setFilterCubucks={handleSetFilterCubucks}
                sortBy={sortBy} setSortBy={handleSetSortBy}
                sortOrder={sortOrder} setSortOrder={handleSetSortOrder}
                uniqueTypes={[]} 
                filteredCount={totalCount}
                totalCount={totalCount} 
                currentPage={currentPage}
                cardsPerPage={CARDS_PER_PAGE}
            />
            
            {loading ? (
                <div className="text-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" /></div>
            ) : (
                <>
                    {/* Top Pagination Row */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                            <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
                            <div className="flex items-center gap-1 flex-wrap justify-center">
                                {getPageNumbers().map((page, idx) => page === "ellipsis" ? (<span key={`el-${idx}`} className="px-2 text-muted-foreground select-none">…</span>) : (<button key={page} onClick={() => handlePageChange(page as number)} className={`min-w-[2.75rem] h-11 px-2 rounded-lg font-medium transition-colors touch-manipulation ${currentPage === page ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{page}</button>))}
                            </div>
                            <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
                        </div>
                    )}

                    {/* The Grid Component */}
                    <WireGrid cards={cards} onBidSuccess={() => setRefreshKey(k => k + 1)} />

                    {/* Bottom Pagination Row */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
                            <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">← Prev</button>
                            <span className="text-sm text-muted-foreground font-medium">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px] justify-center touch-manipulation">Next →</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function WirePage() {
    return (
        <Suspense fallback={<div className="text-center py-16"><Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" /></div>}>
            <WirePageContent />
        </Suspense>
    );
}
