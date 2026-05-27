//src/app/components/CardPreview.tsx

"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
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
  headerOffset?: number;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
  style = {}, 
  headerOffset = 55,
}) => {
  const { useOldestArt } = useSettings();
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLAnchorElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageUrl = getCardImageUrl(card, useOldestArt);

  // Construct the Scryfall search URL
  const scryfallUrl = `https://scryfall.com/cards/named?exact=${encodeURIComponent(card.card_name)}`;

  useLayoutEffect(() => {
    if (!isHovering || !containerRef.current || !previewRef.current) return;
    const updatePosition = () => {
      if (!containerRef.current || !previewRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const previewRect = previewRef.current.getBoundingClientRect();
      const pWidth = previewRect.width;
      const pHeight = previewRect.height;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const padding = 12;

      let x = rect.right + padding;
      if (x + pWidth > viewportW - padding) x = rect.left - pWidth - padding;
      if (x < padding) x = (viewportW - pWidth) / 2;

      let y = rect.top;
      if (y + pHeight > viewportH - padding) y = viewportH - pHeight - padding;
      if (y < headerOffset + padding) y = headerOffset + padding;

      setPosition({ x, y });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isHovering, headerOffset]);

  return (
    <>
      <a
        href={scryfallUrl}
        target="_blank"
        rel="noopener noreferrer"
        ref={containerRef}
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
          ref={previewRef}
          className="fixed pointer-events-none"
          style={{ 
            left: position.x, 
            top: position.y,
            zIndex: 9999,
            willChange: 'transform', 
          }}
        >
          <div className="bg-black/95 rounded-xl p-2 shadow-2xl border border-gray-600 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={card.card_name}
              className="w-[280px] md:w-[320px] h-auto rounded-lg block"
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
