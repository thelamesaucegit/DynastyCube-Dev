// /src/app/tesseract/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTesseractLobbies, TesseractLobby } from "@/app/actions/tesseractSessionActions";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, Plus, Users, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function TesseractLobbyPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [lobbies, setLobbies] = useState<TesseractLobby[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLobbies = useCallback(async () => {
        setLoading(true);
        const { lobbies: lobbyData } = await getTesseractLobbies();
        setLobbies(lobbyData);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadLobbies();
    }, [loadLobbies]);

    const canCreateNew = lobbies.filter(l => l.status !== 'completed').length < 2;

    const handleCreate = () => {
        if (!user) {
            router.push("/auth/login?redirect=/tesseract/create");
        } else {
            router.push("/tesseract/create");
        }
    };

    return (
        <div className="container max-w-5xl mx-auto px-4 py-12">
            <header className="text-center mb-12">
                <h1 className="text-5xl font-extrabold tracking-tight mb-2">Tesseract Drafts</h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Jump into a standalone draft experience. Join an open lobby or create your own.
                </p>
            </header>

            <div className="flex justify-center mb-10">
                <Button size="lg" onClick={handleCreate} disabled={!canCreateNew && !loading}>
                    <Plus className="mr-2 size-5" />
                    {canCreateNew ? "Create New Draft" : "Maximum Active Drafts Reached"}
                </Button>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-center">Open Lobbies</h2>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                ) : lobbies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lobbies.map((lobby) => (
                            <Link key={lobby.id} href={`/tesseract/${lobby.id}/join`} className="group">
                                <Card className="h-full hover:border-primary/60 hover:shadow-lg transition-all">
                                    <CardHeader>
                                        <CardTitle className="truncate">{lobby.name}</CardTitle>
                                        <CardDescription>{lobby.draft_format === 'snake' ? 'Snake Draft' : 'Linear Draft'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold">Status:</span>
                                            <Badge variant={lobby.status === 'open' ? 'default' : 'secondary'} className="bg-green-500/20 text-green-600 border-green-500/30">
                                                {lobby.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold flex items-center gap-1.5"><Users className="size-4" /> Players:</span>
                                            <span>{lobby.participant_count} / {lobby.max_players}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold flex items-center gap-1.5"><Lock className="size-4" /> Passcode:</span>
                                            <span>{lobby.has_passcode ? "Yes" : "No"}</span>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-8">No open lobbies found.</p>
                )}
            </div>
        </div>
    );
}
