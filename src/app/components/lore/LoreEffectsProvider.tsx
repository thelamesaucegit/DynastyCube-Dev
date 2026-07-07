// src/app/components/lore/LoreEffectsProvider.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { KEYWORD_REGEX } from './TargetedGlitchedText';

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


// --- Global Card Corruption Overlay (Targeted) ---
const GlobalCardCorruption = () => {
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [clipPath, setClipPath] = useState('none');

    useEffect(() => {
        if (!LORE_EFFECTS_ENABLED) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // THE FIX: Check the target and its parents for a Scryfall image.
            // This works for both raw <img> tags and Next.js's complex structures.
            const imageContainer = target.closest('[src*="scryfall"]');

            if (imageContainer) {
                const cardName = imageContainer.getAttribute('alt') || '';
                
                // --- DIAGNOSTIC LOGGING ---
                console.log(`[LoreProvider] Hover detected over an image container with alt text: "${cardName}"`);
                
                if (target.closest('[data-disable-corruption="true"]')) {
                    console.log(`[LoreProvider] ↳ Corruption is disabled for this container.`);
                    return;
                }

                KEYWORD_REGEX.lastIndex = 0; 
                if (KEYWORD_REGEX.test(cardName)) {
                    console.log(`[LoreProvider] ✅ SUCCESS: Card "${cardName}" matched the keywords.`);
                    setTargetElement(imageContainer as HTMLElement);
                    setRect(imageContainer.getBoundingClientRect());
                    
                    const x1 = Math.random() * 50;
                    const x2 = x1 + Math.random() * 30 + 10;
                    const y1 = Math.random() * 80;
                    const y2 = y1 + Math.random() * 15 + 5;
                    setClipPath(`polygon(${x1}% ${y1}%, ${x2}% ${y1}%, ${x2}% ${y2}%, ${x1}% ${y2}%)`);
                } else {
                    // --- DIAGNOSTIC LOGGING ---
                    console.log(`[LoreProvider] ↳ Skipping effect: Card "${cardName}" did not match keywords.`);
                }
            }
        };

        const handleMouseOut = () => {
            setTargetElement(null);
        };

        const handleScrollOrResize = () => {
            if (targetElement) {
                setRect(targetElement.getBoundingClientRect());
            }
        };

        window.addEventListener('mouseover', handleMouseOver);
        window.addEventListener('mouseout', handleMouseOut);
        window.addEventListener('scroll', handleScrollOrResize, true); 
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('mouseover', handleMouseOver);
            window.removeEventListener('mouseout', handleMouseOut);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [targetElement]);

    if (!targetElement || !rect) return null;

    return (
        <div
            className="pointer-events-none fixed z-[9999] transition-opacity duration-300"
            style={{
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                backgroundImage: `url('/images/lore/corruption.png')`,
                backgroundSize: 'cover',
                clipPath: clipPath,
                animation: 'glitch-shift 0.2s infinite'
            }}
        />
    );
};

export const LoreEffectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <LoreEffectsContext.Provider value={{ isEffectsActive: LORE_EFFECTS_ENABLED }}>
            {children}
            {LORE_EFFECTS_ENABLED && <TimeRift />}
            {LORE_EFFECTS_ENABLED && <GlobalCardCorruption />} 
        </LoreEffectsContext.Provider>
    );
};
