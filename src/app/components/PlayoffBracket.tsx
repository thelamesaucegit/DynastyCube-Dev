// src/app/components/PlayoffBracket.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getPlayoffData } from "@/app/actions/playoffActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Trophy } from "lucide-react";

interface PlayoffBracketProps {
    seasonId: string;
    seasonName: string;
    phase: string;
}

export function PlayoffBracket({ seasonId, seasonName, phase }: PlayoffBracketProps) {
    const [matchups, setMatchups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBracket = useCallback(async () => {
        if (!seasonId) return;
        const result = await getPlayoffData(seasonId);
        if (result.success) setMatchups(result.matchups);
        setLoading(false);
    }, [seasonId]);

    useEffect(() => {
        loadBracket();
        // Update every 10 minutes (600,000 ms)
        const interval = setInterval(loadBracket, 600000);
        return () => clearInterval(interval);
    }, [loadBracket]);

    if (loading) return null;
    if (matchups.length === 0) return null;

    // --- CHAMPIONSHIP VIEW ---
    if (phase === 'postseason') {
        // Find the final matchup to extract the champion
        const finalMatchup = matchups[matchups.length - 1];
        const champion = finalMatchup?.winner_team_id === finalMatchup?.team1?.id ? finalMatchup.team1 : finalMatchup?.team2;

        if (!champion) return null;

        return (
            <Card className="border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-background overflow-hidden animate-in fade-in duration-1000">
                <CardContent className="flex flex-col items-center justify-center py-16 px-4">
                    <h2 className="text-2xl md:text-4xl font-black tracking-widest text-center text-muted-foreground uppercase mb-8">
                        {seasonName} Champion
                    </h2>
                    
                    {/* TROPHY: To use a custom PNG, replace the div below with:
                        <img src="/images/custom-trophy.png" alt="Trophy" className="w-32 h-32 mb-6 drop-shadow-xl" /> 
                    */}
                    <div className="text-8xl md:text-9xl mb-6 drop-shadow-2xl animate-bounce" style={{ animationDuration: '3s' }}>
                        🏆
                    </div>
                    
                    <div className="text-8xl md:text-9xl mb-4 drop-shadow-xl">
                        {champion.emoji}
                    </div>
                    
                    <h1 
                        className="text-4xl md:text-6xl font-black uppercase text-center tracking-tighter mt-4"
                        style={{ 
                            color: champion.primary_color || '#ffffff', 
                            textShadow: `3px 3px 0px ${champion.secondary_color || '#555555'}, 6px 6px 15px rgba(0,0,0,0.5)` 
                        }}
                    >
                        {champion.name}
                    </h1>
