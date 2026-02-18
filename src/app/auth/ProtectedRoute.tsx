// src/app/components/auth/ProtectedRoute.tsx
"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import DiscordLogin from "@/components/auth/DiscordLogin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return fallback || <DiscordLogin />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
