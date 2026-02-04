"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import DiscordLogin from "./DiscordLogin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading....</div>
      </div>
    );
  }

  if (!user) {
    return fallback || <DiscordLogin />;
  }

  return <>{children}</>;
};
