// src/app/hooks/useIsAdmin.ts
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/supabase-browser";

/**
 * Hook to check if the current user is an admin
 * Fetches from the database to check the is_admin flag
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();

        // Use maybeSingle() instead of single() to avoid error when no row found
        const { data, error } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking admin status:", error.message, error.code, error.details, error.hint);
          setIsAdmin(false);
        } else if (data) {
          setIsAdmin(data.is_admin || false);
        } else {
          // No row found for this user - not an admin
          console.warn("No user row found for id:", user.id);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
}
