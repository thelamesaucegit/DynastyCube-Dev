// src/app/components/cutscenes/ClockCutsceneManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ClockCutscene } from "./ClockCutscene";

export const ClockCutsceneManager = () => {
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    // 1. Set the exact time it goes live (UTC format)
    const LIVE_START = new Date("2026-09-04T02:00:00Z").getTime(); 
    
    // 2. It automatically expires 24 hours later
    const LIVE_END = LIVE_START + (24 * 60 * 60 * 1000); 
    
    const now = Date.now();
    const hasSeen = localStorage.getItem("hasSeenClockCutscene");

    // If we are in the 24-hour window AND the user hasn't seen it yet, trigger it!
    if (now >= LIVE_START && now <= LIVE_END && !hasSeen) {
      setShouldPlay(true);
    }
  }, []);

  if (!shouldPlay) return null;

  return (
    <ClockCutscene 
      onComplete={() => {
        // Flag it as seen in the browser so it never auto-plays for this user again
        localStorage.setItem("hasSeenClockCutscene", "true");
        setShouldPlay(false);
      }} 
    />
  );
};
