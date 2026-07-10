// src/app/components/lore/GlitchEffect.tsx

"use client";

import React, { useState, useRef, useEffect } from 'react';

const GLITCH_CHARACTERS = '█▓▒░■□▲▼◆▶ÄÖÜß$#@*';

// This component applies a continuous, randomized visual glitch effect to any text passed to it.
export const GlitchEffect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [text, setText] = useState(children);
    const originalText = useRef(children);
    
    // We use refs to track the active intervals/timeouts so we can clean them up safely
    const activeInterval = useRef<NodeJS.Timeout | null>(null);
    const nextTimeout = useRef<NodeJS.Timeout | null>(null);

    // Ensure state updates if children prop changes
    useEffect(() => {
        setText(children);
        originalText.current = children;
    }, [children]);

    useEffect(() => {
        if (typeof originalText.current !== 'string') return;

        const runGlitchCycle = () => {
            let iteration = 0;
            
            if (activeInterval.current) clearInterval(activeInterval.current);
            
            activeInterval.current = setInterval(() => {
                setText(
                    (originalText.current as string)
                        .split("")
                        .map((_letter, index) => {
                            if (index < iteration) return (originalText.current as string)[index];
                            return GLITCH_CHARACTERS[Math.floor(Math.random() * GLITCH_CHARACTERS.length)];
                        })
                        .join("")
                );

                // When the word is fully revealed again
                if (iteration >= (originalText.current as string).length) {
                    if (activeInterval.current) clearInterval(activeInterval.current);
                    setText(originalText.current);
                    
                    // Schedule the next glitch cycle! (Random pause between 0.5s and 4s)
                    nextTimeout.current = setTimeout(runGlitchCycle, Math.random() * 3500 + 500);
                }

                iteration += 1 / 3;
            }, 30);
        };

        // Start the first cycle with a random delay so multiple words don't sync up perfectly
        nextTimeout.current = setTimeout(runGlitchCycle, Math.random() * 2000);

        return () => {
            // Clean up all timers when the component unmounts
            if (activeInterval.current) clearInterval(activeInterval.current);
            if (nextTimeout.current) clearTimeout(nextTimeout.current);
        };
    }, []);

    return (
        <span 
            className="inline-block relative font-bold tracking-tight"
            style={{ 
                // Constant chromatic aberration text shadow
                textShadow: "1px 0px 2px rgba(255, 0, 255, 0.5), -1px 0px 2px rgba(0, 255, 255, 0.5)",
                animation: "text-jitter 3s infinite"
            }}
        >
            {text}
            
            {/* Subtle, unpredictable physical jitter */}
            <style jsx>{`
                @keyframes text-jitter {
                    0%, 95%, 100% { transform: translate(0, 0); }
                    96% { transform: translate(1px, -1px) skewX(2deg); }
                    98% { transform: translate(-1px, 1px) skewX(-2deg); }
                }
            `}</style>
        </span>
    );
};
