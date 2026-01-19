// src/app/admin/schedule/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "@/app/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdmin } from "@/utils/adminUtils";
import { WeekCreator } from "@/app/components/admin/WeekCreator";
import { MatchScheduler } from "@/app/components/admin/MatchScheduler";
import { ScheduleOverview } from "@/app/components/admin/ScheduleOverview";
import { getCurrentSeason } from "@/app/actions/seasonActions";

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "create-week" | "schedule-matches">("overview");
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
      <Layout>
        <div className="py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Access Denied
            </h2>
            <p className="text-red-800 dark:text-red-200">
              You must be an administrator to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading schedule management...</p>
        </div>
      </Layout>
    );
  }

  if (!currentSeasonId) {
    return (
      <Layout>
        <div className="py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
              No Active Season
            </h2>
            <p className="text-yellow-800 dark:text-yellow-200">
              Please create a season first before managing the schedule.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProtectedRoute>
        <div className="py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              🗓️ Schedule Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create weekly schedules, schedule matches, and manage deadlines
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                📋 Schedule Overview
              </button>
              <button
                onClick={() => setActiveTab("create-week")}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "create-week"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                ➕ Create Week
              </button>
              <button
                onClick={() => setActiveTab("schedule-matches")}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "schedule-matches"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                🎮 Schedule Matches
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === "overview" && (
                <ScheduleOverview seasonId={currentSeasonId} />
              )}
              {activeTab === "create-week" && (
                <WeekCreator seasonId={currentSeasonId} />
              )}
              {activeTab === "schedule-matches" && (
                <MatchScheduler seasonId={currentSeasonId} />
              )}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </Layout>
  );
}
