// src/app/the-drain/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { offerToTheDrain } from "@/app/actions/drainActions";

export default function TheDrainPage() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [communing, setCommuning] = useState(false);
  const [fade, setFade] = useState(false);

  // Set the background to pure black for this specific page
  useEffect(() => {
    document.body.style.backgroundColor = "black";
    return () => {
      document.body.style.backgroundColor = ""; // Reset on unmount
    };
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
    <div className="min-h-[85vh] bg-black flex flex-col items-center justify-center px-4 font-mono select-none">
      
      <div className="w-full max-w-lg mx-auto flex flex-col items-center">
        
        <h1 className="text-zinc-500 tracking-[0.5em] text-sm md:text-base mb-16 opacity-50 cursor-default">
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
