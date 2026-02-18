// src/app/components/CountdownTimer.tsx
"use client";

import React, { useState, useEffect } from "react";

interface CountdownTimerProps {
  title: string;
  endTime: string;
  linkUrl: string;
  linkText: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeRemaining(endTime: string): TimeRemaining | null {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function DigitBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[56px] text-center border border-white/10">
        <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs mt-1 opacity-80 uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
  );
}

export default function CountdownTimer({
  title,
  endTime,
  linkUrl,
  linkText,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(
    getTimeRemaining(endTime)
  );
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const remaining = getTimeRemaining(endTime);
    if (!remaining) {
      setExpired(true);
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(remaining);
    setExpired(false);

    const interval = setInterval(() => {
      const updated = getTimeRemaining(endTime);
      if (!updated) {
        setExpired(true);
        setTimeRemaining(null);
        clearInterval(interval);
      } else {
        setTimeRemaining(updated);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (expired) {
    return (
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-800 dark:to-emerald-800 text-white rounded-xl p-6 mb-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-3">{title}</h2>
          <p className="text-green-100 mb-4">The wait is over!</p>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-green-700 font-bold px-8 py-3 rounded-lg hover:bg-green-50 transition-colors shadow-md"
          >
            {linkText}
          </a>
        </div>
      </div>
    );
  }

  if (!timeRemaining) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-700 dark:to-orange-700 text-white rounded-xl p-6 mb-8 shadow-lg">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-xl md:text-2xl font-bold mb-4">{title}</h2>
        <div className="flex gap-3 md:gap-4">
          <DigitBox value={timeRemaining.days} label="Days" />
          <div className="flex items-center text-2xl font-bold opacity-60 pb-5">:</div>
          <DigitBox value={timeRemaining.hours} label="Hours" />
          <div className="flex items-center text-2xl font-bold opacity-60 pb-5">:</div>
          <DigitBox value={timeRemaining.minutes} label="Min" />
          <div className="flex items-center text-2xl font-bold opacity-60 pb-5">:</div>
          <DigitBox value={timeRemaining.seconds} label="Sec" />
        </div>
      </div>
    </div>
  );
}
