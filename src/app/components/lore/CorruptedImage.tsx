// src/app/components/lore/CorruptedImage.tsx

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useLoreEffects } from './LoreEffectsProvider';

interface CorruptedImageProps {
    src: string;
    alt: string;
    isCorruptible: boolean; // Flag to enable the effect
}

const CORRUPTION_TEXTURE_URL = '/images/lore/corruption.png';

export const CorruptedImage: React.FC<CorruptedImageProps> = ({ src, alt, isCorruptible }) => {
    const { isEffectsActive } = useLoreEffects();
    const [isGlitching, setIsGlitching] = useState(false);
    const [glitchStyle, setGlitchStyle] = useState({ bgPos: '50% 50%', mask: 'none' });

    // Only apply the effect if the lore is active AND the card is corruptible
    const canBeCorrupted = isEffectsActive && isCorruptible;

    // --- DIAGNOSTIC LOGGING ---
    useEffect(() => {
        if (isCorruptible) {
            console.log(`[CorruptedImage] 👁️ Rendered "${alt}" | isEffectsActive: ${isEffectsActive} | canBeCorrupted: ${canBeCorrupted}`);
        }
    }, [alt, isCorruptible, isEffectsActive, canBeCorrupted]);

    useEffect(() => {
        if (isGlitching) {
            console.log(`[CorruptedImage] ⚡ Glitch activated for "${alt}" (Hover state)`);
        }
    }, [isGlitching, alt]);
    // --------------------------------

    // Generates a randomized layout of organic corruption blobs and background shifts
    const generateCorruptionState = () => {
        const bgX = Math.random() * 100;
        const bgY = Math.random() * 100;

        // Create 3 overlapping radial gradients for a soft, spreading organic blotch
        const masks = Array.from({ length: 3 }).map(() => {
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const size = Math.random() * 30 + 30; // Between 30% and 60% radius
            return `radial-gradient(circle at ${x}% ${y}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${size}%)`;
        });

        return {
            bgPos: `${bgX}% ${bgY}%`,
            mask: masks.join(', ')
        };
    };

    // Rapidly change the glitch appearance while hovering
    useEffect(() => {
        if (!isGlitching) {
            setGlitchStyle({ bgPos: '50% 50%', mask: 'none' });
            return;
        }

        setGlitchStyle(generateCorruptionState()); // Initial set
        const intervalId = setInterval(() => {
            setGlitchStyle(generateCorruptionState());
        }, 150); // Shifts every 150ms for a frantic, unstable look

        return () => clearInterval(intervalId);
    }, [isGlitching]);

    return (
        <div 
            className="relative w-full h-full"
            onMouseEnter={() => canBeCorrupted && setIsGlitching(true)}
            onMouseLeave={() => canBeCorrupted && setIsGlitching(false)}
        >
            {/* Original Card Image */}
            <Image src={src} alt={alt} layout="fill" objectFit="contain" unoptimized/>

            {/* Corruption Overlay */}
            {canBeCorrupted && (
                 <div
                    className="absolute inset-0 w-full h-full transition-opacity duration-300"
                    style={{
                        backgroundImage: `url(${CORRUPTION_TEXTURE_URL})`,
                        backgroundSize: '200%', // Enlarge so the shifting is highly visible
                        backgroundPosition: glitchStyle.bgPos,
                        opacity: isGlitching ? 1 : 0,
                        WebkitMaskImage: isGlitching ? glitchStyle.mask : 'none',
                        maskImage: isGlitching ? glitchStyle.mask : 'none',
                        animation: isGlitching ? 'glitch-shift 0.2s infinite' : 'none'
                    }}
                 />
            )}

            <style jsx global>{`
                @keyframes glitch-shift {
                    0% { transform: translate(2px, -2px); }
                    25% { transform: translate(-2px, 2px); }
                    50% { transform: translate(0, 2px); }
                    75% { transform: translate(2px, 0); }
                    100% { transform: translate(-2px, -2px); }
                }
            `}</style>
        </div>
    );
};
