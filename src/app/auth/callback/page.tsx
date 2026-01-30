"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

/**
 * OAuth callback page (PKCE flow).
 * Discord/Google redirect here with ?code=... after login.
 * We do the code exchange in the browser so the PKCE code_verifier
 * (stored in document.cookie when the user clicked Login) is in the same
 * context. Server-side exchange often fails with "Unable to exchange
 * external code" because the code_verifier cookie may not be sent on
 * the redirect request.
 */
export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState("Processing authentication...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasHandledAuth = useRef(false);

  useEffect(() => {
    if (hasHandledAuth.current) return;

    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const code = searchParams.get("code");

    if (errorParam) {
      hasHandledAuth.current = true;
      router.push(
        `/auth/auth-code-error?error=${errorParam}&error_description=${encodeURIComponent(errorDescription || "")}`
      );
      return;
    }

    if (!code) {
      hasHandledAuth.current = true;
      router.push("/auth/login");
      return;
    }

    (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          hasHandledAuth.current = true;
          setErrorMessage(error.message);
          setStatus("Authentication failed.");
          setTimeout(() => router.push("/auth/login"), 4000);
          return;
        }
        hasHandledAuth.current = true;
        setStatus("Success! Redirecting...");
        router.replace("/");
      } catch (err) {
        hasHandledAuth.current = true;
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("Authentication failed.");
        setTimeout(() => router.push("/auth/login"), 4000);
      }
    })();
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
