// src/app/tesseract/[sessionId]/live/page.tsx

"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getTesseractSessionUser, type TesseractParticipant } from "@/app/actions/tesseractAuthActions";
import { 
    getTesseractDraftStatus, 
    getTesseractCards, 
    makeTesseractPick,
    type TesseractDraftStatus,
    type TesseractCard 
} from "@/app/actions/tesseractDraftActions";

export default function TesseractLiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const router = useRouter();

    // State
    const [me, setMe] = useState<TesseractParticipant | null>(null);
    const [status, setStatus] = useState<TesseractDraftStatus | null>(null);
    const [availableCards, setAvailableCards] = useState<TesseractCard[]>([]);
    const [draftedCards, setDraftedCards] = useState<TesseractCard[]>([]);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [drafting, setDrafting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [timeRemaining, setTimeRemaining] = useState<string>("--:--:--");

    const loadData = useCallback(async () => {
        // Fetch status and cards concurrently
        const [statusRes, cardsRes] = await Promise.all([
            getTesseractDraftStatus(sessionId),
            getTesseractCards(sessionId)
        ]);

        if (statusRes.error) {
            setError(statusRes.error);
        } else if (statusRes.status) {
            setStatus(statusRes.status);
        }

        if (cardsRes.available) setAvailableCards(cardsRes.available);
        if (cardsRes.drafted) setDraftedCards(cardsRes.drafted);
        
        setLoading(false);
    }, [sessionId]);

    // Initial Auth Check & Data Load
    useEffect(() => {
        const init = async () => {
            const userRes = await getTesseractSessionUser(sessionId);
            if (!userRes.participant) {
                router.push(`/tesseract/${sessionId}/join`);
                return;
            }
            setMe(userRes.participant);
            await loadData();
        };
        init();
    }, [sessionId, router, loadData]);

    // Polling Interval (Every 5 seconds)
    useEffect(() => {
        if (!me) return;
        const interval = setInterval(() => {
            loadData();
        }, 5000);
        return () => clearInterval(interval);
    }, [me, loadData]);

    // Timer Countdown
    useEffect(() => {
        if (!status?.pickDeadline || status.isComplete || status.status !== 'active') {
            setTimeRemaining("--:--:--");
            return;
        }

        const updateTimer = () => {
            const diff = new Date(status.pickDeadline!).getTime() - Date.now();
            if (diff <= 0) {
                setTimeRemaining("00:00:00");
                return;
            }
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeRemaining(
                `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
        return () => clearInterval(timerInterval);
    }, [status]);

    const handleDraft = async (cardPoolId: string) => {
        if (!window.confirm("Are you sure you want to draft this card?")) return;
        
        setDrafting(cardPoolId);
        setError(null);
        
        const result = await makeTesseractPick(sessionId, cardPoolId);
        if (result.success) {
            await loadData();
        } else {
            setError(result.error || "Failed to make pick.");
        }
        setDrafting(null);
    };

    if (loading || !me) {
        return <div className="p-8 text-xl">Loading Draft Board...</div>;
    }

    if (!status) {
        return <div className="p-8 text-xl text-red-600">Failed to load draft status.</div>;
    }

    const isMyTurn = status.onTheClock?.id === me.id;
    
    const filteredCards = availableCards.filter(c => 
        c.card_name.toLowerCase().includes(search.toLowerCase()) || 
        (c.card_type && c.card_type.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="max-w-7xl mx-auto p-4 font-sans text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 min-h-screen">
            
            {/* Header Area */}
            <div className="border-b border-gray-400 pb-4 mb-6">
                <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Tesseract Draft</h1>
                <div className="flex flex-wrap gap-4 text-sm font-bold">
                    <span className="border border-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800">
                        Status: {status.status.toUpperCase()}
                    </span>
                    <span className="border border-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800">
                        Format: {status.format.toUpperCase()}
                    </span>
                    <span className="border border-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800">
                        Round: {status.currentRound} / {status.totalRounds}
                    </span>
                    <span className="border border-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800">
                        Total Picks: {status.totalPicks}
                    </span>
                </div>
            </div>

            {error && (
                <div className="border border-red-600 bg-red-100 text-red-900 p-3 font-bold mb-6">
                    Error: {error}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Left Sidebar (Status, Participants, History) */}
                <div className="lg:w-1/3 flex flex-col gap-6">
                    
                    {/* Active Turn Box */}
                    <div className={`border-2 p-4 ${isMyTurn ? 'border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-400 bg-gray-50 dark:bg-gray-900'}`}>
                        <h2 className="text-xl font-bold border-b border-gray-400 pb-2 mb-4">Current Turn</h2>
                        {status.isComplete ? (
                            <div className="text-lg font-bold">Draft Completed</div>
                        ) : status.status !== 'active' ? (
                            <div className="text-lg font-bold text-gray-500">Draft Paused / Scheduled</div>
                        ) : (
                            <>
                                <div className="mb-2">
                                    <span className="font-bold">On the Clock: </span>
                                    <span className={isMyTurn ? "font-bold text-green-700 dark:text-green-400 uppercase" : ""}>
                                        {status.onTheClock?.displayName || "None"}
                                    </span>
                                </div>
                                <div className="mb-4">
                                    <span className="font-bold">On Deck: </span>
                                    {status.onDeck?.displayName || "None"}
                                </div>
                                <div className="text-2xl font-bold font-mono border border-gray-400 bg-white dark:bg-black p-2 text-center">
                                    {timeRemaining}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Participants List */}
                    <div className="border border-gray-400 p-4">
                        <h2 className="text-lg font-bold border-b border-gray-400 pb-2 mb-2">Participants</h2>
                        <ul className="list-decimal list-inside space-y-1 text-sm">
                            {status.participants.map(p => (
                                <li key={p.id} className={p.id === me.id ? "font-bold" : ""}>
                                    {p.displayName} {p.id === me.id ? "(You)" : ""}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Draft History */}
                    <div className="border border-gray-400 p-4 flex-1">
                        <h2 className="text-lg font-bold border-b border-gray-400 pb-2 mb-2">Recent Picks</h2>
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border-b border-gray-400 py-1">#</th>
                                        <th className="border-b border-gray-400 py-1">Player</th>
                                        <th className="border-b border-gray-400 py-1">Card</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {draftedCards.length === 0 ? (
                                        <tr><td colSpan={3} className="py-2 text-gray-500 italic">No picks yet.</td></tr>
                                    ) : (
                                        draftedCards.map(card => (
                                            <tr key={card.id}>
                                                <td className="border-b border-gray-300 dark:border-gray-700 py-1">{card.pick_number}</td>
                                                <td className="border-b border-gray-300 dark:border-gray-700 py-1 truncate max-w-[100px]">{card.drafted_by_name}</td>
                                                <td className="border-b border-gray-300 dark:border-gray-700 py-1 font-bold">{card.card_name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Area (Available Cards) */}
                <div className="lg:w-2/3 border border-gray-400 p-4 flex flex-col h-[800px]">
                    <div className="flex justify-between items-end border-b border-gray-400 pb-2 mb-4">
                        <h2 className="text-xl font-bold">Available Cards ({availableCards.length})</h2>
                        <input 
                            type="text"
                            placeholder="Search cards..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="border border-gray-400 p-1 bg-white dark:bg-gray-800 text-sm"
                        />
                    </div>
                    
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="sticky top-0 bg-gray-200 dark:bg-gray-800 border-b-2 border-gray-400">
                                <tr>
                                    <th className="p-2 border-r border-gray-300 dark:border-gray-700">Name</th>
                                    <th className="p-2 border-r border-gray-300 dark:border-gray-700">Type</th>
                                    <th className="p-2 border-r border-gray-300 dark:border-gray-700">Colors</th>
                                    <th className="p-2 border-r border-gray-300 dark:border-gray-700">CMC</th>
                                    <th className="p-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCards.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-gray-500">No cards match your search.</td>
                                    </tr>
                                ) : (
                                    filteredCards.map(card => (
                                        <tr key={card.id} className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                                            <td className="p-2 border-r border-gray-300 dark:border-gray-700 font-bold">
                                                {card.card_name}
                                            </td>
                                            <td className="p-2 border-r border-gray-300 dark:border-gray-700">
                                                {card.card_type}
                                            </td>
                                            <td className="p-2 border-r border-gray-300 dark:border-gray-700">
                                                {card.colors?.join("") || "-"}
                                            </td>
                                            <td className="p-2 border-r border-gray-300 dark:border-gray-700">
                                                {card.cmc}
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    onClick={() => handleDraft(card.id)}
                                                    disabled={!isMyTurn || status.status !== 'active' || drafting === card.id}
                                                    className="bg-blue-600 hover:bg-blue-800 disabled:bg-gray-400 text-white font-bold py-1 px-3 text-xs w-full transition-colors"
                                                >
                                                    {drafting === card.id ? "Drafting..." : "Draft"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
