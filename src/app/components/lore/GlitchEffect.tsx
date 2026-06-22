// src/app/components/lore/GlitchEffect.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';

const GLITCH_CHARACTERS = '█▓▒░■□▲▼◆▶ÄÖÜß$#@*';

// This component applies the visual glitch effect to any text passed to it.
export const GlitchEffect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [text, setText] = useState(children);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const originalText = useRef(children);

    // Ensure state updates if children prop changes
    useEffect(() => {
        setText(children);
        originalText.current = children;
    }, [children]);

    const handleMouseOver = () => {
        if (typeof originalText.current !== 'string') return;
        let iteration = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setText(
                (originalText.current as string)
                    .split("")
                    .map((_letter, index) => {
                        if (index < iteration) return (originalText.current as string)[index];
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
        if (intervalRef.current) clearInterval(intervalRef.current);
        setText(originalText.current);
    };

    return (
        <span className="inline-block" onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            {text}
        </span>
    );
};
