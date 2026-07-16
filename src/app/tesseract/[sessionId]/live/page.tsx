// src/app/tesseract/[sessionId]/live/page.tsx

"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { 
    DndContext, 
    DragOverlay, 
    closestCenter, 
    useSensor, 
    useSensors, 
    PointerSensor,
    type DragStartEvent,
    type DragEndEvent
} from "@dnd-kit/core";
import { 
    SortableContext, 
    useSortable, 
    verticalListSortingStrategy, 
    arrayMove 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { getTesseractSessionUser, type TesseractParticipant } from "@/app/actions/tesseractAuthActions";
import { startTesseractDraft, pauseTesseractDraft, updateTesseractSettings } from "@/app/actions/tesseractSessionActions";
import { 
    getTesseractDraftStatus, 
    getTesseractCards, 
    makeTesseractPick, 
    type TesseractDraftStatus, 
    type TesseractCard 
} from "@/app/actions/tesseractDraftActions";
import { 
    getTesseractDraftQueue, 
    setTesseractDraftQueue, 
    executeTesseractAutoDraft,
    type TesseractQueueEntry,
    type TesseractCardForAlgo 
} from "@/app/actions/tesseractAutoDraftActions";
import { CardPreview } from "@/app/components/CardPreview";

// ============================================================================
// SORTABLE QUEUE ROW COMPONENT
// ============================================================================
function SortableQueueRow({ entry, onRemove }: { entry: TesseractQueueEntry, onRemove: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.cardPoolId });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <tr ref={setNodeRef} style={style} className={`border-b border-gray-300 dark:border-gray-700 ${isDragging ? "bg-gray-200 dark:bg-gray-800" : ""}`}>
            <td className="p-1">
                <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-900 cursor-grab px-1 touch-none">⠿</button>
            </td>
            <td className="p-1 font-bold w-6">{entry.position}</td>
            <td className="p-1 font-bold">{entry.cardName}</td>
            <td className="p-1 text-right">
                <button onClick={() => onRemove(entry.cardPoolId)} className="text-red-600 hover:text-red-900 font-bold px-2">X</button>
            </td>
        </tr>
    );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function TesseractLiveDraftPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const router = useRouter();
    
    // Authenticated user state
    const [me, setMe] = useState<TesseractParticipant | null>(null);
    const [isCreator, setIsCreator] = useState(false);

    // Draft & Card State
    const [status, setStatus] = useState<TesseractDraftStatus | null>(null);
    const [availableCards, setAvailableCards] = useState<TesseractCard[]>([]);
    const [draftedCards, setDraftedCards] = useState<TesseractCard[]>([]);
    const [queue, setQueue] = useState<TesseractQueueEntry[]>([]);
    const [autoDraftPreview, setAutoDraftPreview] = useState<TesseractCardForAlgo | null>(null);

    // UI State
    const [loading, setLoading] = useState(true);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [timeRemaining, setTimeRemaining] = useState("--:--:--");
    const [drafting, setDrafting] = useState<string | null>(null);

    // D&D State
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const loadData = useCallback(async (currentUser: TesseractParticipant) => {
        const [statusRes, cardsRes, queueRes] = await Promise.all([
            getTesseractDraftStatus(sessionId),
            getTesseractCards(sessionId),
            getTesseractDraftQueue(currentUser.id),
        ]);

        if (statusRes.error) {
            setError(statusRes.error);
        } else if (statusRes.status) {
            setStatus(statusRes.status);
        }

        if (cardsRes.available) setAvailableCards(cardsRes.available);
        if (cardsRes.drafted) setDraftedCards(cardsRes.drafted);
        if (queueRes.queue) setQueue(queueRes.queue);
        
        // Only fetch auto-draft preview if it's your turn
        if (statusRes.status?.onTheClock?.id === currentUser.id) {
            const preview = await executeTesseractAutoDraft(sessionId, currentUser.id);
            setAutoDraftPreview(preview.card || null);
        } else {
            setAutoDraftPreview(null);
        }
        
        setLoading(false);
    }, [sessionId]);

    useEffect(() => {
        const init = async () => {
            const userRes = await getTesseractSessionUser(sessionId);
            if (!userRes.participant) {
                router.push(`/tesseract/${sessionId}/join`);
                return;
            }
            setMe(userRes.participant);
            if (userRes.participant.draft_position === 1) { 
                setIsCreator(true);
            }
            await loadData(userRes.participant);
        };
        init();
    }, [sessionId, router, loadData]);

    useEffect(() => {
        if (!me) return;
        const interval = setInterval(() => {
            loadData(me);
        }, 5000);
        return () => clearInterval(interval);
    }, [me, loadData]);

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

    const handleAdminAction = async (action: 'start' | 'pause' | 'end') => {
        if (!me) return;
        setActionInProgress(action);
        setError(null);
        if (action === 'start') {
            const res = await startTesseractDraft(sessionId);
            if (!res.success) setError(res.error || "Failed to start draft.");
        } else if (action === 'pause') {
            const res = await pauseTesseractDraft(sessionId);
            if (!res.success) setError(res.error || "Failed to pause draft.");
        } else if (action === 'end') {
            if (window.confirm("WARNING: Forcing the draft to end early will lock the roster and delete the lobby within 3 days. Proceed?")) {
                 const res = await updateTesseractSettings(sessionId, 0); 
                 if (!res.success) setError(res.error || "Failed to end draft.");
            }
        }
        await loadData(me);
        setActionInProgress(null);
    };

    const handleDraft = async (cardPoolId: string) => {
        if (!me || !window.confirm("Are you sure you want to draft this card?")) return;
        
        setDrafting(cardPoolId);
        setError(null);
        
        const result = await makeTesseractPick(sessionId, cardPoolId);
        if (result.success) {
            await loadData(me);
        } else {
            setError(result.error || "Failed to make pick.");
        }
        setDrafting(null);
    };

    const handleAddToQueue = async (cardPoolId: string, cardName: string) => {
        if (!me) return;
        const newEntry = { cardPoolId, cardName, position: queue.length + 1 };
        const newQueue = [...queue, newEntry];
        setQueue(newQueue);
        await setTesseractDraftQueue(me.id, newQueue);
        await loadData(me);
    };

    const handleRemoveFromQueue = async (cardPoolId: string) => {
        if (!me) return;
        const newQueue = queue.filter(q => q.cardPoolId !== cardPoolId).map((q, i) => ({ ...q, position: i + 1 }));
        setQueue(newQueue);
        await setTesseractDraftQueue(me.id, newQueue);
        await loadData(me);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveDragId(null);
        if (!me) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        
        const oldIndex = queue.findIndex((e) => e.cardPoolId === active.id);
        const newIndex = queue.findIndex((e) => e.cardPoolId === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        
        const newQueue = arrayMove(queue, oldIndex, newIndex).map((entry, index) => ({
            ...entry,
            position: index + 1,
        }));
        
        setQueue(newQueue);
        await setTesseractDraftQueue(me.id, newQueue);
    };

    if (loading || !me || !status) {
        return <div className="p-8 text-xl font-bold font-mono">LOADING TESSERACT...</div>;
    }

    const isMyTurn = status.onTheClock?.id === me.id;
    
    const filteredCards = availableCards.filter(c => 
        c.card_name.toLowerCase().includes(search.toLowerCase()) || 
        (c.card_type && c.card_type.toLowerCase().includes(search.toLowerCase())) ||
        (c.oracle_text && c.oracle_text.toLowerCase().includes(search.toLowerCase()))
    );

    const activeDragEntry = activeDragId ? queue.find((e) => e.cardPoolId === activeDragId) : null;

    return (
        <div className="max-w-7xl mx-auto p-4 font-sans text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 min-h-screen">
            
            <div className="border-b-4 border-gray-900 dark:border-gray-100 pb-4 mb-6">
                <h1 className="text-4xl font-black uppercase tracking-widest mb-2">Tesseract Draft</h1>
                <div className="flex flex-wrap gap-4 text-sm font-bold uppercase">
                    <span className="border border-gray-400 px-3 py-1">Status: {status.status}</span>
                    <span className="border border-gray-400 px-3 py-1">Format: {status.format}</span>
                    <span className="border border-gray-400 px-3 py-1">Round: {status.currentRound} / {status.totalRounds}</span>
                    <span className="border border-gray-400 px-3 py-1">Pick: {status.totalPicks}</span>
                </div>
            </div>

            {error && (
                <div className="border-2 border-red-600 bg-red-100 text-red-900 p-4 font-bold mb-6 text-lg uppercase tracking-wider">
                    SYS ERR: {error}
                </div>
            )}

            {isCreator && (
                <div className="border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4 mb-6 flex gap-4 items-center">
                    <h2 className="font-bold uppercase tracking-wider">Creator Controls:</h2>
                    <button onClick={() => handleAdminAction('start')} disabled={status.status === 'active' || actionInProgress === 'start'} className="border border-blue-600 px-4 py-1 font-bold hover:bg-blue-600 hover:text-white disabled:opacity-50">START</button>
                    <button onClick={() => handleAdminAction('pause')} disabled={status.status !== 'active' || actionInProgress === 'pause'} className="border border-blue-600 px-4 py-1 font-bold hover:bg-blue-600 hover:text-white disabled:opacity-50">PAUSE</button>
                    <button onClick={() => handleAdminAction('end')} disabled={status.isComplete || actionInProgress === 'end'} className="border border-red-600 text-red-600 px-4 py-1 font-bold hover:bg-red-600 hover:text-white disabled:opacity-50">END EARLY</button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Left Sidebar */}
                <div className="lg:w-1/3 flex flex-col gap-6">
                    
                    {/* Active Turn Box */}
                    <div className={`border-4 p-6 ${isMyTurn ? 'border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-900'}`}>
                        <h2 className="text-2xl font-black uppercase tracking-wider border-b-2 border-gray-400 pb-2 mb-4">Clock</h2>
                        {status.isComplete ? (
                            <div className="text-xl font-bold uppercase">Draft Completed</div>
                        ) : status.status !== 'active' ? (
                            <div className="text-xl font-bold text-gray-500 uppercase">Draft Offline</div>
                        ) : (
                            <>
                                <div className="mb-2 text-lg">
                                    <span className="font-bold uppercase text-gray-500">Active: </span><br/>
                                    <span className={isMyTurn ? "font-black text-green-700 dark:text-green-400 uppercase text-2xl" : "font-bold text-xl"}>
                                        {status.onTheClock?.displayName || "None"}
                                    </span>
                                </div>
                                <div className="mb-6 text-lg">
                                    <span className="font-bold uppercase text-gray-500">Next: </span><br/>
                                    <span className="font-bold">{status.onDeck?.displayName || "None"}</span>
                                </div>
                                <div className="text-4xl font-black font-mono border-4 border-gray-900 dark:border-gray-100 bg-white dark:bg-black p-4 text-center">
                                    {timeRemaining}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Manual Queue */}
                    <div className="border-2 border-gray-400 p-4">
                        <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-gray-400 pb-2 mb-2">My Queue</h2>
                        {queue.length === 0 ? (
                            <p className="text-gray-500 italic py-4">No cards queued.</p>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                                <SortableContext items={queue.map(q => q.cardPoolId)} strategy={verticalListSortingStrategy}>
                                    <table className="w-full text-left text-sm border-collapse">
                                        <tbody>
                                            {queue.map(entry => (
                                                <SortableQueueRow key={entry.cardPoolId} entry={entry} onRemove={handleRemoveFromQueue} />
                                            ))}
                                        </tbody>
                                    </table>
                                </SortableContext>
                                <DragOverlay>
                                    {activeDragEntry && (
                                        <table className="w-full text-left text-sm border-collapse bg-white shadow-xl opacity-90 border-2 border-blue-500">
                                            <tbody>
                                                <tr>
                                                    <td className="p-1 text-gray-400">⠿</td>
                                                    <td className="p-1 font-bold w-6">{activeDragEntry.position}</td>
                                                    <td className="p-1 font-bold">{activeDragEntry.cardName}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </DragOverlay>
                            </DndContext>
                        )}
                        <div className="mt-4 pt-4 border-t-2 border-gray-400">
                            <h3 className="font-bold uppercase text-gray-500 text-sm mb-2">Algorithm Target</h3>
                            {autoDraftPreview ? (
                                <div className="font-bold text-blue-700 dark:text-blue-400 border border-blue-400 p-2">
                                    <CardPreview card={{ card_name: autoDraftPreview.card_name }} className="hover:underline">
                                        {autoDraftPreview.card_name}
                                    </CardPreview>
                                </div>
                            ) : (
                                <div className="text-gray-500 italic">Calculating...</div>
                            )}
                        </div>
                    </div>

                    {/* Participants List */}
                    <div className="border-2 border-gray-400 p-4">
                        <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-gray-400 pb-2 mb-2">Roster</h2>
                        <ul className="list-decimal list-inside space-y-1 font-medium">
                            {status.participants.map(p => (
                                <li key={p.id} className={p.id === me.id ? "font-black" : ""}>
                                    {p.displayName} {p.id === me.id ? "(You)" : ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Right Area (Available Cards & History) */}
                <div className="lg:w-2/3 flex flex-col gap-6">
                    
                    <div className="border-2 border-gray-400 p-4 flex flex-col h-[600px]">
                        <div className="flex justify-between items-end border-b-2 border-gray-400 pb-4 mb-4">
                            <h2 className="text-2xl font-black uppercase tracking-wider">Available Cards ({availableCards.length})</h2>
                            <input 
                                type="text"
                                placeholder="SEARCH..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="border-2 border-gray-900 p-2 bg-white dark:bg-gray-800 text-sm font-bold uppercase w-48"
                            />
                        </div>
                        
                        <div className="overflow-y-auto flex-1 border border-gray-300 pr-2">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="sticky top-0 bg-gray-200 dark:bg-gray-800 border-b-2 border-gray-400 uppercase tracking-wider text-xs z-10">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400">Card Name</th>
                                        <th className="p-2 border-r border-gray-400 text-center">CMC</th>
                                        <th className="p-2 border-r border-gray-400">Type</th>
                                        <th className="p-2 text-center" colSpan={2}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCards.length === 0 ? (
                                        <tr><td colSpan={5} className="p-4 text-center font-bold text-gray-500 uppercase">No Data</td></tr>
                                    ) : (
                                        filteredCards.map(card => (
                                            <tr key={card.id} className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900">
                                                <td className="p-2 border-r border-gray-300 dark:border-gray-700 font-bold whitespace-nowrap">
                                                    <CardPreview card={card} className="hover:underline hover:text-blue-600">
                                                        {card.card_name}
                                                    </CardPreview>
                                                </td>
                                                <td className="p-2 border-r border-gray-300 dark:border-gray-700 text-center font-mono">
                                                    {card.cmc}
                                                </td>
                                                <td className="p-2 border-r border-gray-300 dark:border-gray-700 text-xs truncate max-w-[150px]">
                                                    {card.card_type}
                                                </td>
                                                <td className="p-1 text-center w-20">
                                                    <button onClick={() => handleDraft(card.id)} disabled={!isMyTurn || status.status !== 'active' || drafting === card.id} className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 font-bold py-1 px-3 text-xs w-full uppercase transition-none cursor-pointer">
                                                        {drafting === card.id ? "..." : "Pick"}
                                                    </button>
                                                </td>
                                                <td className="p-1 text-center w-20">
                                                    <button onClick={() => handleAddToQueue(card.id, card.card_name)} disabled={queue.some(q => q.cardPoolId === card.id)} className="border border-black dark:border-white hover:bg-gray-200 dark:hover:bg-gray-800 disabled:border-gray-300 disabled:text-gray-400 font-bold py-1 px-3 text-xs w-full uppercase transition-none cursor-pointer">
                                                        {queue.some(q => q.cardPoolId === card.id) ? "Queued" : "Queue"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Draft History */}
                    <div className="border-2 border-gray-400 p-4 flex-1">
                        <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-gray-400 pb-2 mb-4">Draft Log</h2>
                        <div className="max-h-64 overflow-y-auto border border-gray-300 pr-2">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="sticky top-0 bg-gray-200 dark:bg-gray-800 border-b-2 border-gray-400 uppercase tracking-wider text-xs z-10">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400 w-12 text-center">Pick</th>
                                        <th className="p-2 border-r border-gray-400">Player</th>
                                        <th className="p-2 border-gray-400">Card Selected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {draftedCards.length === 0 ? (
                                        <tr><td colSpan={3} className="py-4 text-center font-bold text-gray-500 uppercase">Awaiting First Pick</td></tr>
                                    ) : (
                                        draftedCards.map(card => (
                                            <tr key={card.id} className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                                                <td className="p-2 border-r border-gray-300 dark:border-gray-700 text-center font-bold">{card.pick_number}</td>
                                                <td className="p-2 border-r border-gray-300 dark:border-gray-700 uppercase font-bold">{card.drafted_by_name}</td>
                                                <td className="p-2 font-bold text-blue-700 dark:text-blue-400">
                                                    <CardPreview card={card} className="hover:underline">
                                                        {card.card_name}
                                                    </CardPreview>
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
        </div>
    );
}
