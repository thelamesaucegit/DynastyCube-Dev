// src/app/admin/schedule/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/app/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdmin } from "@/utils/adminUtils";
import { WeekCreator } from "@/app/components/admin/WeekCreator";
import { MatchScheduler } from "@/app/components/admin/MatchScheduler";
import { ScheduleOverview } from "@/app/components/admin/ScheduleOverview";
import { getCurrentSeason } from "@/app/actions/seasonActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Loader2, ShieldAlert, AlertTriangle, CalendarDays, Plus, Gamepad2 } from "lucide-react";

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentSeason();
  }, []);

  const loadCurrentSeason = async () => {
    setLoading(true);
    try {
      const { season } = await getCurrentSeason();
      if (season) {
        setCurrentSeasonId(season.id);
      }
    } catch (error) {
      console.error("Error loading current season:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !checkIsAdmin(user)) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You must be an administrator to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading schedule management...</p>
        </div>
      </div>
    );
  }

  if (!currentSeasonId) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2">No Active Season</h2>
            <p className="text-muted-foreground">
              Please create a season first before managing the schedule.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Schedule Management
          </h1>
          <p className="text-lg text-muted-foreground">
            Create weekly schedules, schedule matches, and manage deadlines
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Schedule Overview
            </TabsTrigger>
            <TabsTrigger value="create-week" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Week
            </TabsTrigger>
            <TabsTrigger value="schedule-matches" className="gap-2">
              <Gamepad2 className="h-4 w-4" />
              Schedule Matches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ScheduleOverview seasonId={currentSeasonId} />
          </TabsContent>
          <TabsContent value="create-week">
            <WeekCreator seasonId={currentSeasonId} />
          </TabsContent>
          <TabsContent value="schedule-matches">
            <MatchScheduler seasonId={currentSeasonId} />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
