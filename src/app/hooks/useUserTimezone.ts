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
    let isMounted = true;

    if (!user) {
      if (isMounted) {
        setTimezone("UTC");
        setLoading(false);
      }
      return;
    }

    const loadTimezone = async () => {
      if (isMounted) setLoading(true);
      try {
        const result = await getUserTimezone();
        if (isMounted && result?.timezone) {
          setTimezone(result.timezone);
        } else if (isMounted) {
          setTimezone("UTC");
        }
      } catch (error) {
        // Catch ANY error (including Next.js UnrecognizedActionError)
        // and safely default to UTC so the app doesn't crash.
        console.warn("[Timezone Hook] Server Action failed or unavailable. Defaulting to UTC.");
        if (isMounted) setTimezone("UTC");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTimezone();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { timezone, loading };
}
