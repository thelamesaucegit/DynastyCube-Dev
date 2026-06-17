// src/app/components/admin/PvpReplayList.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, Play, Trash2, CalendarDays, FileCode2 } from "lucide-react";
import { getPvpReplays, deletePvpReplay, type PvpReplayMeta } from "@/app/actions/pvpReplayActions";
import Link from "next/link";
import { toast } from "sonner";

export function PvpReplayList() {
    const [replays, setReplays] = useState<PvpReplayMeta[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadReplays = async () => {
        setIsLoading(true);
        const res = await getPvpReplays();
        if (res.success) {
            setReplays(res.replays);
        } else {
            toast.error("Failed to load PvP replays");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadReplays();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this replay?")) return;
        
        setDeletingId(id);
        const res = await deletePvpReplay(id);
        
        if (res.success) {
            toast.success("Replay deleted successfully.");
            setReplays(prev => prev.filter(r => r.id !== id));
        } else {
            toast.error(res.error || "Failed to delete replay.");
        }
        setDeletingId(null);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (replays.length === 0) {
        return (
            <div className="text-center p-10 border border-dashed rounded-lg bg-muted/30">
                <FileCode2 className="size-10 mx-auto text-muted-foreground opacity-50 mb-3" />
                <p className="font-semibold text-muted-foreground">No PvP Replays Uploaded</p>
                <p className="text-sm text-muted-foreground mt-1">When users upload Cockatrice .cor files, they will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {replays.map((replay) => (
                <Card key={replay.id} className="overflow-hidden">
                    <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="font-mono text-xs">
                                    <FileCode2 className="size-3 mr-1" /> .cor
                                </Badge>
                                <span className="font-semibold">{replay.original_filename}</span>
                            </div>
                            
                            {replay.team1_name && replay.team2_name ? (
                                <div className="text-sm flex items-center gap-2 font-bold mb-2">
                                    <span style={{ color: replay.team1_color || 'inherit' }}>{replay.team1_name}</span>
                                    <span className="text-muted-foreground text-xs font-normal">VS</span>
                                    <span style={{ color: replay.team2_color || 'inherit' }}>{replay.team2_name}</span>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground italic mb-2">Unlinked Sandbox Match</div>
                            )}

                            <div className="text-xs text-muted-foreground flex items-center gap-4">
                                <span className="flex items-center gap-1"><CalendarDays className="size-3"/> {new Date(replay.created_at).toLocaleDateString()}</span>
                                {replay.uploaded_by_user?.display_name && (
                                    <span>Uploaded by: {replay.uploaded_by_user.display_name}</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                            <Button asChild className="flex-1 md:flex-none">
                                <Link href={`/admin/pvp-viewer/${replay.id}`} target="_blank">
                                    <Play className="size-4 mr-2" /> View Replay
                                </Link>
                            </Button>
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                onClick={() => handleDelete(replay.id)}
                                disabled={deletingId === replay.id}
                            >
                                {deletingId === replay.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
