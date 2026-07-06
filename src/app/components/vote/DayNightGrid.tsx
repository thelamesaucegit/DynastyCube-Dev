///src/app/components/vote/DayNightGrid.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Loader2, Moon, Sun, Save } from "lucide-react";
import { toast } from "sonner";
import { getUserNightVote, submitUserNightVote, getTeamNightSubmission } from "@/app/actions/dayNightActions";

interface DayNightGridProps {
    seasonId: string;
    teamId: string;
    userId: string;
    isPostseason: boolean;
}

export function DayNightGrid({ seasonId, teamId, userId, isPostseason }: DayNightGridProps) {
    const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<"select" | "deselect">("select");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [teamConsensus, setTeamConsensus] = useState<{start: number, end: number} | null>(null);

    useEffect(() => {
        loadData();
    }, [seasonId, teamId, userId]);

    const loadData = async () => {
        setLoading(true);
        const [voteRes, teamRes] = await Promise.all([
            getUserNightVote(seasonId, userId),
            getTeamNightSubmission(seasonId, teamId)
        ]);
        
        if (voteRes.success && voteRes.selectedHours) {
            setSelectedHours(new Set(voteRes.selectedHours));
        }
        if (teamRes.success && teamRes.submission) {
            setTeamConsensus({ start: teamRes.submission.start_hour, end: teamRes.submission.end_hour });
        }
        setLoading(false);
    };

    const handlePointerDown = (hour: number) => {
        setIsDragging(true);
        const isCurrentlySelected = selectedHours.has(hour);
        const newMode = isCurrentlySelected ? "deselect" : "select";
        setDragMode(newMode);
        toggleHour(hour, newMode);
    };

    const handlePointerEnter = (hour: number) => {
        if (isDragging) {
            toggleHour(hour, dragMode);
        }
    };

    const toggleHour = (hour: number, mode: "select" | "deselect") => {
        setSelectedHours(prev => {
            const next = new Set(prev);
            if (mode === "select") {
                if (next.size < 10) next.add(hour);
            } else {
                next.delete(hour);
            }
            return next;
        });
    };

    useEffect(() => {
        const handlePointerUp = () => setIsDragging(false);
        window.addEventListener("pointerup", handlePointerUp);
        return () => window.removeEventListener("pointerup", handlePointerUp);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const res = await submitUserNightVote(seasonId, teamId, userId, Array.from(selectedHours));
        if (res.success) {
            toast.success("Blackout hours saved!");
            loadData(); // Reload to fetch the newly calculated team consensus
        } else {
            toast.error(res.error || "Failed to save.");
        }
        setSaving(false);
    };

    const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${ampm}`;
    };

    // Check if an hour falls within the team's consensus window
    const isConsensusHour = (h: number) => {
        if (!teamConsensus) return false;
        const { start, end } = teamConsensus;
        if (start <= end) return h >= start && h <= end;
        return h >= start || h <= end; // Wrap-around case
    };

    if (!isPostseason) return null; // Only render during postseason

    return (
        <Card className="border-indigo-200 dark:border-indigo-900 shadow-sm mb-6">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded-t-xl pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Moon className="size-5 text-indigo-500" />
                    <CardTitle className="text-xl font-bold">Draft Night Blackout Hours</CardTitle>
                </div>
                <CardDescription>
                    Select up to 10 hours you want blacked out as &quot;Night Time&quot;. Your team&apos;s 10-hour consensus will be submitted to the league. Night timers last 4x as long.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin size-8 text-indigo-500" /></div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className={selectedHours.size === 10 ? "text-amber-500" : "text-muted-foreground"}>
                                {selectedHours.size} / 10 Hours Selected
                            </span>
                            {teamConsensus && (
                                <span className="text-indigo-600 dark:text-indigo-400">
                                    Team Consensus: {formatHour(teamConsensus.start)} - {formatHour(teamConsensus.end)}
                                </span>
                            )}
                        </div>

                        {/* 24-Hour Grid */}
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 select-none touch-none">
                            {Array.from({ length: 24 }).map((_, h) => {
                                const isSelected = selectedHours.has(h);
                                const isTeamWindow = isConsensusHour(h);

                                return (
                                    <div
                                        key={h}
                                        onPointerDown={() => handlePointerDown(h)}
                                        onPointerEnter={() => handlePointerEnter(h)}
                                        className={`
                                            relative flex flex-col items-center justify-center p-2 h-14 rounded-md cursor-pointer transition-colors border-2
                                            ${isSelected ? "bg-indigo-600 border-indigo-700 text-white shadow-inner" : "bg-card border-border hover:border-indigo-300"}
                                        `}
                                    >
                                        <span className="text-xs font-bold">{formatHour(h)}</span>
                                        {isTeamWindow && !isSelected && (
                                            <div className="absolute inset-0 bg-indigo-500/10 border border-indigo-500/30 rounded-md pointer-events-none" />
                                        )}
                                        {isSelected ? <Moon className="size-3 mt-1 opacity-70" /> : <Sun className="size-3 mt-1 text-amber-500/50" />}
                                    </div>
                                );
                            })}
                        </div>

                        <Button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {saving ? <Loader2 className="animate-spin mr-2 size-4" /> : <Save className="mr-2 size-4" />}
                            Save Blackout Hours
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
