// src/app/components/AccountLinking.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface LinkedIdentity {
  provider: string;
  provider_id: string;
  user_id: string;
  identity_data: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
    username?: string;
  };
  last_sign_in_at: string;
  created_at: string;
}

const AccountLinking: React.FC = () => {
  const { user, loading } = useAuth();
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      // Get linked identities from user metadata
      const userIdentities = user.identities || [];
      setIdentities(userIdentities as LinkedIdentity[]);
    }
  }, [user]);

  const linkDiscordAccount = async () => {
    if (!user) return;

    setLinking(true);
    try {
      console.log("🔗 Linking Discord account...");

      const { error } = await supabase.auth.linkIdentity({
        provider: "discord",
      });

      if (error) {
        console.error("❌ Error linking Discord:", error);
        alert(`Failed to link Discord account: ${error.message}`);
      } else {
        console.log("✅ Discord linking initiated");
        // The user will be redirected to Discord and back
      }
    } catch (err) {
      console.error("❌ Discord linking exception:", err);
      alert("An error occurred while linking Discord account");
    }
    setLinking(false);
  };

  const unlinkAccount = async (provider: string) => {
    if (!user) return;

    // Prevent unlinking if it's the only identity
    if (identities.length <= 1) {
      alert("Cannot unlink the only authentication method");
      return;
    }

    setUnlinking(provider);
    try {
      console.log(`🔓 Unlinking ${provider} account...`);

      const { error } = await supabase.auth.unlinkIdentity({
        provider: provider as any,
      });

      if (error) {
        console.error(`❌ Error unlinking ${provider}:`, error);
        alert(`Failed to unlink ${provider} account: ${error.message}`);
      } else {
        console.log(`✅ ${provider} account unlinked`);
        // Refresh the page to update identities
        window.location.reload();
      }
    } catch (err) {
      console.error(`❌ ${provider} unlinking exception:`, err);
      alert(`An error occurred while unlinking ${provider} account`);
    }
    setUnlinking(null);
  };

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
    return (
      <div className="account-linking-loading">
        Loading account information...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-linking-error">
        Please sign in to manage linked accounts.
      </div>
    );
  }

  const hasDiscord = identities.some((id) => id.provider === "discord");
  const hasEmail = identities.some((id) => id.provider === "email");

  return (
    <div className="account-linking-card">
      <h3 className="account-section-title">🔗 Linked Accounts</h3>
      <p>Manage your authentication methods and link additional accounts.</p>

      <div className="account-linking-section">
        <h4 className="account-linking-subtitle">Current Linked Accounts:</h4>
        {identities.length === 0 ? (
          <p>No linked accounts found.</p>
        ) : (
          <div className="account-identities-list">
            {identities.map((identity, index) => (
              <div key={index} className="account-identity-item">
                <div className="account-identity-info">
                  <span className="account-identity-icon">
                    {getProviderIcon(identity.provider)}
                  </span>
                  <div className="account-identity-details">
                    <strong>{getProviderDisplayName(identity.provider)}</strong>
                    <br />
                    <small className="account-identity-email">
                      {identity.identity_data.email ||
                        identity.identity_data.full_name ||
                        identity.identity_data.username ||
                        "Connected"}
                    </small>
                  </div>
                </div>

                {identities.length > 1 && (
                  <button
                    onClick={() => unlinkAccount(identity.provider)}
                    disabled={unlinking === identity.provider}
                    className="account-unlink-button"
                  >
                    {unlinking === identity.provider
                      ? "Unlinking..."
                      : "Unlink"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="account-linking-section">
        <h4 className="account-linking-subtitle">Available to Link:</h4>
        <div className="account-available-list">
          {!hasDiscord && (
            <div className="account-identity-item">
              <div className="account-identity-info">
                <span className="account-identity-icon">🎮</span>
                <div className="account-identity-details">
                  <strong>Discord</strong>
                  <br />
                  <small className="account-identity-description">
                    Link your Discord account for community features
                  </small>
                </div>
              </div>

              <button
                onClick={linkDiscordAccount}
                disabled={linking}
                className="account-link-button account-link-discord"
              >
                {linking ? "Linking..." : "Link Discord"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="account-linking-info">
        <h5 className="account-info-title">ℹ️ About Account Linking</h5>
        <ul className="account-info-list">
          <li>Link multiple authentication methods to your account</li>
          <li>Access your account using any linked method</li>
          <li>You must keep at least one authentication method linked</li>
          <li>Linking preserves all your data and preferences</li>
        </ul>
      </div>
    </div>
  );
};

export default AccountLinking;
