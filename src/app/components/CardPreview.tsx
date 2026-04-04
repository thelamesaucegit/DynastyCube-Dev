// src/app/components/CardPreview.tsx

"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Use the utility function to get the correct image URL
  const imageUrl = getCardImageUrl(card, useOldestArt);

  useEffect(() => {
    if (!isHovering || !containerRef.current) return;
    const updatePosition = () => {
      if (!containerRef.current || !previewRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const previewWidth = 300;
      const previewHeight = 420;
      const padding = 16;

      let x = rect.right + padding;
      let y = rect.top;

      if (x + previewWidth > window.innerWidth - padding) {
        x = rect.left - previewWidth - padding;
      }
      if (x < padding) {
        x = Math.max(padding, (rect.left + rect.right) / 2 - previewWidth / 2);
      }
      if (y + previewHeight > window.innerHeight - padding) {
        y = window.innerHeight - previewHeight - padding;
      }
      if (y < padding) {
        y = padding;
      }

      setPosition({ x, y });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isHovering]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {children}
      </div>
      
      {isHovering && imageUrl && (
        <div
          ref={previewRef}
          className="fixed z-50 pointer-events-none"
          style={{ left: position.x, top: position.y }}
        >
          <div className="bg-black/90 rounded-xl p-2 shadow-2xl border border-gray-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={card.card_name}
              className="w-[300px] h-auto rounded-lg"
              style={{ maxHeight: "420px", objectFit: "contain" }}
            />
            <div className="text-center text-white text-sm font-semibold mt-2 px-2 truncate">
              {card.card_name}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
