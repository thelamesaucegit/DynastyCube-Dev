// src/app/components/lore/LoreEffectsProvider.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// This determines if the lore effects are active site-wide.
// For production, you could drive this with an environment variable.
const LORE_EFFECTS_ENABLED = true;

const LoreEffectsContext = createContext({ isEffectsActive: LORE_EFFECTS_ENABLED });

export const useLoreEffects = () => useContext(LoreEffectsContext);

// --- The "Time Rift" Visual Artifact ---
const TimeRift = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: '50%', left: '50%' });

    useEffect(() => {
        if (!LORE_EFFECTS_ENABLED) return;

        let timeoutId: NodeJS.Timeout;

        const triggerRift = () => {
            const delay = Math.random() * 20000 + 10000; // Trigger every 10-30 seconds

            timeoutId = setTimeout(() => {
                // Set a random position on the screen
                setPosition({
                    top: `${Math.random() * 80 + 10}%`,
                    left: `${Math.random() * 80 + 10}%`,
                });
                setIsVisible(true);

                // The rift only lasts for a short duration
                setTimeout(() => setIsVisible(false), Math.random() * 250 + 100);

                // Schedule the next rift
                triggerRift();
            }, delay);
        };

        triggerRift();

        return () => clearTimeout(timeoutId);
    }, []);

    if (!isVisible) return null;

    return (
        <>
            <style jsx>{`
                @keyframes rift-flicker {
                    0%, 100% { opacity: 0.8; transform: scale(1) skewX(-15deg); }
                    50% { opacity: 0.5; transform: scale(1.05) skewX(-15deg); }
                }
                .rift-artifact {
                    position: fixed;
                    width: 250px;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, #ff00ff, #00ffff, #ff00ff, transparent);
                    box-shadow: 0 0 5px #ff00ff, 0 0 10px #00ffff;
                    pointer-events: none;
                    animation: rift-flicker 0.1s infinite;
                    z-index: 99999;
                }
            `}</style>
            <div className="rift-artifact" style={{ top: position.top, left: position.left }} />
        </>
    );
};


export const LoreEffectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <LoreEffectsContext.Provider value={{ isEffectsActive: LORE_EFFECTS_ENABLED }}>
            {children}
            {LORE_EFFECTS_ENABLED && <TimeRift />}
        </LoreEffectsContext.Provider>
    );
};
