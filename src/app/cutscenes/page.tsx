// src/app/cutscenes/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Play } from "lucide-react";

export default function CutscenesArchivePage() {
  return (
    <div className="container max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight mb-2">Cutscene Archive</h1>
        <p className="text-muted-foreground text-lg">Replay past lore events.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        
        {/* The Clock Archive Card */}
        <Link href="/cutscenes/the-clock" className="group">
          <Card className="overflow-hidden border-border/50 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all">
            <div className="relative h-48 bg-black/90 flex items-center justify-center border-b">
              <Image 
                src="/images/lore/corruption.png" 
                alt="The Clock" 
                width={120} 
                height={120} 
                className="opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors" />
              <Play className="absolute size-12 text-white/50 group-hover:text-red-500 transition-colors" />
            </div>
            <CardHeader className="bg-card">
              <CardTitle className="text-lg">The Clock Returns</CardTitle>
            </CardHeader>
            <CardContent className="bg-card text-sm text-muted-foreground pb-6">
              The architect of the Season 5 Corruption reveals themselves.
            </CardContent>
          </Card>
        </Link>

      </div>
    </div>
  );
}
