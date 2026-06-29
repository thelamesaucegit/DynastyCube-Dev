// src/app/components/CardPreview.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { useSettings } from "@/contexts/SettingsContext";
import { CorruptedImage } from '@/app/components/lore/CorruptedImage';

// Dictionary to map database short_names to beautiful display names
const SCAR_DICTIONARY: Record<string, string> = {
  superdupe: "SuperDuplication",
  blessed: "Blessed",
  duplication: "Duplication",
  resort: "Resort Destination",
  eternal: "Eternal",
  shiny: "Shiny",
  brittle: "Brittle",
  dingy: "Dingy",
  unstable: "Unstable",
};

interface CardPreviewProps {
  card: {
    card_name: string;
    image_url?: string | null;
    oldest_image_url?: string | null;
    oracle_text?: string | null;
    scars?: string[] | null; // <-- ADDED: The component now expects scars
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
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const imageUrl = getCardImageUrl(card, useOldestArt);
  const cardName = card.card_name || '';
  const oracleText = card.oracle_text || '';
  const scars = card.scars || [];
  const hasScars = scars.length > 0;

  const isCorruptible = /\b(time|clock|hour|minute|era|age|aeon|eon|moment|turn)s?\b/gi.test(cardName + ' ' + oracleText);

  const scryfallUrl = `https://scryfall.com/search?as=grid&order=name&q=${encodeURIComponent('!"' + card.card_name + '"')}`;

  const handleMobileClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault(); 
      setIsHovered(!isHovered); 
    }
  };

  const portalContent =
    isHovered && imageUrl && mounted ? createPortal(
      <div 
        className={`fixed inset-0 flex items-center justify-center z-[99999] ${isMobile ? "pointer-events-auto bg-black/40 backdrop-blur-sm" : "pointer-events-none"}`} 
        onClick={() => isMobile && setIsHovered(false)} 
      >
        <div className="bg-black/95 rounded-xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-gray-600 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
          
          <div className="relative w-[320px] h-[446px] rounded-lg overflow-hidden block">
            <CorruptedImage 
              src={imageUrl} 
              alt={card.card_name} 
              isCorruptible={isCorruptible}
            />
          </div>

          <div className={`text-center text-white text-sm font-bold mt-2 px-2 truncate border-t border-white/10 pt-2 ${hasScars ? 'pb-1' : 'pb-2'}`}>
            {card.card_name}
          </div>

          {/* THE FIX: Inject red scar badges under the card name on hover */}
          {hasScars && (
            <div className="flex flex-wrap justify-center gap-1.5 pb-2 px-2 mt-1">
              {scars.map(scar => (
                <span key={scar} className="bg-red-950/80 text-red-200 border border-red-700/50 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded shadow-sm">
                  {SCAR_DICTIONARY[scar] || scar}
                </span>
              ))}
            </div>
          )}

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
          position: "relative", // Ensures absolute children anchor to this wrapper
          textDecoration: "none",
          color: "inherit",
          cursor: isMobile ? "pointer" : "pointer",
          ...style
        }}
      >
        {children}

        {/* THE FIX: Skull Indicator on the base grid view */}
        {hasScars && (
          <div className="absolute bottom-2 right-2 bg-black/80 rounded-md px-1.5 py-1 text-[10px] leading-none shadow-md z-10 pointer-events-none backdrop-blur-sm border border-white/10">
            💀
          </div>
        )}
      </a>
      {portalContent}
    </>
  );
};
