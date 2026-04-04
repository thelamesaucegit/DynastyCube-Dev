// src/app/admin/roles/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRoleManager } from "@/components/admin/AdminRoleManager";
import { checkIsAdmin } from "@/app/actions/adminRoleActions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Loader2, ShieldAlert, AlertTriangle, ArrowLeft } from "lucide-react";

export default function AdminRolesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (error || !isAdmin) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              {error || "You do not have permission to access this page."}
            </p>
            <Button variant="destructive" onClick={() => router.push("/")}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => router.push("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Button>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Team Role Management
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage team member roles across all teams
        </p>
      </div>

      {/* Admin Info Banner */}
      <Card className="border-yellow-500/50 mb-6">
        <CardContent className="pt-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold mb-1">Admin Mode</h3>
            <p className="text-sm text-muted-foreground">
              You are managing roles as an administrator. All changes are logged and
              will be visible to team captains. Use this power responsibly.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Role Manager Component */}
      <AdminRoleManager />
    </div>
  );
}
