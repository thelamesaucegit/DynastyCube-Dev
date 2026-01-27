// src/app/components/CardPreview.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";

interface CardPreviewProps {
  imageUrl: string;
  cardName: string;
  children: React.ReactNode;
  className?: string;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  imageUrl,
  cardName,
  children,
  className = "",
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHovering || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current || !previewRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const previewWidth = 300;
      const previewHeight = 420;
      const padding = 16;

      // Default: show to the right of the card
      let x = rect.right + padding;
      let y = rect.top;

      // If preview would go off the right edge, show on the left
      if (x + previewWidth > window.innerWidth - padding) {
        x = rect.left - previewWidth - padding;
      }

      // If preview would go off the left edge too, center it above/below
      if (x < padding) {
        x = Math.max(padding, (rect.left + rect.right) / 2 - previewWidth / 2);
      }

      // If preview would go off the bottom, adjust upward
      if (y + previewHeight > window.innerHeight - padding) {
        y = window.innerHeight - previewHeight - padding;
      }

      // If preview would go off the top, adjust downward
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

      {/* Preview Portal */}
      {isHovering && imageUrl && (
        <div
          ref={previewRef}
          className="fixed z-50 pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          <div className="bg-black/90 rounded-xl p-2 shadow-2xl border border-gray-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={cardName}
              className="w-[300px] h-auto rounded-lg"
              style={{ maxHeight: "420px", objectFit: "contain" }}
            />
            <div className="text-center text-white text-sm font-semibold mt-2 px-2 truncate">
              {cardName}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
