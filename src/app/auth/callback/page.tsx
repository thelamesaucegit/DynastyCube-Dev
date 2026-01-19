"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code from the URL query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("Auth callback error:", error);
            router.push(`/auth/auth-code-error?error=session_error&error_description=${encodeURIComponent(error.message)}`);
            return;
          }

          if (data.session) {
            router.push("/");
            return;
          }
        }

        // Fallback: check for existing session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          router.push("/auth/auth-code-error?error=session_error");
          return;
        }

        if (sessionData.session) {
          router.push("/");
        } else {
          router.push("/auth/login");
        }
      } catch (err) {
        console.error("Auth callback exception:", err);
        router.push("/auth/auth-code-error?error=unknown");
      }
    };

    handleAuthCallback();
  }, [router, supabase]);

  return (
    <div className="container">
      <h1>Completing Authentication...</h1>
      <p>Please wait while we finish signing you in.</p>
    </div>
  );
}
