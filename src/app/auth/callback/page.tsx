"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState("Processing authentication...");
  const hasHandledAuth = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent multiple executions
    if (hasHandledAuth.current) return;

    // Check for error in URL (e.g., user denied access)
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      hasHandledAuth.current = true;
      router.push(
        `/auth/auth-code-error?error=${errorParam}&error_description=${encodeURIComponent(errorDescription || "")}`
      );
      return;
    }

    const code = searchParams.get("code");

    // If no code in URL, redirect to login
    if (!code) {
      hasHandledAuth.current = true;
      router.push("/auth/login");
      return;
    }

    // Listen for auth state changes - Supabase handles the code exchange automatically
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (hasHandledAuth.current) return;

      if (event === "SIGNED_IN" && session) {
        hasHandledAuth.current = true;
        setStatus("Success! Redirecting...");
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        router.push("/");
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Token was refreshed, user is authenticated
        hasHandledAuth.current = true;
        setStatus("Success! Redirecting...");
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        router.push("/");
      }
    });

    // Set a single timeout to check session after giving Supabase time to process
    // This is a fallback in case the auth state change event doesn't fire
    timeoutRef.current = setTimeout(async () => {
      if (hasHandledAuth.current) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !hasHandledAuth.current) {
          hasHandledAuth.current = true;
          router.push("/");
        } else if (!hasHandledAuth.current) {
          // Still no session after timeout - something went wrong
          setStatus("Authentication is taking longer than expected. Please try again.");
          // Wait a bit more before redirecting to login
          setTimeout(() => {
            if (!hasHandledAuth.current) {
              hasHandledAuth.current = true;
              router.push("/auth/login");
            }
          }, 3000);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        if (!hasHandledAuth.current) {
          setStatus("An error occurred. Redirecting to login...");
          setTimeout(() => {
            hasHandledAuth.current = true;
            router.push("/auth/login");
          }, 2000);
        }
      }
    }, 3000); // Wait 3 seconds before checking session manually

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Completing Authentication
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{status}</p>
      </div>
    </div>
  );
}
