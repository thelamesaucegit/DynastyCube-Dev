// src/app/components/AccountContent.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';  // ← Add this import
import { useAuth } from '@/hooks/useAuth';

const AccountContent: React.FC = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);

  // Extract user data
  const email = user?.email;
  const userId = user?.id;
  const createdAt = user?.created_at;
  const lastSignIn = user?.last_sign_in_at;
  
  // Discord/OAuth specific data
  const userMetadata = user?.user_metadata;
  const appMetadata = user?.app_metadata;
  
  // Discord specific fields
  const avatar = userMetadata?.avatar_url;
  const discordUsername = userMetadata?.full_name || userMetadata?.preferred_username;
  const discordId = userMetadata?.provider_id;
  const provider = appMetadata?.provider;

  useEffect(() => {
    console.log('Full user object:', user);
    console.log('User metadata:', userMetadata);
    console.log('App metadata:', appMetadata);
    setLoading(false);
  }, [user, userMetadata, appMetadata]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="account-container">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p>Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-container">
      <div className="account-header">
        <div className="account-title-section">
          {avatar && (
            <Image 
              src={avatar} 
              alt="User Avatar" 
              width={60}           // ← Add explicit width
              height={60}          // ← Add explicit height
              className="user-avatar"
              priority             // ← Load immediately since it's above fold
            />
          )}
          <div>
            <h2 className="account-title">
              {discordUsername ? `Welcome, ${discordUsername}!` : 'My Account'}
            </h2>
            {provider && (
              <p className="provider-badge">
                Signed in with {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </p>
            )}
          </div>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>

      {/* User Information Section */}
      <div className="user-info-section">
        <h3 className="section-title">Account Information</h3>
        <div className="account-info">
          {discordUsername && (
            <div className="info-item">
              <label className="info-label">Username</label>
              <p className="info-value">{discordUsername}</p>
            </div>
          )}
          
          <div className="info-item">
            <label className="info-label">Email</label>
            <p className="info-value">{email || 'Not provided'}</p>
          </div>

          {discordId && (
            <div className="info-item">
              <label className="info-label">Discord ID</label>
              <p className="info-value discord-id">{discordId}</p>
            </div>
          )}

          <div className="info-item">
            <label className="info-label">User ID</label>
            <p className="info-value user-id">{userId}</p>
          </div>

          <div className="info-item">
            <label className="info-label">Member Since</label>
            <p className="info-value">
              {createdAt ? new Date(createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Unknown'}
            </p>
          </div>

          <div className="info-item">
            <label className="info-label">Last Sign In</label>
            <p className="info-value">
              {lastSignIn ? new Date(lastSignIn).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'First time signing in'}
            </p>
          </div>
        </div>
      </div>

      {/* Dynasty Cube Stats Section */}
      <div className="stats-section">
        <h3 className="stats-title">Dynasty Cube Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Games Played</p>
            <p className="stat-value">0</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Win Rate</p>
            <p className="stat-value win-rate">0%</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Favorite Team</p>
            <p className="stat-value team-name">Not Selected</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Rank</p>
            <p className="stat-value rank">Unranked</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="actions-section">
        <h4 className="actions-title">Quick Actions</h4>
        <div className="actions-grid">
          <button className="action-button action-button-primary">
            🎲 Join Next Draft
          </button>
          <button className="action-button action-button-secondary">
            📊 View Match History
          </button>
          <button className="action-button action-button-tertiary">
            ⚙️ Account Settings
          </button>
        </div>
      </div>

      {/* Debug Section (remove in production) */}
      <div className="debug-section">
        <details>
          <summary className="debug-toggle">🔧 Debug Info (Click to expand)</summary>
          <div className="debug-content">
            <h4>Raw User Data:</h4>
            <pre className="debug-json">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
};

export default AccountContent;