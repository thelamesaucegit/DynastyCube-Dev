// src/app/components/CardPreview.tsx
"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
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
  style?: React.CSSProperties; // <-- ADD THIS PROP
  headerOffset?: number;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
  style = {}, // <-- ADD DEFAULT
  headerOffset = 55,
}) => {
  const { useOldestArt } = useSettings();
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const imageUrl = getCardImageUrl(card, useOldestArt);

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
      if (x + pWidth > viewportW - padding) {
        x = rect.left - pWidth - padding;
      }
      if (x < padding) {
        x = (viewportW - pWidth) / 2;
      }

      let y = rect.top;
      if (y + pHeight > viewportH - padding) {
        y = viewportH - pHeight - padding;
      }
      if (y < headerOffset + padding) {
        y = headerOffset + padding;
      }
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
      <div
        ref={containerRef}
        className={className}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        // Combine the passed style with the inline-block fix
        style={{ display: 'inline-block', ...style }} 
      >
        {children}
      </div>
      
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
