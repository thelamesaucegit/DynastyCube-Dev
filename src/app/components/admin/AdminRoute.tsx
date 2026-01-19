// src/app/components/admin/AdminRoute.tsx
"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DiscordLogin } from "../auth/DiscordLogin";

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  fallback,
}) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const loading = authLoading || adminLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return fallback || <DiscordLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            You don&apos;t have permission to access the admin panel.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If you believe this is an error, please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
