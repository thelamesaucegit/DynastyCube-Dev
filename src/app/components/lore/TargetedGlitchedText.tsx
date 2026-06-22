// src/app/components/lore/TargetedGlitchedText.tsx
"use client";

import React from 'react';
import { useLoreEffects } from './LoreEffectsProvider';
import { GlitchEffect } from './GlitchEffect';

// 1. Define the keyword filter
// \b ensures whole word matching (e.g., 'hour' not 'flour')
// s? makes the plural 's' optional
const KEYWORD_REGEX = /\b(time|timewalk|clock|hour|minute|era|age|aeon|eon|moment|phase)s?\b/gi;

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

        if (React.isValidElement(node) && node.props.children) {
            return React.cloneElement(
                node, 
                { ...node.props, key },
                React.Children.map(node.props.children, processNode)
            );
        }

        return node;
    };

    return <>{React.Children.map(children, processNode)}</>;
};
