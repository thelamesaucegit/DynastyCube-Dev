"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    generateDraftOrder,
    regenerateDraftOrder,
    getDraftSettings,
    updateDraftSetting,
    getTeamsForDraftSelection,
    getSeasonStandings,
    type DraftOrderEntry,
    type DraftOrderType,
} from "@/app/actions/draftOrderActions";
import { getSeasonStandingsFromStats } from "@/app/actions/weeklyMatchupActions";
import { getSeasons, type Season } from "@/app/actions/cubucksActions";

interface TeamItem {
    id: string;
    name: string;
    emoji: string;
    pickPosition?: number;
    win_pct?: number;
    lotteryNumber?: number;
    isLotteryWinner?: boolean;
}

interface SortableTeamRowProps {
    team: TeamItem;
    position: number;
    onRemove: (id: string) => void;
    isDraftOrder: boolean;
}

const SortableTeamRow: React.FC<SortableTeamRowProps> = ({ team, position, onRemove, isDraftOrder }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: team.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isDragging
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
        >
            {isDraftOrder && (
                <span className="text-sm font-bold text-gray-400 w-6 text-center">{position}</span>
            )}
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
            >
                ⠿
            </div>
            <span className="text-xl">{team.emoji}</span>
            <span className="flex-1 font-medium text-gray-900 dark:text-gray-100 text-sm">
                {team.name}
            </span>
            {team.win_pct !== undefined && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {team.win_pct.toFixed(1)}%
                </span>
            )}
            {team.isLotteryWinner && (
                <span className="text-xs text-amber-600 dark:text-amber-400">🎲</span>
            )}
            {isDraftOrder && (
                <button
                    onClick={() => onRemove(team.id)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm px-1"
                    title="Remove from draft"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

export const DraftOrderManagement: React.FC = () => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState("");
    const [orderType, setOrderType] = useState<DraftOrderType>("previous_season");
    const [maxTeams, setMaxTeams] = useState("8");
    const [maxTeamsInput, setMaxTeamsInput] = useState("8");

    // Two-panel state
    const [draftOrder, setDraftOrder] = useState<TeamItem[]>([]); // right panel
    const [availableTeams, setAvailableTeams] = useState<TeamItem[]>([]); // left panel
    const [savedOrder, setSavedOrder] = useState<DraftOrderEntry[]>([]); // persisted state

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const loadData = useCallback(async (seasonId: string) => {
        if (!seasonId) return;
        try {
            const { participating, available } = await getTeamsForDraftSelection(seasonId);
            setSavedOrder(participating);
            setDraftOrder(participating.map(e => ({
                id: e.team_id,
                name: e.team?.name ?? '',
                emoji: e.team?.emoji ?? '',
                pickPosition: e.pick_position,
                win_pct: e.previous_season_win_pct,
                lotteryNumber: e.lottery_number,
                isLotteryWinner: e.is_lottery_winner,
            })));
            setAvailableTeams(available.map(t => ({ id: t.id, name: t.name, emoji: t.emoji })));
        } catch (e) {
            setMessage({ type: "error", text: "Failed to load team data" });
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [seasonsResult, settingsResult] = await Promise.all([
                    getSeasons(),
                    getDraftSettings(),
                ]);
                setSeasons(seasonsResult.seasons);
                const mt = settingsResult.settings.max_teams ?? "8";
                setMaxTeams(mt);
                setMaxTeamsInput(mt);
                const active = seasonsResult.seasons.find(s => s.is_active);
                const firstId = active?.id ?? seasonsResult.seasons[0]?.id ?? "";
                if (firstId) {
                    setSelectedSeasonId(firstId);
                    await loadData(firstId);
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [loadData]);

    useEffect(() => {
        if (selectedSeasonId) loadData(selectedSeasonId);
    }, [selectedSeasonId, loadData]);

    // Pre-sort draft order panel when orderType changes to previous_season
    const handleOrderTypeChange = async (type: DraftOrderType) => {
        setOrderType(type);
        if (type !== 'previous_season' || draftOrder.length === 0) return;

        const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
        if (!selectedSeason) return;

        const previousSeason = seasons.find(s => s.season_number === selectedSeason.season_number - 1);
        if (!previousSeason) return;

        // Try stats first, fall back to matches
        const { standings } = await getSeasonStandingsFromStats(previousSeason.id);
        const standingsSource = standings.length > 0 ? standings : (await getSeasonStandings(previousSeason.id)).standings;

        const standingsMap = new Map(standingsSource.map(s => [s.team_id, s.win_pct]));
        const sorted = [...draftOrder].sort((a, b) => {
            const wa = standingsMap.get(a.id) ?? 0;
            const wb = standingsMap.get(b.id) ?? 0;
            return wa - wb; // worst first
        });
        setDraftOrder(sorted.map((t, i) => ({ ...t, win_pct: standingsMap.get(t.id) ?? 0, pickPosition: i + 1 })));
    };

    const addTeamToDraft = (team: TeamItem) => {
        setAvailableTeams(prev => prev.filter(t => t.id !== team.id));
        setDraftOrder(prev => [...prev, { ...team, pickPosition: prev.length + 1 }]);
    };

    const removeTeamFromDraft = (teamId: string) => {
        const team = draftOrder.find(t => t.id === teamId);
        if (!team) return;
        setDraftOrder(prev => prev.filter(t => t.id !== teamId).map((t, i) => ({ ...t, pickPosition: i + 1 })));
        setAvailableTeams(prev => [...prev, { id: team.id, name: team.name, emoji: team.emoji }]
            .sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setDraftOrder(prev => {
            const oldIdx = prev.findIndex(t => t.id === active.id);
            const newIdx = prev.findIndex(t => t.id === over.id);
            if (oldIdx === -1 || newIdx === -1) return prev;
            return arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, pickPosition: i + 1 }));
        });
    };

    const handleGenerate = async () => {
        if (!selectedSeasonId) return;
        if (draftOrder.length === 0) {
            setMessage({ type: "error", text: "Add at least one team to the draft order first." });
            return;
        }

        const isNew = savedOrder.length === 0;
        const actionLabel = isNew ? "Generate" : "Regenerate";

        if (!confirm(`${actionLabel} draft order for ${seasons.find(s => s.id === selectedSeasonId)?.season_name}?\n\nThis will ${isNew ? 'save' : 'replace'} the draft order with the current arrangement.`)) return;

        setGenerating(true);
        setMessage(null);

        try {
            const teamIds = draftOrder.map(t => t.id);
            const manualOrder = orderType === 'manual' ? teamIds : undefined;

            const fn = isNew ? generateDraftOrder : regenerateDraftOrder;
            const result = await fn(selectedSeasonId, { orderType, teamIds, manualOrder });

            if (result.success) {
                setMessage({ type: "success", text: result.message ?? `Draft order ${actionLabel.toLowerCase()}d!` });
                await loadData(selectedSeasonId);
            } else {
                setMessage({ type: "error", text: result.error ?? `Failed to ${actionLabel.toLowerCase()} draft order` });
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveMaxTeams = async () => {
        const value = parseInt(maxTeamsInput);
        if (isNaN(value) || value < 2 || value > 32) {
            setMessage({ type: "error", text: "Max teams must be between 2 and 32" });
            return;
        }
        setSavingSettings(true);
        const result = await updateDraftSetting("max_teams", String(value));
        if (result.success) { setMaxTeams(String(value)); setMessage({ type: "success", text: `Max teams updated to ${value}` }); }
        else setMessage({ type: "error", text: result.error ?? "Failed to save" });
        setSavingSettings(false);
    };

    const activeTeam = activeId ? draftOrder.find(t => t.id === activeId) : null;
    const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
    const previousSeason = selectedSeason
        ? seasons.find(s => s.season_number === selectedSeason.season_number - 1)
        : null;
    const hasSavedOrder = savedOrder.length > 0;

    if (loading) return (
        <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading draft order system...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    🎯 Draft Order
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select teams, set pick order, and generate the draft.
                </p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg border ${message.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-300 text-green-800 dark:text-green-200" : "bg-red-50 dark:bg-red-900/20 border-red-300 text-red-800 dark:text-red-200"}`}>
                    <div className="flex justify-between">
                        <p>{message.text}</p>
                        <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100 ml-4">✕</button>
                    </div>
                </div>
            )}

            {/* Settings row */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Season selector */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Season</label>
                    <select
                        value={selectedSeasonId}
                        onChange={e => setSelectedSeasonId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    >
                        <option value="">Select season...</option>
                        {seasons.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.season_name} {s.is_active ? "★" : ""}
                            </option>
                        ))}
                    </select>
                    {selectedSeasonId && (
                        <p className="text-xs text-gray-500 mt-1">
                            Based on: {previousSeason ? previousSeason.season_name : "No previous season (all 0-0)"}
                        </p>
                    )}
                </div>

                {/* Order type + max teams */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Method</label>
                        <div className="flex gap-2">
                            {(['previous_season', 'random', 'manual'] as DraftOrderType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleOrderTypeChange(type)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        orderType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {type === 'previous_season' ? '📊 Standings' : type === 'random' ? '🎲 Random' : '✋ Manual'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max Teams (lottery range)</label>
                            <input
                                type="number" min={2} max={32}
                                value={maxTeamsInput}
                                onChange={e => setMaxTeamsInput(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <button
                            onClick={handleSaveMaxTeams}
                            disabled={savingSettings || maxTeamsInput === maxTeams}
                            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                            {savingSettings ? "..." : "Save"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Two-panel drag and drop */}
            {selectedSeasonId && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Left: Available teams */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    Available Teams ({availableTeams.length})
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Click to add to draft</p>
                            </div>
                            <div className="p-3 space-y-2 max-h-96 overflow-y-auto min-h-24">
                                {availableTeams.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-4">All teams are in the draft</p>
                                ) : (
                                    availableTeams.map(team => (
                                        <button
                                            key={team.id}
                                            onClick={() => addTeamToDraft(team)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                                        >
                                            <span className="text-xl">{team.emoji}</span>
                                            <span className="flex-1 font-medium text-sm text-gray-900 dark:text-gray-100">{team.name}</span>
                                            <span className="text-blue-600 dark:text-blue-400 text-xs">Add →</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right: Draft order */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    Draft Order ({draftOrder.length} teams)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Drag to reorder · Pick 1 drafts first</p>
                            </div>
                            <div className="p-3 space-y-2 max-h-96 overflow-y-auto min-h-24">
                                {draftOrder.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                        <p className="text-xs text-gray-400">Add teams from the left panel</p>
                                    </div>
                                ) : (
                                    <SortableContext items={draftOrder.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                        {draftOrder.map((team, idx) => (
                                            <SortableTeamRow
                                                key={team.id}
                                                team={team}
                                                position={idx + 1}
                                                onRemove={removeTeamFromDraft}
                                                isDraftOrder={true}
                                            />
                                        ))}
                                    </SortableContext>
                                )}
                            </div>
                        </div>
                    </div>

                    <DragOverlay>
                        {activeTeam && (
                            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-blue-400 bg-white dark:bg-gray-800 shadow-xl opacity-90">
                                <span className="text-xl">{activeTeam.emoji}</span>
                                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{activeTeam.name}</span>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Generate button */}
            {selectedSeasonId && draftOrder.length > 0 && (
                <div className="flex gap-3">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        {generating
                            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generating...</>
                            : hasSavedOrder
                                ? "🔄 Regenerate Draft Order"
                                : "🎯 Generate Draft Order"}
                    </button>
                </div>
            )}

            {/* Saved order display */}
            {savedOrder.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">
                            ✓ Saved Draft Order — {selectedSeason?.season_name}
                        </h4>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-4 py-2 text-center font-semibold w-12">Pick</th>
                                <th className="px-4 py-2 text-left font-semibold">Team</th>
                                <th className="px-4 py-2 text-center font-semibold">Prev W%</th>
                                <th className="px-4 py-2 text-center font-semibold">Lottery</th>
                                <th className="px-4 py-2 text-center font-semibold">Tiebreak</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {savedOrder.map(entry => (
                                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                    <td className="px-4 py-2 text-center">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                                            entry.pick_position === 1 ? 'bg-yellow-500 text-white'
                                            : entry.pick_position === 2 ? 'bg-gray-400 text-white'
                                            : entry.pick_position === 3 ? 'bg-amber-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}>
                                            {entry.pick_position}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                        {entry.team?.emoji} {entry.team?.name}
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">
                                        {Number(entry.previous_season_win_pct).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                            {entry.lottery_number}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        {entry.is_lottery_winner
                                            ? <span className="text-amber-600 dark:text-amber-400 text-xs">🎲 Yes</span>
                                            : <span className="text-gray-400 text-xs">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {seasons.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-gray-600 dark:text-gray-400">Create a season first before generating a draft order.</p>
                </div>
            )}
        </div>
    );
};
