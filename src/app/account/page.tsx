// src/app/account/page.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { DiscordLogin } from "../components/auth/DiscordLogin";
import AccountLinking from "../components/AccountLinking";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [showLinking, setShowLinking] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const UserProfile = () => (
    <div className="user-profile">
      <div className="profile-header">
        {user?.user_metadata?.avatar_url && (
          <Image
            src={user.user_metadata.avatar_url}
            alt="Discord Avatar"
            className="discord-avatar"
            width={60}
            height={60}
          />
        )}
        <div className="profile-info">
          <h2>
            Welcome,{" "}
            {user?.user_metadata?.full_name ||
              user?.user_metadata?.username ||
              "Dynasty Cube Member"}
            !
          </h2>
          {user?.user_metadata?.username && (
            <p className="discord-tag">
              @{user.user_metadata.username || "Unknown"}
            </p>
          )}
        </div>
      </div>

      <div className="user-details">
        <div className="detail-card">
          <h3>Account Information</h3>
          <p>
            <strong>Discord Username:</strong>{" "}
            {user?.user_metadata?.full_name || user?.user_metadata?.username}
          </p>
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <p>
            <strong>Member since:</strong>{" "}
            {new Date(user?.created_at || "").toLocaleDateString()}
          </p>
          <p>
            <strong>Last sign in:</strong>{" "}
            {new Date(user?.last_sign_in_at || "").toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Account Linking Toggle */}
      <div className="user-details">
        <div className="detail-card">
          <h3>Manage Authentication Methods</h3>
          <p>
            Link additional sign-in methods to your account for easier access.
          </p>
          <button
            onClick={() => setShowLinking(!showLinking)}
            className="link-toggle-btn"
          >
            {showLinking ? "Hide Account Linking" : "Manage Linked Accounts"}
          </button>
        </div>
      </div>

      {/* Account Linking Section */}
      {showLinking && (
        <div className="account-linking-wrapper">
          <AccountLinking />
        </div>
      )}

      <div className="account-actions">
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="account-page">
        <h1>My Account</h1>
        <ProtectedRoute fallback={<DiscordLogin />}>
          <UserProfile />
        </ProtectedRoute>
      </div>
    </Layout>
  );
}
