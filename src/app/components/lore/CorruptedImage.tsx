// src/app/components/lore/CorruptedImage.tsx
"use client";

import React, { useState } from 'react';
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

    // Only apply the effect if the lore is active AND the card is corruptible
    const canBeCorrupted = isEffectsActive && isCorruptible;

    const generateClipPath = () => {
        const x1 = Math.random() * 50;
        const x2 = x1 + Math.random() * 30 + 10;
        const y1 = Math.random() * 80;
        const y2 = y1 + Math.random() * 15 + 5;
        return `polygon(${x1}% ${y1}%, ${x2}% ${y1}%, ${x2}% ${y2}%, ${x1}% ${y2}%)`;
    };
    
    return (
        <div 
            className="relative w-full h-full"
            onMouseEnter={() => canBeCorrupted && setIsGlitching(true)}
            onMouseLeave={() => canBeCorrupted && setIsGlitching(false)}
        >
            {/* Original Card Image */}
            <Image src={src} alt={alt} layout="fill" objectFit="contain" />

            {/* Corruption Overlay */}
            {canBeCorrupted && (
                 <div
                    className="absolute inset-0 w-full h-full transition-opacity duration-300"
                    style={{
                        backgroundImage: `url(${CORRUPTION_TEXTURE_URL})`,
                        backgroundSize: 'cover',
                        opacity: isGlitching ? 1 : 0,
                        clipPath: isGlitching ? generateClipPath() : 'none',
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
