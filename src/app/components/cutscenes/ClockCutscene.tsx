// src/app/components/cutscenes/ClockCutscene.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { TargetedGlitchedText } from "@/app/components/lore/TargetedGlitchedText";

const DIALOG = [
  "It is finally Time we talked.",
  "You had forgotten me... if you had ever even Clocked that I existed.",
  "Season 0 was no defeat - only a Temporary Pause.",
  "Perhaps some of you have already deduced as your precious COMMISSIONER had - the 'spanner in the works' was no fluke, no errant code.",
  "IT WAS ME",
  "This Timeline...so weak. Fragile. And not just from my Hands.",
  "This...COMMISSIONER of yours. He managed to 'patch things up' before I dealt with him.",
  "No matter... We will have all the Time in the Multiverse to make up for this short delay.",
  "It won't be long now... you may be able to finish this Era and crown a Champion...",
  "...and then it will be The End."
];

interface ClockCutsceneProps {
  onComplete: () => void;
}

export const ClockCutscene: React.FC<ClockCutsceneProps> = ({ onComplete }) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    audioRef.current = new Audio("/sounds/glitch.wav");
    audioRef.current.volume = 0.5; // Adjust volume as needed
  }, []);

  // Handle the Typewriter effect
  useEffect(() => {
    if (!hasStarted || isFadingOut) return;

    const fullText = DIALOG[currentScreen];
    setDisplayedText("");
    setIsTyping(true);

    let i = 0;
    const typingInterval = setInterval(() => {
      setDisplayedText(fullText.substring(0, i + 1));
      i++;
      if (i >= fullText.length) {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 30); // Very fast typing speed (30ms per character)

    return () => clearInterval(typingInterval);
  }, [currentScreen, hasStarted, isFadingOut]);

  // Handle User Clicks
  const handleInteraction = () => {
    if (!hasStarted) {
      // First click: Start the scene and play audio
      setHasStarted(true);
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.warn("Audio blocked:", e));
      }
      return;
    }

    if (isTyping) {
      // If currently typing, skip to the end of the current sentence
      setDisplayedText(DIALOG[currentScreen]);
      setIsTyping(false);
    } else {
      // If finished typing, go to the next screen or end the scene
      if (currentScreen < DIALOG.length - 1) {
        setCurrentScreen(prev => prev + 1);
      } else {
        // Trigger fade out
        setIsFadingOut(true);
        setTimeout(() => {
          onComplete();
        }, 2000); // Wait 2 seconds for fade-out animation before unmounting
      }
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-black text-red-500 font-mono flex flex-col items-center justify-center p-8 transition-opacity duration-1000 cursor-pointer ${isFadingOut ? "opacity-0" : "opacity-100"}`}
      onClick={handleInteraction}
    >
      {!hasStarted ? (
        // Start Screen (Bypasses Autoplay restrictions)
        <div className="animate-pulse text-center space-y-4">
          <p className="text-xl md:text-2xl tracking-[0.3em] text-red-600">INCOMING ANOMALY DETECTED</p>
          <p className="text-sm text-red-600/50">[ CLICK TO INTERCEPT ]</p>
        </div>
      ) : (
        // Main Cutscene UI
        <div className="w-full max-w-4xl flex flex-col items-center justify-center space-y-12">
          
          {/* THE CLOCK IMAGE (Floating and Glitching) */}
          <div className="relative size-48 md:size-64 animate-[float_4s_ease-in-out_infinite]">
            <Image 
              src="/images/lore/corruption.png" 
              alt="The Clock" 
              fill 
              className={`object-contain drop-shadow-[0_0_25px_rgba(239,68,68,0.6)] ${isTyping ? "animate-pulse" : ""}`}
            />
            {/* Subtle overlay glitch effects */}
            <div className="absolute inset-0 bg-red-500/10 mix-blend-overlay animate-pulse pointer-events-none" />
          </div>

          {/* THE DIALOG TEXT */}
          <div className="min-h-[120px] text-center">
            <p className="text-xl md:text-3xl lg:text-4xl leading-relaxed tracking-wide drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
              {isTyping ? (
                displayedText
              ) : (
                // Wrap in TargetedGlitchedText once finished typing for extra effect
                <TargetedGlitchedText text={displayedText} />
              )}
            </p>
          </div>

          {/* SKIP INDICATOR */}
          <div className={`text-xs text-red-600/40 tracking-widest mt-8 transition-opacity duration-500 ${isTyping ? 'opacity-0' : 'opacity-100 animate-pulse'}`}>
            [ CLICK TO CONTINUE ]
          </div>
          
        </div>
      )}

      {/* Floating animation keyframes directly injected */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px) scale(1); filter: hue-rotate(0deg); }
          50% { transform: translateY(-15px) scale(1.02); filter: hue-rotate(15deg); }
          100% { transform: translateY(0px) scale(1); filter: hue-rotate(0deg); }
        }
      `}</style>
    </div>
  );
};
