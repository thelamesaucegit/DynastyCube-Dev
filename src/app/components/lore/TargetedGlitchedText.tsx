// src/app/components/lore/TargetedGlitchedText.tsx
"use client";

import React from 'react';
import { useLoreEffects } from './LoreEffectsProvider';
import { GlitchEffect } from './GlitchEffect';

// 1. Define the keyword filter
// \b ensures whole word matching (e.g., 'hour' not 'flour')
// s? makes the plural 's' optional
const KEYWORD_REGEX = /\b(time|clock|hour|minute|era|age|timetwister|timewalk|aeon|eon|moment|turn)s?\b/gi;

export const TargetedGlitchedText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isEffectsActive } = useLoreEffects();

    if (!isEffectsActive) {
        return <>{children}</>;
    }

    const processNode = (node: React.ReactNode, key: string | number): React.ReactNode => {
        if (typeof node === 'string') {
            const parts = node.split(KEYWORD_REGEX);
            return (
                <React.Fragment key={key}>
                    {parts.map((part, index) => {
                        // The matched keywords will be at odd indices
                        if (index % 2 === 1) {
                            return <GlitchEffect key={index}>{part}</GlitchEffect>;
                        }
                        return part;
                    })}
                </React.Fragment>
            );
        }

        // THE FIX: Explicitly cast the element to a typed ReactElement to safely access `props.children`
        if (React.isValidElement(node)) {
            const element = node as React.ReactElement<{ children?: React.ReactNode }>;
            
            if (element.props.children) {
                return React.cloneElement(
                    element, 
                    { ...element.props, key },
                    React.Children.map(element.props.children, processNode)
                );
            }
        }

        return node;
    };

    return <>{React.Children.map(children, processNode)}</>;
};
