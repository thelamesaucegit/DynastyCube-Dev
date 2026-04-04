// src/contexts/SettingsContext.tsx

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserArtPreference, updateUserArtPreference } from '@/app/actions/userSettingsActions';

interface SettingsContextType {
  useOldestArt: boolean;
  setUseOldestArt: (value: boolean) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [useOldestArt, setUseOldestArtState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch the user's preference when the app loads
  useEffect(() => {
    async function loadSettings() {
      const { use_oldest_art } = await getUserArtPreference();
      setUseOldestArtState(use_oldest_art);
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  // This function updates the state and the database simultaneously
  const handleSetUseOldestArt = async (value: boolean) => {
    setUseOldestArtState(value); // Update client-side state immediately for responsiveness
    await updateUserArtPreference(value); // Update the database in the background
  };

  const value = {
    useOldestArt,
    setUseOldestArt: handleSetUseOldestArt,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
