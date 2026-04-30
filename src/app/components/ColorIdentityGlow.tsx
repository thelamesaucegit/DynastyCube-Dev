// src/app/components/ColorIdentityGlow.tsx

import React from 'react';

// Define the color mapping
const colorMap: Record<string, string> = {
  W: '#F8F8F0', // White
  U: '#A3D8F5', // Blue
  B: '#C2C2C2', // Black
  R: '#F5A3A3', // Red
  G: '#A3F5B9', // Green
};

const colorlessColor = '#D2B48C'; // Tan for colorless
const goldColor = '#FFD700';     // Gold for 3+ colors

interface ColorIdentityGlowProps {
  colors: string[] | null | undefined;
  children: React.ReactNode;
  className?: string;
}

export const ColorIdentityGlow: React.FC<ColorIdentityGlowProps> = ({ colors, children, className = '' }) => {
  const safeColors = colors || [];
  
  let backgroundStyle: React.CSSProperties = {};

  if (safeColors.length === 0) {
    backgroundStyle = { background: colorlessColor };
  } else if (safeColors.length === 1) {
    backgroundStyle = { background: colorMap[safeColors[0]] || colorlessColor };
  } else if (safeColors.length === 2) {
    const color1 = colorMap[safeColors[0]] || colorlessColor;
    const color2 = colorMap[safeColors[1]] || colorlessColor;
    backgroundStyle = { background: `linear-gradient(to bottom right, ${color1}, ${color2})` };
  } else {
    backgroundStyle = { background: goldColor };
  }

  return (
    <div className={`p-1 rounded-lg shadow-md ${className}`} style={backgroundStyle}>
      {children}
    </div>
  );
};
