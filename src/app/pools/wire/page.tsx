// /src/app/pools/wire/page.tsx

"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getPaginatedWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, Layers } from "lucide-react";
import { PoolFilterBar } from "@/app/components/pools/PoolFilterBar";
import { WireGrid } from "@/app/components/WireGrid";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatInTimezone } from "@/utils/timezoneUtils";

const CARDS_PER_PAGE = 50;

function WireContent() {
    const searchParams = useSearchParams();
    const [cards, setCards] = useState<WireCard[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);

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
            setCards(result.cards);
            setTotalCount(result.totalCount);
            setLoading(false);
        };
        fetchCards();
    }, [searchParams]);

    if (loading) {
        return <div className="text-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" /></div>;
    }

    return (
        <>
            <WireGrid cards={cards} onBidSuccess={() => { /* This can now trigger a router.refresh() */ }} />
            {/* You will need to build out a new pagination component that uses totalCount and updates the URL */}
        </>
    );
}

export default function WirePage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { timezone } = useUserTimezone();

    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
    const [filterColors, setFilterColors] = useState<string[]>(searchParams.get('colors')?.split(',') || []);
    const [matchAllColors, setMatchAllColors] = useState(searchParams.get('matchAll') === 'true');
    const [excludeUnselected, setExcludeUnselected] = useState(searchParams.get('exclude') === 'true');
    const [filterType, setFilterType] = useState(searchParams.get('type') || 'all');
    const [filterRarity, setFilterRarity] = useState(searchParams.get('rarity') || 'all');
    const [filterCmc, setFilterCmc] = useState(searchParams.get('cmc') || 'all');
    const [filterCubucks, setFilterCubucks] = useState(searchParams.get('cubucks') || 'all');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'color');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc');

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
        // Reset to page 1 whenever filters change
        params.set('page', '1');

        router.replace(`${pathname}?${params.toString()}`);
    }, [searchTerm, filterColors, matchAllColors, excludeUnselected, filterType, filterRarity, filterCmc, filterCubucks, sortBy, sortOrder, router, pathname]);
    
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

    return (
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
                <p className="text-muted-foreground text-lg font-medium">
                    Bid on unclaimed cards. Bids are processed <span className="text-foreground font-bold">{getNextProcessingTime()}</span>.
                </p>
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
                uniqueTypes={[]} // This can now be fetched on the server or passed down if needed
                filteredCount={0} // These are now managed within WireContent
                totalCount={0}
                currentPage={1}
                cardsPerPage={CARDS_PER_PAGE}
            />
            
            <Suspense fallback={<div className="text-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" /></div>}>
                <WireContent />
            </Suspense>
        </div>
    );
}

