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
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
}) => {
  const { useOldestArt } = useSettings();
  const [isHovering, setIsHovering] = useState(false);

  const imageUrl = getCardImageUrl(card, useOldestArt);

  return (
    <>
      {/* 
        The wrapper that triggers the hover state. 
        It has no complex refs or math anymore. 
      */}
      <div
        className={className}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      
      {/* 
        The Preview Overlay.
        It uses 'fixed' positioning to anchor to the viewport window.
      */}
      {isHovering && imageUrl && (
        <div
          className="fixed pointer-events-none"
          style={{ 
            // Fixed position: Bottom Right
            // We use 'bottom: 80px' to clear your Replay Footer controls
            bottom: '80px', 
            right: '20px',
            
            // Or, if you want Bottom Left:
            // bottom: '80px',
            // left: '20px',

            zIndex: 9999, // Ensure it's on top of everything
          }}
        >
          <div className="bg-black/95 rounded-xl p-2 shadow-2xl border border-gray-600 backdrop-blur-sm flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={card.card_name}
              // Fixed size: exactly 280px wide. 
              className="w-[280px] h-auto rounded-lg block"
              style={{ objectFit: "contain" }}
            />
            {/* Card Name Label underneath */}
            <div className="text-center text-white text-sm font-bold mt-2 pb-1 px-2 w-full truncate border-t border-white/10 pt-2">
              {card.card_name}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
