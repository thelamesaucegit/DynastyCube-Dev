//src/app/components/CardPreview.tsx

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { useSettings } from "@/contexts/SettingsContext";

interface CardPreviewProps {
  card: {
    card_name: string;
    image_url?: string | null;
    oldest_image_url?: string | null;
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

  const scryfallUrl = `https://scryfall.com/search?as=grid&order=name&q=${encodeURIComponent('"' + card.card_name + '"')}`;

  const handleMobileClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault(); // Stop navigation
      setIsHovered(!isHovered); // Toggle the zoom-in preview instead
    }
  };

  const portalContent =
    isHovered && imageUrl && mounted
      ? createPortal(
          <div 
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-[99999]"
            onClick={() => isMobile && setIsHovered(false)} // Tap anywhere to dismiss on mobile
          >
            <div className="bg-black/95 rounded-xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-gray-600 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
              <img
                src={imageUrl}
                alt={card.card_name}
                className="w-[320px] h-[446px] rounded-lg block object-contain"
              />
              <div className="text-center text-white text-sm font-bold mt-2 pb-1 px-2 truncate border-t border-white/10 pt-2">
                {card.card_name}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

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
