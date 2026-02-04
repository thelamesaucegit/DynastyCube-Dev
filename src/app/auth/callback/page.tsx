"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState("Processing authentication...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const error = queryParams.get("error");
        const code = queryParams.get("code");

        // Check for OAuth error first
        if (error) {
          setStatus("Authentication failed");
          setErrorMessage(queryParams.get("error_description") || error);
          setTimeout(() => router.push("/auth/auth-code-error?error=" + error), 2000);
          return;
        }

        // Always check for existing session first
        // @supabase/ssr may have already exchanged the code automatically
        setStatus("Verifying session...");
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setStatus("Success! Redirecting...");
          router.push("/");
          return;
        }

        // No session yet - try to exchange code if present
        if (code) {
          setStatus("Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            // Check if session was established despite the error (race condition)
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setStatus("Success! Redirecting...");
              router.push("/");
              return;
            }

            setStatus("Exchange failed");
            setErrorMessage(exchangeError.message);
            setTimeout(() => router.push("/auth/auth-code-error?error=exchange_failed"), 2000);
            return;
          }

          setStatus("Success! Redirecting...");
          router.push("/");
          return;
        }

        // No code and no session
        setStatus("No authentication data found");
        setTimeout(() => router.push("/auth/login"), 2000);
      } catch (err) {
        // Even on error, check if we got a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus("Success! Redirecting...");
          router.push("/");
          return;
        }

        setStatus("Error processing authentication");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setTimeout(() => router.push("/auth/login"), 3000);
      }
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Completing Authentication
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{status}</p>
        {errorMessage && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
