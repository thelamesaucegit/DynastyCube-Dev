"use client";

import React, { useState, useEffect } from "react";
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
        // THE FIX: Main container is now relative to contain the background layers
        <div className="relative min-h-screen text-slate-300 py-12 px-4 selection:bg-red-900 overflow-x-hidden">
            {/* Background Image Layer */}
            <div
                className="fixed inset-0 z-[-2]"
                style={{
                    backgroundImage: `url('/images/pages/valve.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed', // Creates the parallax effect
                }}
            />
     

            <div className="relative z-10 max-w-4xl mx-auto">
                {/* HEADER */}
                <div className="text-center mb-12">
                    <Gauge className="size-16 mx-auto text-red-600 mb-4 animate-pulse" />
                    <h1 className="text-5xl font-black tracking-tighter text-slate-100 mb-4 uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                        The Valve
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto border-l-2 border-red-800 pl-4 text-left">
                        At the conclusion of the Championship, the team holding the worst record will be granted the power to release the pressure, Retiring the highest-voted card from the Cube immediately.
                    </p>
                </div>

                {/* NOMINATION INPUT */}
                <Card className="bg-slate-900 border-red-900/30 mb-12 shadow-xl">
                    <CardContent className="p-6 relative">
                        <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <Flame className="size-5 text-red-500" />
                            Add Pressure
                        </h2>
                        <div className="relative">
                            <Input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Enter a card name to nominate..."
                                className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-red-900 text-lg py-6"
                            />
                            {searching && <Loader2 className="absolute right-4 top-3.5 size-5 animate-spin text-slate-500" />}
                        </div>
                        {/* AUTOCOMPLETE DROPDOWN */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-50 w-[calc(100%-3rem)] mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-2xl max-h-60 overflow-y-auto">
                                {searchResults.map((card, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleNominate(card)}
                                        disabled={nominating}
                                        className="w-full text-left px-4 py-3 hover:bg-red-900/50 focus:bg-red-900/50 transition-colors text-slate-200 border-b border-slate-700/50 last:border-0"
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
                    <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-4 flex items-center gap-2">
                        <AlertOctagon className="size-4" />
                        Current Nominations
                    </h3>
                    {loading ? (
                        <div className="text-center py-12"><Loader2 className="size-10 animate-spin text-red-800 mx-auto" /></div>
                    ) : nominations.length === 0 ? (
                        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-lg">
                            <p className="text-slate-500 italic">The valve is sealed. No pressure detected.</p>
                        </div>
                    ) : (
                        nominations.map((nom, index) => (
                            <div 
                                key={nom.id} 
                                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                                    index === 0 
                                    ? "bg-red-950/20 border-red-900/50 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]" 
                                    : "bg-slate-900 border-slate-800"
                                }`}
                            >
                                <div>
                                    <h4 className={`text-xl font-bold ${index === 0 ? "text-red-400" : "text-slate-300"}`}>
                                        {nom.card_name}
                                    </h4>
                                    {index === 0 && (
                                        <p className="text-xs text-red-500/70 uppercase tracking-widest font-bold mt-1">
                                            Currently set to be purged
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-center min-w-[3rem]">
                                        <span className={`text-2xl font-black block leading-none ${nom.has_voted ? "text-orange-500" : "text-slate-500"}`}>
                                            {nom.vote_count}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">PSI</span>
                                    </div>
                                    
                                    <Button 
                                        onClick={() => handleToggleVote(nom.id)}
                                        variant={nom.has_voted ? "default" : "outline"}
                                        className={`shrink-0 border-2 ${
                                            nom.has_voted 
                                            ? "bg-orange-600 hover:bg-orange-700 border-orange-600 text-white" 
                                            : "bg-transparent border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/10 text-slate-400"
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
