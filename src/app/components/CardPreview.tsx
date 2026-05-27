// src/app/components/CardPreview.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  // We need to wait for the component to mount before using createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  const imageUrl = getCardImageUrl(card, useOldestArt);
  const scryfallUrl = `https://scryfall.com/search?as=grid&order=name&q=${encodeURIComponent('"' + card.card_name + '"')}`;

  const previewElement = isHovering && imageUrl && mounted ? (
    createPortal(
      <div 
        className="fixed inset-0 pointer-events-none flex items-center justify-center z-[99999]"
      >
        <div className="bg-black/95 rounded-xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-gray-600 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={card.card_name}
            // Firmly locked size that ignores all parent scaling
            className="w-[320px] h-[446px] rounded-lg block object-contain"
          />
          <div className="text-center text-white text-sm font-bold mt-2 pb-1 px-2 truncate border-t border-white/10 pt-2">
            {card.card_name}
          </div>
        </div>
      </div>,
      document.body // Teleports the element entirely outside of the Replay Viewer!
    )
  ) : null;

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
      {previewElement}
    </>
  );
};
