// src/app/cutscenes/test-clock/page.tsx
"use client";

import React, { useState } from "react";
import { ClockCutscene } from "@/app/components/cutscenes/ClockCutscene";
import { Button } from "@/app/components/ui/button";

export default function TestClockCutscene() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  return (
    <div className="container mx-auto max-w-lg text-center py-32 space-y-8">
      <h1 className="text-3xl font-bold">Cutscene Test Room</h1>
      
      {!isPlaying && !isFinished && (
        <Button onClick={() => setIsPlaying(true)} size="lg" className="bg-red-600 hover:bg-red-700 text-white">
          Launch Clock Cutscene
        </Button>
      )}

      {isPlaying && (
        <ClockCutscene 
          onComplete={() => {
            setIsPlaying(false);
            setIsFinished(true);
          }} 
        />
      )}

      {isFinished && (
        <div className="space-y-4">
          <p className="text-xl text-muted-foreground">Cutscene Complete.</p>
          <Button onClick={() => setIsFinished(false)} variant="outline">
            Reset & Play Again
          </Button>
        </div>
      )}
    </div>
  );
}
