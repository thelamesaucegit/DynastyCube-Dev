// src/app/components/AccountLinking.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/supabase-browser";
import type { UserIdentity } from "@supabase/supabase-js";
import "@/styles/components/accountContent.css";

const AccountLinking: React.FC = () => {
  const { user, loading } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  // Fetch identities on mount or when user changes
  useEffect(() => {
    if (!user) return;

    const fetchIdentities = async () => {
      try {
        const { data, error } = await supabase.auth.getUserIdentities();
        if (error) {
          console.error("Failed to fetch identities:", error);
          return;
        }
        setIdentities(data?.identities ?? []);
      } catch (err) {
        console.error("Unexpected error fetching identities:", err);
      }
    };

    fetchIdentities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Link Discord account
  const linkDiscordAccount = async () => {
    if (!user) return;
    setLinking(true);

    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "discord",
      });
      if (error) {
        console.error("Error linking Discord:", error);
        alert(`Failed to link Discord account: ${error.message}`);
      } else {
        console.log("Discord linking initiated.");
      }
    } catch (err) {
      console.error("Exception linking Discord:", err);
      alert("An error occurred while linking Discord.");
    } finally {
      setLinking(false);
    }
  };

  // Link Google account
  const linkGoogleAccount = async () => {
    if (!user) return;
    setLinking(true);

    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
      });
      if (error) {
        console.error("Error linking Google:", error);
        alert(`Failed to link Google account: ${error.message}`);
      } else {
        console.log("Google linking initiated.");
      }
    } catch (err) {
      console.error("Exception linking Google:", err);
      alert("An error occurred while linking Google.");
    } finally {
      setLinking(false);
    }
  };

  // Unlink identity
  const unlinkAccount = async (provider: string) => {
    if (!user) return;

    if (identities.length <= 1) {
      alert("Cannot unlink the only authentication method.");
      return;
    }

    setUnlinking(provider);
    try {
      const { data, error: fetchError } =
        await supabase.auth.getUserIdentities();
      if (fetchError) {
        console.error("Failed to fetch identities:", fetchError);
        return;
      }

      const identity = data?.identities.find((i: UserIdentity) => i.provider === provider);
      if (!identity) {
        alert(`No linked identity found for ${provider}`);
        return;
      }

      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) {
        console.error(`Error unlinking ${provider}:`, error);
        alert(`Failed to unlink ${provider}: ${error.message}`);
      } else {
        console.log(`Successfully unlinked ${provider}`);
        // Refresh list safely
        const { data: refreshed } = await supabase.auth.getUserIdentities();
        setIdentities(refreshed?.identities ?? []);
      }
    } catch (err) {
      console.error(`Exception unlinking ${provider}:`, err);
      alert(`An error occurred while unlinking ${provider}.`);
    } finally {
      setUnlinking(null);
    }
  };

  // Display helpers
  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case "discord":
        return "Discord";
      case "google":
        return "Gmail";
      case "email":
        return "Email";
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "discord":
        return "🎮";
      case "google":
        return "📧";
      case "email":
        return "✉️";
      default:
        return "🔑";
    }
  };

  if (loading) {
    return <div>Loading account information...</div>;
  }

  if (!user) {
    return <div>Please sign in to manage linked accounts.</div>;
  }

  const hasDiscord = identities.some((id) => id.provider === "discord");
  const hasGoogle = identities.some((id) => id.provider === "google");

  return (
    <div className="account-linking-card">
      <h3>🔗 Linked Accounts</h3>
      <p>Manage your authentication methods and link additional accounts.</p>

      <div className="account-linking-section">
        <h4>Current Linked Accounts:</h4>
        {identities.length === 0 ? (
          <p>No linked accounts found.</p>
        ) : (
          identities.map((identity) => (
            <div key={identity.id} className="account-identity-item">
              <div className="account-identity-info">
                <span>{getProviderIcon(identity.provider)}</span>
                <div>
                  <strong>{getProviderDisplayName(identity.provider)}</strong>
                  <br />
                  <small>
                    {identity.identity_data?.email ||
                      identity.identity_data?.full_name ||
                      identity.identity_data?.username ||
                      "Connected"}
                  </small>
                </div>
              </div>

              {identities.length > 1 && (
                <button
                  onClick={() => unlinkAccount(identity.provider)}
                  disabled={unlinking === identity.provider}
                >
                  {unlinking === identity.provider ? "Unlinking..." : "Unlink"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="account-linking-section">
        <h4>Available to Link:</h4>
        {!hasDiscord && (
          <div className="account-identity-item">
            <div className="account-identity-info">
              <span>🎮</span>
              <div>
                <strong>Discord</strong>
                <br />
                <small>Link your Discord account for community features</small>
              </div>
            </div>

            <button onClick={linkDiscordAccount} disabled={linking}>
              {linking ? "Linking..." : "Link Discord"}
            </button>
          </div>
        )}

        {!hasGoogle && (
          <div className="account-identity-item">
            <div className="account-identity-info">
              <span>📧</span>
              <div>
                <strong>Google</strong>
                <br />
                <small>Link your Google account for additional login options</small>
              </div>
            </div>

            <button onClick={linkGoogleAccount} disabled={linking}>
              {linking ? "Linking..." : "Link Google"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountLinking;
