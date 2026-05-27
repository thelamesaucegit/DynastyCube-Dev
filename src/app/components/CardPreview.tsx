// src/app/components/CardPreview.tsx
"use client";

import React, { useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

interface CardPreviewProps {
  card: {
    image_url?: string | null;
    oldest_image_url?: string | null;
    card_name: string;
  };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties; 
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
  style = {}, 
}) => {
  const { useOldestArt } = useSettings();
  const [isHovering, setIsHovering] = useState(false);
  
  const imageUrl = getCardImageUrl(card, useOldestArt);
  const scryfallUrl = `https://scryfall.com/cards/named?exact=${encodeURIComponent(card.card_name)}`;

  return (
    <>
      <a
        href={scryfallUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{ display: 'inline-block', textDecoration: 'none', color: 'inherit', cursor: 'pointer', ...style }} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
      
      {isHovering && imageUrl && (
        <div
          className="fixed pointer-events-none"
          style={{ 
            left: '50%', 
            top: '50%',
            transform: 'translate(-50%, -50%)', // Mathematically dead-center
            zIndex: 99999, // Ensure it beats any game board layering
          }}
        >
          <div className="bg-black/95 rounded-xl p-2 shadow-2xl border border-gray-600 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={card.card_name}
              className="w-[280px] md:w-[360px] h-auto rounded-lg block shadow-black/50 shadow-2xl"
              style={{ objectFit: "contain" }}
            />
            <div className="text-center text-white text-sm font-bold mt-2 pb-1 px-2 truncate border-t border-white/10 pt-2">
              {card.card_name}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
