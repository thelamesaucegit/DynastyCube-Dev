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
    if (!user) {
      setTimezone("UTC");
      setLoading(false);
      return;
    }

    const loadTimezone = async () => {
      setLoading(true);
      try {
        const { timezone: userTz } = await getUserTimezone();
        setTimezone(userTz || "UTC");
      } catch (error) {
        console.error("Error loading user timezone:", error);
        setTimezone("UTC");
      } finally {
        setLoading(false);
      }
    };

    loadTimezone();
  }, [user]);

  return { timezone, loading };
}
