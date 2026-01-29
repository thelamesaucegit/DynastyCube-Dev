"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

/**
 * OAuth callback page (PKCE flow).
 * Discord/Google redirect here with ?code=... after login.
 * We explicitly exchange the code for a session in the browser so the session
 * is stored in cookies and the user is logged in.
 */
export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState("Processing authentication...");
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
          console.error("Auth callback exchangeCodeForSession error:", error);
          hasHandledAuth.current = true;
          setStatus("Something went wrong. Redirecting to login...");
          setTimeout(() => router.push("/auth/login"), 2000);
          return;
        }
        hasHandledAuth.current = true;
        setStatus("Success! Redirecting...");
        router.push("/");
      } catch (err) {
        console.error("Auth callback error:", err);
        hasHandledAuth.current = true;
        setStatus("Something went wrong. Redirecting to login...");
        setTimeout(() => router.push("/auth/login"), 2000);
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
      </div>
    </div>
  );
}
