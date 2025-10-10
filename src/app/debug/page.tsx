"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

interface DebugInfo {
  currentURL?: string;
  origin?: string;
  expectedCallback?: string;
  supabaseURL?: string;
  expectedDiscordRedirect?: string;
  authError?: string;
  authErrorDetails?: unknown;
  authSuccess?: boolean;
  oauthURL?: string;
  oauthData?: unknown;
  exception?: string;
}

export default function DiscordAuthDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDebugInfo({
      currentURL: window.location.href,
      origin: window.location.origin,
      expectedCallback: `${window.location.origin}/auth/callback`,
      supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      expectedDiscordRedirect: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
    });
  }, []);

  const testDiscordAuth = async () => {
    setLoading(true);
    try {
      console.log("Initiating Discord OAuth...");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      console.log("OAuth response:", { data, error });

      if (error) {
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          authError: error.message,
          authErrorDetails: error,
        }));
      } else {
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          authSuccess: true,
          oauthURL: data?.url,
          oauthData: data,
        }));
      }
    } catch (err) {
      console.error("OAuth exception:", err);
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        exception: String(err),
      }));
    } finally {
      setLoading(false);
    }
  };

  const manualDiscordTest = () => {
    supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="container" style={{ padding: "2rem" }}>
      <h1>Discord Auth Debug</h1>

      <div style={{ marginBottom: "2rem" }}>
        <h3>Current Configuration:</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            overflow: "auto",
            fontSize: "12px",
          }}
        >
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={testDiscordAuth} disabled={loading}>
          {loading
            ? "Getting OAuth URL..."
            : "Get Discord OAuth URL (No Redirect)"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={manualDiscordTest}>
          Test Discord Auth (With Redirect)
        </button>
      </div>

      {debugInfo.oauthURL && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Generated OAuth URL:</h3>
          <textarea
            readOnly
            value={debugInfo.oauthURL}
            style={{ width: "100%", height: "100px", fontSize: "10px" }}
          />
          <br />
          <a
            href={debugInfo.oauthURL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Test this URL in new tab
          </a>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <h3>Expected Discord Redirect URL:</h3>
        <code style={{ background: "#f0f0f0", padding: "0.5rem" }}>
          https://zaaqzthoquixvvelzxlr.supabase.co/auth/v1/callback
        </code>
        <p>👆 This URL must be in your Discord app&#39; OAuth2 redirects</p>
      </div>
    </div>
  );
}
