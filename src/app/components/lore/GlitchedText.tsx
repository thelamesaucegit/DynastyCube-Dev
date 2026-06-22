// src/app/components/lore/GlitchedText.tsx
"use client";

import React, { useState, useRef } from 'react';
import { useLoreEffects } from './LoreEffectsProvider';

const GLITCH_CHARACTERS = '█▓▒░■□▲▼◆▶ÄÖÜß$#@*';

export const GlitchedText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isEffectsActive } = useLoreEffects();
    const [text, setText] = useState(children);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const originalText = useRef(children);

    if (!isEffectsActive) {
        return <>{children}</>;
    }

    const handleMouseOver = () => {
        if (typeof originalText.current !== 'string') return;
        
        let iteration = 0;
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            setText(
                (originalText.current as string)
                    .split("")
                    .map((_letter, index) => {
                        if (index < iteration) {
                            return (originalText.current as string)[index];
                        }
                        return GLITCH_CHARACTERS[Math.floor(Math.random() * GLITCH_CHARACTERS.length)];
                    })
                    .join("")
            );

            if(iteration >= (originalText.current as string).length) {
                if(intervalRef.current) clearInterval(intervalRef.current);
            }

            iteration += 1 / 3;
        }, 30);
    };

    const handleMouseOut = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setText(originalText.current);
    };

    return (
        <span onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            {text}
        </span>
    );
};
