// src/app/the-drain/page.tsx

"use client";

import React, { useState, useEffect } from "react";
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
    // Removed the solid bg-black class here so our fixed background shows through
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 font-mono select-none overflow-hidden">
      
      {/* --- BACKGROUND ANIMATION LAYER --- */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center bg-black">
        {/* 1. The 4 cycling images */}
        {[1, 2, 3, 4].map((num, i) => (
            <div
                key={num}
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundImage: `url('/images/pages/drain${num}.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    // Using inline styles for a smooth 3-second crossfade
                    opacity: bgIndex === i ? 0.5 : 0, 
                    transition: 'opacity 3s ease-in-out'
                }}
            />
        ))}
        
        {/* 2. The Animated Radial Gradient Overlay */}
        <div 
            className="absolute w-[150vw] h-[150vh]"
            style={{ 
                // A transparent center that fades into solid black
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
        
        <h1 className="text-zinc-500 tracking-[0.5em] text-sm md:text-base mb-16 opacity-50 cursor-default drop-shadow-md">
          THE DRAIN
        </h1>

        <form onSubmit={handleSubmit} className="w-full relative mb-12">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={communing}
                placeholder="OFFER TRIBUTE"
                className="w-full bg-transparent border-b border-zinc-800 text-center text-zinc-300 placeholder:text-zinc-800 py-4 focus:outline-none focus:border-zinc-500 transition-colors uppercase tracking-widest disabled:opacity-50"
                autoComplete="off"
                spellCheck="false"
            />
        </form>

        <div className="h-24 flex items-center justify-center text-center">
            {communing && (
                <span className="text-zinc-600 tracking-[0.3em] text-sm animate-pulse">
                    COMMUNING...
                </span>
            )}
            
            {response && !communing && (
                <p 
                    className={`text-zinc-300 tracking-wider text-sm leading-loose transition-opacity duration-1000 ${fade ? 'opacity-100' : 'opacity-0'}`}
                >
                    {response}
                </p>
            )}
        </div>

      </div>
    </div>
  );
}
