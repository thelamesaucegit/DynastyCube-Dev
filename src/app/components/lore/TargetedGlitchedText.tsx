// src/app/components/lore/TargetedGlitchedText.tsx
"use client";

import React from 'react';
import { useLoreEffects } from './LoreEffectsProvider';
import { GlitchEffect } from './GlitchEffect';

// 1. Define the keyword filter
// \b ensures whole word matching (e.g., 'hour' not 'flour')
// s? makes the plural 's' optional
export const KEYWORD_REGEX = /\b(time|timezone|timed|timer|hourglass|timing|timepiece|clock|clocked|clockwork|hour|minute|era|age|timetwister|timewalk|aeon|eon|moment|ticking|tock)s?\b/gi;

interface TargetedGlitchedTextProps {
    text?: string;
    children?: React.ReactNode;
}

export const TargetedGlitchedText: React.FC<TargetedGlitchedTextProps> = ({ text, children }) => {
    const { isEffectsActive } = useLoreEffects();

    // Helper to process a raw string and return an array of strings and GlitchEffects
    const processString = (str: string) => {
        if (!isEffectsActive) return <>{str}</>;
        
        const parts = str.split(KEYWORD_REGEX);
        return (
            <>
                {parts.map((part, index) => {
                    // The regex capturing group ensures matched keywords are at odd indices
                    if (index % 2 === 1) {
                        return <GlitchEffect key={index}>{part}</GlitchEffect>;
                    }
                    return part;
                })}
            </>
        );
    };

    // 1. If explicitly passed a text string prop (Best for dynamic content like News)
    if (text) {
        return processString(text);
    }

    // 2. If wrapping a simple string child
    if (typeof children === 'string') {
        return processString(children);
    }

    // 3. Fallback: If it's a complex element, just render it normally
    return <>{children}</>;
};
