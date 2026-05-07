// src/app/hooks/useUserTimezone.ts
"use client";

import { useState, useEffect } from "react";
import { getUserTimezone } from "@/app/actions/userSettingsActions";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Custom hook to get the current user's timezone preference
 * Returns "UTC" as default if not set or user is not authenticated
 */
export function useUserTimezone() {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState<string>("UTC");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no user, or if we are in a state where we shouldn't fetch, 
    // default to UTC and stop.
    if (!user) {
      setTimezone("UTC");
      setLoading(false);
      return;
    }

    const loadTimezone = async () => {
      try {
        const result = await getUserTimezone();
        // Check if result exists (to handle "not found" server actions gracefully)
        if (result && result.timezone) {
          setTimezone(result.timezone);
        }
      } catch (error) {
        // If the server action is missing (404), this catch block handles it
        console.warn("User timezone action unavailable, defaulting to UTC.");
        setTimezone("UTC");
      } finally {
        setLoading(false);
      }
    };

    loadTimezone();
  }, [user]);

  return { timezone, loading };
}
