// src/app/components/lore/LoreEffectsProvider.tsx

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { KEYWORD_REGEX } from './TargetedGlitchedText';

const LORE_EFFECTS_ENABLED = true;

const LoreEffectsContext = createContext({ isEffectsActive: LORE_EFFECTS_ENABLED });

export const useLoreEffects = () => useContext(LoreEffectsContext);

const TimeRift = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: '50%', left: '50%' });

    useEffect(() => {
        if (!LORE_EFFECTS_ENABLED) return;
        let timeoutId: NodeJS.Timeout;

        const triggerRift = () => {
            const delay = Math.random() * 20000 + 10000;
            timeoutId = setTimeout(() => {
                setPosition({
                    top: `${Math.random() * 80 + 10}%`,
                    left: `${Math.random() * 80 + 10}%`,
                });
                setIsVisible(true);
                setTimeout(() => setIsVisible(false), Math.random() * 250 + 100);
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
                    position: fixed; width: 250px; height: 3px;
                    background: linear-gradient(90deg, transparent, #ff00ff, #00ffff, #ff00ff, transparent);
                    box-shadow: 0 0 5px #ff00ff, 0 0 10px #00ffff;
                    pointer-events: none; animation: rift-flicker 0.1s infinite;
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
    const [glitchStyle, setGlitchStyle] = useState({ bgPos: '50% 50%', mask: 'none' });

    // Organic blob generator
    const generateCorruptionState = () => {
        const bgX = Math.random() * 100;
        const bgY = Math.random() * 100;

        const masks = Array.from({ length: 3 }).map(() => {
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const size = Math.random() * 30 + 30; 
            return `radial-gradient(circle at ${x}% ${y}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${size}%)`;
        });

        return {
            bgPos: `${bgX}% ${bgY}%`,
            mask: masks.join(', ')
        };
    };

    useEffect(() => {
        if (!LORE_EFFECTS_ENABLED) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            const container = target.closest('[data-mtg-card-container="true"]');
            const imageContainer = target.closest('[src*="scryfall"]');
            
            const activeTarget = container || imageContainer;

            if (activeTarget) {
                const cardName = container ? container.getAttribute('data-card-name') || '' : imageContainer?.getAttribute('alt') || '';
                
                if (target.closest('[data-disable-corruption="true"]')) return;

                KEYWORD_REGEX.lastIndex = 0; 
                if (KEYWORD_REGEX.test(cardName)) {
                    setTargetElement(activeTarget as HTMLElement);
                    setRect(activeTarget.getBoundingClientRect());
                }
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const relatedTarget = e.relatedTarget as HTMLElement;
            
            const activeTarget = target.closest('[data-mtg-card-container="true"]') || target.closest('[src*="scryfall"]');
            const relatedActiveTarget = relatedTarget?.closest?.('[data-mtg-card-container="true"]') || relatedTarget?.closest?.('[src*="scryfall"]');

            if (activeTarget && activeTarget !== relatedActiveTarget) {
                setTargetElement(null);
            }
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

    // Rapidly change the glitch appearance while hovering over a target
    useEffect(() => {
        if (!targetElement) return;

        setGlitchStyle(generateCorruptionState()); // Initial set
        const intervalId = setInterval(() => {
            setGlitchStyle(generateCorruptionState());
        }, 150); 

        return () => clearInterval(intervalId);
    }, [targetElement]);

    if (!targetElement || !rect) return null;

    return (
        <div
            className="pointer-events-none fixed z-[9999] transition-opacity duration-300"
            style={{
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                backgroundImage: `url('/images/lore/corruption.png')`,
                backgroundSize: '200%',
                backgroundPosition: glitchStyle.bgPos,
                WebkitMaskImage: glitchStyle.mask,
                maskImage: glitchStyle.mask,
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
