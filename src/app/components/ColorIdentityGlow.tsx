// src/app/components/ColorIdentityGlow.tsx
import React from 'react';

// Saturated MTG colors for maximum visibility and distinct gradients
const colorMap: Record<string, string> = {
  W: '#F8E7B9', // Vibrant White/Light Gold
  U: '#0E68AB', // Deep MTG Blue
  B: '#3F3F3F', // Dark Grey/Black (Pure black hides the border)
  R: '#D3202A', // Vibrant MTG Red
  G: '#00733E', // Vibrant MTG Green
};

const colorlessColor = '#D2B48C'; // Tan for colorless
const goldColor = '#FFD700';      // Gold for 3+ colors

interface ColorIdentityGlowProps {
  colors: string[] | null | undefined;
  children: React.ReactNode;
  className?: string;
}

export const ColorIdentityGlow: React.FC<ColorIdentityGlowProps> = ({ 
  colors, 
  children, 
  className = '' 
}) => {
  const safeColors = colors || [];
  
  let backgroundStyle: React.CSSProperties = {};

  if (safeColors.length === 0) {
    backgroundStyle = { background: colorlessColor };
  } else if (safeColors.length === 1) {
    backgroundStyle = { background: colorMap[safeColors[0]] || colorlessColor };
  } else if (safeColors.length === 2) {
    const color1 = colorMap[safeColors[0]] || colorlessColor;
    const color2 = colorMap[safeColors[1]] || colorlessColor;
    
    // Using 25% and 75% stops forces the gradient to stay solid on the edges 
    // and only blend right in the middle, making the two colors pop much more!
    backgroundStyle = { 
        background: `linear-gradient(to bottom right, ${color1} 25%, ${color2} 75%)` 
    };
  } else {
    backgroundStyle = { background: goldColor };
  }

  return (
    <div className={`p-1 rounded-lg shadow-md ${className}`} style={backgroundStyle}>
      {children}
    </div>
  );
};
