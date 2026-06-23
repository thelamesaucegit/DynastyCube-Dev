// src/app/components/CardPreview.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { useSettings } from "@/contexts/SettingsContext";
import { CorruptedImage } from '@/app/components/lore/CorruptedImage';

interface CardPreviewProps {
  card: {
    card_name: string;
    image_url?: string | null;
    oldest_image_url?: string | null;
    oracle_text?: string | null;
  };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
  style = {}
}) => {
  const { useOldestArt } = useSettings();
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Simple mobile detection based on screen width
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const imageUrl = getCardImageUrl(card, useOldestArt);
  const cardName = card.card_name || '';
  const oracleText = card.oracle_text || '';

  // THE FIX: Declared isCorruptible *after* cardName and oracleText are extracted so the variables resolve perfectly!
  const isCorruptible = /\b(time|clock|hour|minute|era|age|aeon|eon|moment|turn)s?\b/gi.test(cardName + ' ' + oracleText);

  const scryfallUrl = `https://scryfall.com/search?as=grid&order=name&q=${encodeURIComponent('!"' + card.card_name + '"')}`;

  const handleMobileClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault(); // Stop navigation
      setIsHovered(!isHovered); // Toggle the zoom-in preview instead
    }
  };

  const portalContent =
    isHovered && imageUrl && mounted ? createPortal(
      <div 
        // FIX: Use pointer-events-auto on mobile so the onClick actually fires!
        // Added a subtle bg-black/40 on mobile to indicate the background is clickable to dismiss.
        className={`fixed inset-0 flex items-center justify-center z-[99999] ${isMobile ? "pointer-events-auto bg-black/40 backdrop-blur-sm" : "pointer-events-none"}`} 
        onClick={() => isMobile && setIsHovered(false)} // Tap anywhere to dismiss on mobile
      >
        <div className="bg-black/95 rounded-xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-gray-600 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
          
          {/* THE FIX: Replaced standard <img /> with our <CorruptedImage /> wrapper. 
              We wrap it in a relative container of exactly 320x446 to ensure correct aspect ratios. */}
          <div className="relative w-[320px] h-[446px] rounded-lg overflow-hidden block">
            <CorruptedImage 
              src={imageUrl} 
              alt={card.card_name} 
              isCorruptible={isCorruptible}
            />
          </div>

          <div className="text-center text-white text-sm font-bold mt-2 pb-1 px-2 truncate border-t border-white/10 pt-2">
            {card.card_name}
          </div>
        </div>
      </div>,
      document.body
    ) : null;

  return (
    <>
      <a
        href={scryfallUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        onClick={handleMobileClick}
        style={{
          display: "inline-block",
          textDecoration: "none",
          color: "inherit",
          cursor: isMobile ? "pointer" : "pointer",
          ...style
        }}
      >
        {children}
      </a>
      {portalContent}
    </>
  );
};
