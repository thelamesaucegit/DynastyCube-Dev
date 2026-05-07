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
  // Added a prop to handle the Replay Viewer header specifically
  headerOffset?: number;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  children,
  className = "",
  headerOffset = 55, // Default to your Replay Viewer header height
}) => {
  const { useOldestArt } = useSettings();
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const imageUrl = getCardImageUrl(card, useOldestArt);

  // We use useLayoutEffect to calculate position AFTER the preview div is added to the DOM
  // but BEFORE the browser repaints, preventing the "jump" effect.
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

      // --- Horizontal Positioning ---
      // Try placing it to the right first
      let x = rect.right + padding;

      // If it overflows the right edge, try the left side
      if (x + pWidth > viewportW - padding) {
        x = rect.left - pWidth - padding;
      }

      // If it's still too far left (e.g. on mobile or narrow screen), center it
      if (x < padding) {
        x = (viewportW - pWidth) / 2;
      }

      // --- Vertical Positioning ---
      // Align top of preview with top of card
      let y = rect.top;

      // 1. Don't let it go off the bottom
      if (y + pHeight > viewportH - padding) {
        y = viewportH - pHeight - padding;
      }

      // 2. Don't let it hide under the top header (Replay Viewer Header)
      if (y < headerOffset + padding) {
        y = headerOffset + padding;
      }

      setPosition({ x, y });
    };

    // Use a small delay to allow the image inside to potentially layout
    // but the useLayoutEffect usually handles this.
    updatePosition();

    // Re-calculate if the user scrolls the game board or resizes the window
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
        style={{ display: 'inline-block' }} // Ensure the ref hits the actual card boundaries
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
            // High z-index to clear Replay Controls (1500-1600)
            zIndex: 9999,
            // Optimization: hardware acceleration for smoother moving
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
