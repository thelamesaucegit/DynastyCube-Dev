// src/app/vote/page.tsx
"use client";

import React from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

export default function VotePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="hero-section">
          <h1>Loading...</h1>
          <p className="hero-subtitle">Checking authentication status...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="hero-section">
          <h1>Sign In Required</h1>
          <p className="hero-subtitle">
            You must be signed in to access the voting system.
          </p>
          <p>
            Please use the &quot;Sign in with Discord &ldquo; button in the
            navigation menu to continue.
          </p>
          <div style={{ marginTop: "2rem" }}>
            <p>
              <strong>Why sign in?</strong>
            </p>
            <ul
              style={{ textAlign: "left", maxWidth: "400px", margin: "0 auto" }}
            >
              <li>Vote on cube changes and additions</li>
              <li>Participate in league decisions</li>
              <li>Access member-only features</li>
              <li>Track your voting history</li>
            </ul>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="hero-section">
        <h1>Vote</h1>
        <p className="hero-subtitle">
          Welcome to the voting system,{" "}
          {user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0]}
          !
        </p>

        <div style={{ marginTop: "2rem" }}>
          <div
            style={{
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "8px",
              padding: "2rem",
              marginBottom: "2rem",
            }}
          >
            <h3>🗳️ Voting System Coming Soon!</h3>
            <p>
              We're building an exciting voting platform where Dynasty Cube
              members can:
            </p>
            <ul
              style={{
                textAlign: "left",
                maxWidth: "500px",
                margin: "1rem auto",
              }}
            >
              <li>Vote on new cards to add to the cube</li>
              <li>Decide on cards to remove or replace</li>
              <li>Participate in format decisions</li>
              <li>Influence league rules and policies</li>
            </ul>
          </div>

          <div
            style={{
              background: "#e7f3ff",
              border: "1px solid #b3d7ff",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            <h4>🎯 Your Voting Power</h4>
            <p>
              <strong>Signed in as:</strong> {user.email}
            </p>
            <p>
              <strong>Discord Account:</strong>{" "}
              {user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "Connected"}
            </p>
            <p>
              <strong>Status:</strong> Ready to vote when system launches!
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
