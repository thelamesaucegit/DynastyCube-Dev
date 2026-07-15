// src/app/tesseract/[sessionId]/join/page.tsx

"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { joinTesseractLobby, getTesseractSessionUser } from "@/app/actions/tesseractAuthActions";
import { getTesseractLobbyInfo } from "@/app/actions/tesseractSessionActions";

export default function JoinTesseractPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const router = useRouter();

    const [lobbyName, setLobbyName] = useState<string>("Loading...");
    const [requiresPasscode, setRequiresPasscode] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [passcode, setPasscode] = useState("");
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAccess = async () => {
            // 1. Check if user already has a session token for this draft
            const userRes = await getTesseractSessionUser(sessionId);
            if (userRes.participant) {
                router.push(`/tesseract/${sessionId}/live`);
                return;
            }

            // 2. Fetch Lobby Info
            const infoRes = await getTesseractLobbyInfo(sessionId);
            if (!infoRes.success) {
                setError(infoRes.error || "Failed to load lobby.");
                setLoading(false);
                return;
            }

            if (infoRes.status !== 'scheduled') {
                setError("This draft is no longer accepting new participants.");
                setLoading(false);
                return;
            }

            setLobbyName(infoRes.name || "Unknown Draft");
            setRequiresPasscode(infoRes.requiresPasscode || false);
            setLoading(false);
        };

        checkAccess();
    }, [sessionId, router]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!displayName.trim() || displayName.trim().length < 2) {
            return setError("Display name must be at least 2 characters.");
        }
        if (requiresPasscode && !passcode.trim()) {
            return setError("A passcode is required to join this draft.");
        }

        setJoining(true);
        const result = await joinTesseractLobby(sessionId, displayName.trim(), passcode.trim() || undefined);

        if (result.success) {
            router.push(`/tesseract/${sessionId}/live`);
        } else {
            setError(result.error || "Failed to join lobby.");
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-md mx-auto p-6 mt-8 border border-gray-400 bg-white dark:bg-gray-900">
                <p>Checking lobby access...</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 mt-8 border border-gray-400 bg-white dark:bg-gray-900">
            <h1 className="text-2xl font-bold mb-4 border-b border-gray-400 pb-2">
                Join Draft: {lobbyName}
            </h1>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-900 border border-red-400">
                    <strong>System Message:</strong> {error}
                </div>
            )}

            {/* Only show the form if the error isn't a hard block (like missing session or already started) */}
            {(!error || error.includes("passcode") || error.includes("name") || error.includes("taken")) && (
                <form onSubmit={handleJoin} className="space-y-4">
                    <div>
                        <label className="block font-bold mb-1">Display Name *</label>
                        <input 
                            type="text" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)} 
                            className="w-full border border-gray-400 p-2 bg-transparent"
                            placeholder="Enter your name"
                            required
                        />
                    </div>

                    {requiresPasscode && (
                        <div>
                            <label className="block font-bold mb-1">Passcode *</label>
                            <input 
                                type="password" 
                                value={passcode} 
                                onChange={(e) => setPasscode(e.target.value)} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                placeholder="Enter lobby passcode"
                                required
                            />
                        </div>
                    )}

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={joining}
                            className="w-full bg-blue-700 text-white font-bold p-3 hover:bg-blue-800 disabled:bg-gray-500 transition-colors"
                        >
                            {joining ? "Connecting..." : "Join Draft"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
