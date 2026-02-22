// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { AdminRoute } from "../components/admin/AdminRoute";
import { UserManagement } from "../components/admin/UserManagement";
import { TeamManagement } from "../components/admin/TeamManagement";
import { CardManagement } from "../components/admin/CardManagement";
import { CardRatingSync } from "../components/admin/CardRatingSync";
import { CubucksManagement } from "../components/admin/CubucksManagement";
import { SeasonManagement } from "../components/admin/SeasonManagement";
import { TradeSettings } from "../components/admin/TradeSettings";
import { ReportManagement } from "../components/admin/ReportManagement";
import { NewsManagement } from "../components/admin/NewsManagement";
import { VoteManagement } from "../components/admin/VoteManagement";
import { MatchManagement } from "../components/admin/MatchManagement";
import { CountdownTimerManagement } from "../components/admin/CountdownTimerManagement";
import { HistoryRequestManagement } from "../components/admin/HistoryRequestManagement";
import { GlossaryManagement } from "../components/admin/GlossaryManagement";
import { DraftOrderManagement } from "../components/admin/DraftOrderManagement";
import { DraftSessionManagement } from "../components/admin/DraftSessionManagement";
import { EssenceManagement } from "../components/admin/EssenceManagement";
import { DataBackfillManagement } from "../components/admin/DataBackfillManagement"; 
import { backfillColorIdentity } from "@/app/actions/adminActions";
import { getTeamsWithMembers } from "../actions/teamActions";
import { getCardPool } from "../actions/cardActions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Users,
  Trophy,
  Layers,
  Coins,
  CalendarDays,
  Swords,
  BarChart3,
  Megaphone,
  Vote,
  Timer,
  AlertTriangle,
  ScrollText,
  BookOpen,
  Settings,
  Shield,
  Crown,
  Database,
  Plug,
  Lightbulb,
  ArrowRight,
  ListOrdered,
  Sparkles,
  Play,
} from "lucide-react";

type TabType = "users" | "teams" | "cards" | "cubucks" | "essence" | "seasons" | "matches" | "draft-order" | "draft-session" | "ratings" | "news" | "timers" | "reports" | "votes" | "settings" | "history" | "glossary";

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

  const tabItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "users", label: "Users", icon: <Users className="size-4" /> },
    { id: "teams", label: "Teams", icon: <Trophy className="size-4" /> },
    { id: "cards", label: "Cards", icon: <Layers className="size-4" /> },
    { id: "cubucks", label: "Cubucks", icon: <Coins className="size-4" /> },
    { id: "essence", label: "Essence", icon: <Sparkles className="size-4" /> },
    { id: "seasons", label: "Seasons", icon: <CalendarDays className="size-4" /> },
    { id: "matches", label: "Matches", icon: <Swords className="size-4" /> },
    { id: "draft-order", label: "Draft Order", icon: <ListOrdered className="size-4" /> },
    { id: "draft-session", label: "Draft Session", icon: <Play className="size-4" /> },
    { id: "ratings", label: "Ratings", icon: <BarChart3 className="size-4" /> },
    { id: "news", label: "News", icon: <Megaphone className="size-4" /> },
    { id: "votes", label: "Voting", icon: <Vote className="size-4" /> },
    { id: "timers", label: "Timers", icon: <Timer className="size-4" /> },
    { id: "reports", label: "Reports", icon: <AlertTriangle className="size-4" /> },
    { id: "history", label: "History", icon: <ScrollText className="size-4" /> },
    { id: "glossary", label: "Glossary", icon: <BookOpen className="size-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="size-4" /> },
  ];

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: <Users className="size-5 text-muted-foreground" /> },
    { label: "Active Teams", value: stats.activeTeams, icon: <Trophy className="size-5 text-muted-foreground" /> },
    { label: "Card Pool Size", value: stats.cardPoolSize, icon: <Layers className="size-5 text-muted-foreground" /> },
    { label: "Draft Events", value: stats.draftEvents, icon: <Swords className="size-5 text-muted-foreground" /> },
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
      case "essence":
        return <EssenceManagement />;
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
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Swords className="size-5" />
                Match Management
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage team matches, adjust scores, and view match history
              </p>
            </div>
            <MatchManagement />
          </div>
        );
      case "draft-order":
        return <DraftOrderManagement />;
      case "draft-session":
        return <DraftSessionManagement />;
      case "timers":
        return <CountdownTimerManagement />;
      case "reports":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Report Management
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
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
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="size-5" />
                Admin Settings
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure admin panel settings and permissions
              </p>
            </div>
            <div className="space-y-6">
              {/*  Data Backfill Management */}
              <DataBackfillManagement />

              {/* Trade System Settings */}
              <TradeSettings />

              {/* Team Role Management Link */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Crown className="size-5" />
                    Team Role Management
                  </CardTitle>
                  <CardDescription>
                    Manage team member roles across all teams. Assign or remove Captain, Broker,
                    Historian, and Pilot roles for any team member.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <a href="/admin/roles" className="inline-flex items-center gap-2">
                      Manage Team Roles
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="size-5" />
                    Admin Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage who has admin access to this panel. Admin emails are currently configured in:{" "}
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      src/app/utils/adminUtils.ts
                    </code>
                  </p>
                  <div className="bg-accent rounded-lg p-4 flex items-start gap-2">
                    <Lightbulb className="size-4 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>Tip:</strong> For production, move admin emails to environment variables
                      or implement role-based access control in your database.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="size-5" />
                    Database Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    To fully enable admin features, you&apos;ll need to set up database tables:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                    <li>
                      <strong className="text-foreground">team_members</strong> - Link users to teams
                    </li>
                    <li>
                      <strong className="text-foreground">card_pools</strong> - Store MTG cards for drafts
                    </li>
                    <li>
                      <strong className="text-foreground">user_roles</strong> - Manage user permissions
                    </li>
                    <li>
                      <strong className="text-foreground">draft_events</strong> - Track draft events and results
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plug className="size-5" />
                    API Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Some features require additional setup:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                    <li>
                      <strong className="text-foreground">Supabase Admin API</strong> - For user management
                    </li>
                    <li>
                      <strong className="text-foreground">Scryfall API</strong> - Already integrated for card search
                    </li>
                    <li>
                      <strong className="text-foreground">Service Role Key</strong> - Required for admin operations
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminRoute>
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="size-8" />
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-muted-foreground">
            Manage Dynasty Cube users, teams, and card pools
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm font-medium">
                  {stat.label}
                </CardDescription>
                {stat.icon}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabType)}
        >
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab Content */}
          <Card>
            <CardContent className="pt-6">
              {tabItems.map((tab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {activeTab === tab.id && renderTabContent()}
                </TabsContent>
              ))}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AdminRoute>
  );
}
