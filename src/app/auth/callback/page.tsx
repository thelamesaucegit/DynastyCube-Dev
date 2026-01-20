"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    // Check for error in URL (e.g., user denied access)
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      router.push(
        `/auth/auth-code-error?error=${errorParam}&error_description=${encodeURIComponent(errorDescription || "")}`
      );
      return;
    }

    // Listen for auth state changes - createBrowserClient handles the code exchange automatically
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push("/");
      } else if (event === "SIGNED_OUT") {
        router.push("/auth/login");
      }
    });

    // Also check if we already have a session (in case the event already fired)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
      } else {
        // Give Supabase a moment to process the code exchange
        // If no session after a short delay, redirect to login
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            router.push("/");
          } else if (!searchParams.get("code")) {
            // No code and no session - go to login
            router.push("/auth/login");
          }
        }, 2000);
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return (
    <div className="container">
      <h1>Completing Authentication...</h1>
      <p>Please wait while we finish signing you in.</p>
    </div>
  );
}
