// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { AdminRoute } from "../components/admin/AdminRoute";
import { UserManagement } from "../components/admin/UserManagement";
import { TeamManagement } from "../components/admin/TeamManagement";
import { CardManagement } from "../components/admin/CardManagement";
import { CardRatingSync } from "../components/admin/CardRatingSync";
import { CubucksManagement } from "../components/admin/CubucksManagement";
import { SeasonManagement } from "../components/admin/SeasonManagement";
import { TradeSettings } from "../components/admin/TradeSettings";
import { ReportManagement } from "../components/admin/ReportManagement";
import { CMCDataManagement } from "../components/admin/CMCDataManagement";
import { NewsManagement } from "../components/admin/NewsManagement";
import { VoteManagement } from "../components/admin/VoteManagement";
import { MatchManagement } from "../components/admin/MatchManagement";
import { CountdownTimerManagement } from "../components/admin/CountdownTimerManagement";
import { HistoryRequestManagement } from "../components/admin/HistoryRequestManagement";
import { GlossaryManagement } from "../components/admin/GlossaryManagement";
import { getTeamsWithMembers } from "../actions/teamActions";
import { getCardPool } from "../actions/cardActions";
import "@/styles/pages/admin.css";

type TabType = "users" | "teams" | "cards" | "cubucks" | "seasons" | "ratings" | "news" | "timers" | "reports" | "votes" | "matches" | "settings" | "history" | "glossary";

interface Stats {
  totalUsers: number;
  activeTeams: number;
  cardPoolSize: number;
  draftEvents: number;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeTeams: 8,
    cardPoolSize: 0,
    draftEvents: 0,
  });

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get teams and count members
      const teams = await getTeamsWithMembers();
      const totalMembers = teams.reduce(
        (sum, team) => sum + (team.members?.length || 0),
        0
      );

      // Get card pool
      const { cards } = await getCardPool();

      setStats({
        totalUsers: totalMembers,
        activeTeams: teams.length,
        cardPoolSize: cards.length,
        draftEvents: 0, // TODO: Implement when draft_events table is created
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const tabs = [
    { id: "users" as TabType, label: "👥 Users", icon: "👥" },
    { id: "teams" as TabType, label: "🏆 Teams", icon: "🏆" },
    { id: "cards" as TabType, label: "🃏 Cards", icon: "🃏" },
    { id: "cubucks" as TabType, label: "💰 Cubucks", icon: "💰" },
    { id: "seasons" as TabType, label: "🗓️ Seasons", icon: "🗓️" },
    { id: "matches" as TabType, label: "⚔️ Matches", icon: "⚔️" },
    { id: "ratings" as TabType, label: "📊 Ratings", icon: "📊" },
    { id: "news" as TabType, label: "📢 News", icon: "📢" },
    { id: "votes" as TabType, label: "🗳️ Voting", icon: "🗳️" },
    { id: "timers" as TabType, label: "⏳ Timers", icon: "⏳" },
    { id: "reports" as TabType, label: "⚠️ Reports", icon: "⚠️" },
    { id: "history" as TabType, label: "📜 History", icon: "📜" },
    { id: "glossary" as TabType, label: "📖 Glossary", icon: "📖" },
    { id: "settings" as TabType, label: "⚙️ Settings", icon: "⚙️" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "users":
        return <UserManagement />;
      case "teams":
        return <TeamManagement onUpdate={loadStats} />;
      case "cards":
        return <CardManagement onUpdate={loadStats} />;
      case "cubucks":
        return <CubucksManagement />;
      case "seasons":
        return <SeasonManagement />;
      case "ratings":
        return <CardRatingSync />;
      case "news":
        return <NewsManagement />;
      case "votes":
        return <VoteManagement />;
      case "matches":
        return (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">⚔️ Match Management</h2>
              <p className="admin-section-description">
                Create and manage team matches, adjust scores, and view match history
              </p>
            </div>
            <MatchManagement />
          </div>
        );
      case "timers":
        return <CountdownTimerManagement />;
      case "reports":
        return (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">⚠️ Report Management</h2>
              <p className="admin-section-description">
                Review and manage user-submitted reports for bad actors, bugs, and issues
              </p>
            </div>
            <ReportManagement />
          </div>
        );
      case "history":
        return <HistoryRequestManagement />;
      case "glossary":
        return <GlossaryManagement />;
      case "settings":
        return (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">⚙️ Admin Settings</h2>
              <p className="admin-section-description">
                Configure admin panel settings and permissions
              </p>
            </div>
            <div className="space-y-6">
              {/* CMC Data Management */}
              <CMCDataManagement />

              {/* Trade System Settings */}
              <TradeSettings />

              {/* Team Role Management Link */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <span className="text-2xl">👑</span>
                      Team Role Management
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Manage team member roles across all teams. Assign or remove Captain, Broker,
                      Historian, and Pilot roles for any team member.
                    </p>
                    <a
                      href="/admin/roles"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                      <span>Manage Team Roles</span>
                      <span>→</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
                  Admin Users
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Manage who has admin access to this panel. Admin emails are currently configured in:{" "}
                  <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                    src/app/utils/adminUtils.ts
                  </code>
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Tip:</strong> For production, move admin emails to environment variables
                    or implement role-based access control in your database.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
                  Database Configuration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  To fully enable admin features, you&apos;ll need to set up database tables:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-disc">
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">team_members</strong> - Link users to teams
                  </li>
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">card_pools</strong> - Store MTG cards for drafts
                  </li>
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">user_roles</strong> - Manage user permissions
                  </li>
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">draft_events</strong> - Track draft events and results
                  </li>
                </ul>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
                  API Integration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Some features require additional setup:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-disc">
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">Supabase Admin API</strong> - For user management
                  </li>
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">Scryfall API</strong> - Already integrated for card search
                  </li>
                  <li>
                    <strong className="text-gray-900 dark:text-gray-100">Service Role Key</strong> - Required for admin operations
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <AdminRoute>
        <div className="admin-page">
          {/* Header */}
          <div className="admin-header">
            <h1>🛠️ Admin Panel</h1>
            <p>Manage Dynasty Cube users, teams, and card pools</p>
          </div>

          {/* Stats Overview */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-label">Total Users</div>
              <div className="admin-stat-value">
                <span className="admin-stat-icon">👥</span>
                <span>{stats.totalUsers}</span>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Active Teams</div>
              <div className="admin-stat-value">
                <span className="admin-stat-icon">🏆</span>
                <span>{stats.activeTeams}</span>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Card Pool Size</div>
              <div className="admin-stat-value">
                <span className="admin-stat-icon">🃏</span>
                <span>{stats.cardPoolSize}</span>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Draft Events</div>
              <div className="admin-stat-value">
                <span className="admin-stat-icon">🎯</span>
                <span>{stats.draftEvents}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="admin-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`admin-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="admin-content">{renderTabContent()}</div>
        </div>
      </AdminRoute>
    </Layout>
  );
}
