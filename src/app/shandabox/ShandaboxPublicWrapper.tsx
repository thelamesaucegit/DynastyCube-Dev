// src/app/shandabox/ShandaboxPublicWrapper.tsx
"use client";

import React, { useState, useEffect } from "react";
import { VT323 } from 'next/font/google';

// Classic 90s pixel font!
const pixelFont = VT323({ weight: '400', subsets: ['latin'] });

export function ShandaboxPublicWrapper({ children }: { children: React.ReactNode }) {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('shandabox_theme');
        if (saved === 'dark') setIsDark(true);
    }, []);

    const toggleTheme = () => {
        const nextTheme = !isDark;
        setIsDark(nextTheme);
        localStorage.setItem('shandabox_theme', nextTheme ? 'dark' : 'light');
    };

    if (!mounted) return <div className="min-h-screen bg-black" />; // Prevent hydration mismatch flash

    return (
        <div className={`min-h-screen bg-black ${pixelFont.className} ${isDark ? 'theme-dark' : 'theme-light'}`}>
            {/* Background Layer with Opacity Trick */}
            <div 
                className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-300"
                style={{
                    backgroundImage: 'url(/images/shandabox/paper-texture.jpg)',
                    backgroundRepeat: 'repeat',
                    backgroundSize: 'auto',
                    opacity: isDark ? 0.5 : 1,
                }}
            />
            
            {/* Content Layer */}
            <div className="relative z-10 flex flex-col min-h-screen text-[color:var(--text-color)]">
                
                {/* Top Bar Toggle */}
                <div className="flex justify-end p-6">
                    <button 
                        onClick={toggleTheme}
                        className="px-4 py-2 border-[3px] border-current bg-transparent hover:bg-[color:var(--text-color)] hover:text-black transition-colors text-2xl uppercase tracking-widest font-bold"
                    >
                        {isDark ? "[ Switch to Light Mode ]" : "[ Switch to Dark Mode ]"}
                    </button>
                </div>

                {/* Localized Theme CSS */}
                <style jsx global>{`
                    .theme-light {
                        --text-color: #3e2723; /* Dark brown */
                        --card-bg: rgba(255, 255, 255, 0.3);
                    }
                    .theme-dark {
                        --text-color: #d7ccc8; /* Light brown */
                        --card-bg: rgba(0, 0, 0, 0.6);
                    }
                    .shanda-input {
                        background: rgba(0,0,0,0.1);
                        border: 3px solid var(--text-color);
                        color: var(--text-color);
                        padding: 0.75rem;
                        outline: none;
                        font-size: 1.5rem;
                    }
                    .shanda-input::placeholder {
                        color: var(--text-color);
                        opacity: 0.5;
                    }
                    .shanda-input:focus {
                        box-shadow: 0 0 12px var(--text-color);
                    }
                    .shanda-button {
                        border: 3px solid var(--text-color);
                        background: var(--card-bg);
                        color: var(--text-color);
                        padding: 0.75rem 1.5rem;
                        text-transform: uppercase;
                        font-weight: bold;
                        font-size: 1.5rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .shanda-button:hover:not(:disabled) {
                        background: var(--text-color);
                        color: #000;
                    }
                    .shanda-button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .shanda-panel {
                        background: var(--card-bg);
                        border: 3px solid var(--text-color);
                        padding: 1.5rem;
                        backdrop-filter: blur(2px);
                    }
                `}</style>
                
                <div className="flex-1 w-full max-w-5xl mx-auto p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
