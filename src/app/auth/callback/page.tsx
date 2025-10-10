"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("Processing auth callback...");

        // Get the session from the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          router.push("/auth/auth-code-error?error=session_error");
          return;
        }

        if (data.session) {
          console.log("✓ Authentication successful!");
          console.log("User:", data.session.user.email);
          router.push("/");
        } else {
          console.log("No session found, checking URL...");
          // Let Supabase handle the URL hash
          await supabase.auth.getUser();
          router.push("/");
        }
      } catch (err) {
        console.error("Auth callback exception:", err);
        router.push("/auth/auth-code-error?error=unknown");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="container">
      <h1>Completing Authentication...</h1>
      <p>Please wait while we finish signing you in.</p>
    </div>
  );
}
