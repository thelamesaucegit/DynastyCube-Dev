// src/app/the-drain/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image"; 
import { offerToTheDrain } from "@/app/actions/drainActions";

export default function TheDrainPage() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [communing, setCommuning] = useState(false);
  const [fade, setFade] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  // Set the background to pure black for this specific page
  useEffect(() => {
    document.body.style.backgroundColor = "black";
    return () => {
      document.body.style.backgroundColor = ""; // Reset on unmount
    };
  }, []);

  // Cycle through the 4 background images every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % 4);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || communing) return;

    setCommuning(true);
    setResponse(null);
    setFade(false);

    // Artificial delay to build suspense
    setTimeout(async () => {
        const result = await offerToTheDrain(input);
        
        setResponse(result.message);
        setCommuning(false);
        setInput("");
        
        // Trigger fade-in effect
        setTimeout(() => setFade(true), 50);
    }, 2000);
  };

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 font-mono select-none overflow-hidden">
      
      {/* --- THE OPTIMIZED BACKGROUND ANIMATION LAYER --- */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center bg-black">
        {/* 1. The 4 cycling images rendered via next/image */}
        {[1, 2, 3, 4].map((num, i) => (
            <div
                key={num}
                className="absolute inset-0 w-full h-full transition-opacity duration-1000"
                style={{
                    // Smooth 3-second crossfade opacity transition
                    opacity: bgIndex === i ? 0.35 : 0, 
                    transition: 'opacity 3000ms ease-in-out'
                }}
            >
                <Image
                    src={`/images/pages/drain${num}.png`}
                    alt={`Drain Visual ${num}`}
                    fill
                    priority={i === 0} // Preload the first image immediately
                    quality={50} // Heavy compression to save bandwidth
                    className="object-cover object-center"
                />
            </div>
        ))}
        
        {/* 2. The Animated Radial Gradient Overlay */}
        <div 
            className="absolute w-[150vw] h-[150vh]"
            style={{ 
                background: 'radial-gradient(circle at center, transparent 15%, black 45%)',
                animation: 'drain-breathe 6s infinite alternate ease-in-out'
            }} 
        />
      </div>

      {/* Global styles for the breathing mask animation */}
      <style jsx global>{`
        @keyframes drain-breathe {
            0% { transform: scale(0.8); }
            100% { transform: scale(1.25); }
        }
      `}</style>

      {/* --- FOREGROUND CONTENT LAYER --- */}
      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center">
        
        {/* THE FIX: Increased opacity to 90%, changed text to zinc-200, and added a custom white text-shadow */}
        <h1 className="text-zinc-200 tracking-[0.5em] text-sm md:text-base mb-16 opacity-90 cursor-default [text-shadow:_0_0_15px_rgba(255,255,255,0.7)] drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]">
          THE DRAIN
        </h1>

        <form onSubmit={handleSubmit} className="w-full relative mb-12">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={communing}
                placeholder="OFFER TRIBUTE"
                /* THE FIX: Brightened border (zinc-600), made active text pure white, and added a heavy text-shadow glow to user input */
                className="w-full bg-transparent border-b border-zinc-600 text-center text-white placeholder:text-zinc-500 placeholder:[text-shadow:none] py-4 focus:outline-none focus:border-zinc-300 transition-colors uppercase tracking-widest disabled:opacity-50 [text-shadow:_0_0_12px_rgba(255,255,255,0.8)]"
                autoComplete="off"
                spellCheck="false"
            />
        </form>

        <div className="h-24 flex items-center justify-center text-center">
            {communing && (
                /* THE FIX: Added glowing text-shadow to the loading state */
                <span className="text-zinc-200 tracking-[0.3em] text-sm animate-pulse [text-shadow:_0_0_15px_rgba(255,255,255,0.8)]">
                    COMMUNING...
                </span>
            )}
            
            {response && !communing && (
                /* THE FIX: Made response text pure white, slightly bolder, and gave it an intense double text-shadow */
                <p 
                    className={`text-white font-semibold tracking-wider text-sm md:text-base leading-loose transition-opacity duration-1000 ${fade ? 'opacity-100' : 'opacity-0'} [text-shadow:_0_0_20px_rgba(255,255,255,1),_0_0_8px_rgba(255,255,255,0.8)]`}
                >
                    {response}
                </p>
            )}
        </div>

      </div>
    </div>
  );
}
