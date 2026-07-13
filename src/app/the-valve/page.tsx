// src/app/the-valve/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { searchValveCards, getValveNominations, nominateCardForValve, toggleValveVote, type ValveNomination } from "@/app/actions/valveActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AlertOctagon, Flame, ArrowUpCircle, Loader2, Gauge } from "lucide-react";
import { toast } from "sonner";

export default function TheValvePage() {
    const [nominations, setNominations] = useState<ValveNomination[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [searching, setSearching] = useState(false);
    const [nominating, setNominating] = useState(false);

    // --- THE FIX: Proportional Scroll Tracking State ---
    const [scrollPercentage, setScrollPercentage] = useState(0);

    // Calculate exactly how far down the page the user has scrolled (0 to 100)
    useEffect(() => {
        const updateScroll = () => {
            const scrollY = window.scrollY;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = document.documentElement.clientHeight;
            const maxScroll = scrollHeight - clientHeight;

            if (maxScroll > 0) {
                // Constrain between 0 and 100
                setScrollPercentage(Math.min(Math.max((scrollY / maxScroll) * 100, 0), 100));
            } else {
                setScrollPercentage(0);
            }
        };

        window.addEventListener('scroll', updateScroll, { passive: true });
        window.addEventListener('resize', updateScroll);
        
        // Trigger initially and shortly after load to account for DOM painting/resizing
        updateScroll();
        const timeoutId = setTimeout(updateScroll, 200);

        return () => {
            window.removeEventListener('scroll', updateScroll);
            window.removeEventListener('resize', updateScroll);
            clearTimeout(timeoutId);
        };
    }, [nominations, searchResults]); // Re-bind when content height potentially changes
    // ----------------------------------------------------

    const loadNominations = async () => {
        const res = await getValveNominations();
        if (res.success && res.nominations) {
            setNominations(res.nominations);
        }
        setLoading(false);
    };

    useEffect(() => { loadNominations(); }, []);

    // Autocomplete effect
    useEffect(() => {
        const fetchSearch = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            setSearching(true);
            const res = await searchValveCards(searchQuery);
            if (res.success && res.cards) setSearchResults(res.cards);
            setSearching(false);
        };
        const debounce = setTimeout(fetchSearch, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleNominate = async (cardName: string) => {
        setNominating(true);
        const res = await nominateCardForValve(cardName);
        if (res.success) {
            toast.success(res.message);
            setSearchQuery("");
            setSearchResults([]);
            await loadNominations();
        } else {
            toast.error(res.error);
        }
        setNominating(false);
    };

    const handleToggleVote = async (nominationId: string) => {
        // Optimistic UI update
        setNominations(prev => prev.map(n => {
            if (n.id === nominationId) {
                return { ...n, has_voted: !n.has_voted, vote_count: n.has_voted ? n.vote_count - 1 : n.vote_count + 1 };
            }
            return n;
        }).sort((a, b) => b.vote_count - a.vote_count || a.card_name.localeCompare(b.card_name)));

        const res = await toggleValveVote(nominationId);
        if (!res.success) {
            toast.error("Failed to register nomination.");
            await loadNominations(); // Revert on failure
        }
    };

    return (
        <div className="relative min-h-screen text-slate-300 py-12 px-4 selection:bg-red-900">
            
            {/* --- FIXED BACKGROUND LAYER WITH PROPORTIONAL SCROLL --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <Image 
                    src="/images/pages/valve.png"
                    alt="The Valve"
                    fill
                    priority
                    quality={80}
                    className="object-cover opacity-40" // 40% opacity so the image is highly visible
                    style={{ 
                        // THE FIX: Binds the image's vertical position exactly to the scroll percentage!
                        objectPosition: `center ${scrollPercentage}%`,
                        transform: 'translate3d(0, 0, 0)' // Hardware acceleration for smoother scrolling
                    }}
                />
                {/* A gradient overlay to ensure text contrast at the top and bottom of the page */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/50 to-slate-950/90" />
            </div>

            {/* --- FOREGROUND CONTENT --- */}
            <div className="relative z-10 max-w-4xl mx-auto">
                
                {/* HEADER */}
                <div className="text-center mb-12">
                    <Gauge className="size-16 mx-auto text-red-600 mb-4 animate-pulse drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                    <h1 className="text-5xl font-black tracking-tighter text-slate-100 mb-4 uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                        The Valve
                    </h1>
                    <p className="text-lg text-slate-300 max-w-2xl mx-auto border-l-2 border-red-600 pl-4 text-left drop-shadow-md bg-slate-950/40 backdrop-blur-sm p-4 rounded-r-lg">
                        At the conclusion of the Championship, the team holding the worst record will be granted the power to release the pressure, Retiring the highest-voted card from the Cube immediately.
                    </p>
                </div>

                {/* NOMINATION INPUT */}
                {/* THE FIX: bg-black/40 and backdrop-blur-md creates a "frosted glass" effect so the background shines through */}
                <Card className="bg-black/40 backdrop-blur-md border-red-900/40 mb-12 shadow-2xl">
                    <CardContent className="p-6 relative">
                        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2 drop-shadow-md">
                            <Flame className="size-5 text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                            Add Pressure
                        </h2>
                        <div className="relative">
                            <Input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Enter a card name to nominate..."
                                className="bg-black/50 backdrop-blur-md border-red-900/50 text-slate-100 placeholder:text-slate-400 focus-visible:ring-red-600 text-lg py-6 shadow-inner"
                            />
                            {searching && <Loader2 className="absolute right-4 top-3.5 size-5 animate-spin text-slate-400" />}
                        </div>
                        
                        {/* AUTOCOMPLETE DROPDOWN */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-50 w-[calc(100%-3rem)] mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-md shadow-2xl max-h-60 overflow-y-auto">
                                {searchResults.map((card, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleNominate(card)}
                                        disabled={nominating}
                                        className="w-full text-left px-4 py-3 hover:bg-red-900/60 focus:bg-red-900/60 transition-colors text-slate-200 border-b border-slate-700/50 last:border-0"
                                    >
                                        {card}
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* NOMINATIONS LIST */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-slate-300 mb-4 flex items-center gap-2 bg-black/40 inline-block px-4 py-2 rounded-md backdrop-blur-md border border-slate-800/50 shadow-md">
                        <AlertOctagon className="size-4 text-red-500" />
                        Current Nominations
                    </h3>
                    
                    {loading ? (
                        <div className="text-center py-12"><Loader2 className="size-10 animate-spin text-red-600 mx-auto drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]" /></div>
                    ) : nominations.length === 0 ? (
                        <div className="text-center py-12 bg-black/40 backdrop-blur-md border border-slate-800/80 rounded-lg shadow-xl">
                            <p className="text-slate-400 italic">The valve is sealed. No pressure detected.</p>
                        </div>
                    ) : (
                        nominations.map((nom, index) => (
                            <div 
                                key={nom.id} 
                                className={`flex items-center justify-between p-4 rounded-lg border backdrop-blur-md transition-all shadow-xl ${
                                    index === 0 
                                    ? "bg-red-950/40 border-red-800/60 shadow-[inset_0_0_30px_rgba(220,38,38,0.2)]" 
                                    : "bg-black/40 border-slate-800/60"
                                }`}
                            >
                                <div>
                                    <h4 className={`text-xl font-bold drop-shadow-md ${index === 0 ? "text-red-400" : "text-slate-200"}`}>
                                        {nom.card_name}
                                    </h4>
                                    {index === 0 && (
                                        <p className="text-xs text-red-400 uppercase tracking-widest font-bold mt-1 drop-shadow-md">
                                            Currently set to be purged
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-center min-w-[3rem]">
                                        <span className={`text-2xl font-black block leading-none drop-shadow-md ${nom.has_voted ? "text-orange-500" : "text-slate-400"}`}>
                                            {nom.vote_count}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">PSI</span>
                                    </div>
                                    
                                    <Button 
                                        onClick={() => handleToggleVote(nom.id)}
                                        variant={nom.has_voted ? "default" : "outline"}
                                        className={`shrink-0 border-2 shadow-md backdrop-blur-sm ${
                                            nom.has_voted 
                                            ? "bg-orange-600 hover:bg-orange-700 border-orange-500 text-white" 
                                            : "bg-black/40 border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/20 text-slate-300"
                                        }`}
                                    >
                                        <ArrowUpCircle className={`size-5 ${nom.has_voted ? "" : "mr-2"}`} />
                                        {nom.has_voted ? "" : "Turn"}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
