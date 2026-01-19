// src/app/admin/roles/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { AdminRoleManager } from "@/components/admin/AdminRoleManager";
import { checkIsAdmin } from "@/app/actions/adminRoleActions";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminRolesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [user, authLoading]);

  const checkAdminStatus = async () => {
    if (authLoading) return;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    try {
      const { isAdmin: adminStatus, error: adminError } = await checkIsAdmin();

      if (adminError) {
        setError(adminError);
        setLoading(false);
        return;
      }

      if (!adminStatus) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    } catch (err) {
      console.error("Error checking admin status:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Verifying permissions...
          </p>
        </div>
      </Layout>
    );
  }

  if (error || !isAdmin) {
    return (
      <Layout>
        <div className="py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Access Denied
            </h2>
            <p className="text-red-800 dark:text-red-200 mb-4">
              {error || "You do not have permission to access this page."}
            </p>
            <button
              onClick={() => router.push("/")}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/admin")}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← Back to Admin
            </button>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Team Role Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage team member roles across all teams
          </p>
        </div>

        {/* Admin Info Banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                Admin Mode
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You are managing roles as an administrator. All changes are logged and
                will be visible to team captains. Use this power responsibly.
              </p>
            </div>
          </div>
        </div>

        {/* Role Manager Component */}
        <AdminRoleManager />
      </div>
    </Layout>
  );
}
