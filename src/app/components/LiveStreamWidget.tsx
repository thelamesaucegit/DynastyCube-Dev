// src/app/components/LiveStreamWidget.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { PlayCircle, Radio } from "lucide-react";
import { type StreamMatch } from "@/app/actions/liveStreamActions";

interface LiveStreamWidgetProps {
  initialMatch: StreamMatch;
  onStreamEnd: () => void;
}

export function LiveStreamWidget({ initialMatch, onStreamEnd }: LiveStreamWidgetProps) {
  const [liveMatch, setLiveMatch] = useState(initialMatch);
  const [liveLife, setLiveLife] = useState<{t1: number, t2: number} | null>(null);
  const [streamStatus, setStreamStatus] = useState<'upcoming' | 'live' | 'replay'>('upcoming');
  const [formattedStreamTime, setFormattedStreamTime] = useState('');

  useEffect(() => {
    const broadcastStartTime = new Date(liveMatch.match_date).getTime() + (30 * 60000);
    const broadcastEndTime = broadcastStartTime + (liveMatch.total_steps * 3000);

    const interval = setInterval(() => {
      const now = Date.now();
      
      if (now < broadcastStartTime) {
        setStreamStatus('upcoming');
        setFormattedStreamTime(new Date(broadcastStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      } else if (now >= broadcastStartTime && now <= broadcastEndTime) {
        setStreamStatus('live');
        const ticksPassed = Math.floor((now - broadcastStartTime) / 3000);
        if (ticksPassed < liveMatch.life_timeline.length) {
          const [t1, t2] = liveMatch.life_timeline[ticksPassed];
          setLiveLife({ t1, t2 });
        }
      } else {
        setStreamStatus('replay');
        clearInterval(interval);
        onStreamEnd(); // Notify parent to reload data
      }
    }, 100);

    return () => clearInterval(interval);
  }, [liveMatch, onStreamEnd]);

  return (
    <section className="max-w-5xl mx-auto w-full">
      <Card className={`overflow-hidden relative border ${streamStatus === 'live' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-950/10' : 'border-blue-500/30 bg-blue-950/10'}`}>
        {streamStatus === 'live' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />}
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 text-center md:text-left">
            {/* ... (Badge and Title logic) ... */}
          </div>
          <div className="flex items-center gap-6 flex-1 justify-center bg-background/50 px-8 py-4 rounded-xl border border-border/50 shadow-inner">
            <div className="text-center">
              <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team1.emoji}</div>
              <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team1.name}</div>
              <div className="text-xs text-muted-foreground font-mono mt-1 mb-2">{liveMatch.team1_record.wins} - {liveMatch.team1_record.losses}</div>
              {streamStatus === 'live' && liveLife && <Badge variant="outline" className="text-lg px-3 py-1 border-red-500/30 bg-red-950/20 text-red-400 shadow-sm">♥ {liveLife.t1}</Badge>}
            </div>
            <div className="flex flex-col items-center justify-center">
                <div className="text-2xl font-black text-muted-foreground/30 px-4 italic mb-1">VS</div>
                <div className="flex flex-col items-center text-[10px] text-muted-foreground bg-muted/80 px-2 py-1 rounded border border-border/50">
                    <span className="font-semibold text-foreground/80">{new Date(liveMatch.match_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric'})}</span>
                    <span>{formattedStreamTime || new Date(new Date(liveMatch.match_date).getTime() + (30 * 60000)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
            </div>
            <div className="text-center">
                <div className="text-4xl mb-1 drop-shadow-md">{liveMatch.team2.emoji}</div>
                <div className="font-bold text-sm truncate max-w-[100px]">{liveMatch.team2.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1 mb-2">{liveMatch.team2_record.wins} - {liveMatch.team2_record.losses}</div>
                {streamStatus === 'live' && liveLife && <Badge variant="outline" className="text-lg px-3 py-1 border-red-500/30 bg-red-950/20 text-red-400 shadow-sm">♥ {liveLife.t2}</Badge>}
            </div>
          </div>
          <div className="flex-1 flex justify-center md:justify-end">
            <Button asChild size="lg" className={`${streamStatus === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold w-full md:w-auto h-14 px-8 text-lg shadow-xl hover:scale-105 transition-transform`}>
              <Link href={`/stream/${liveMatch.sim_match_id}`}>
                Tune In <PlayCircle className="ml-2 size-5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
