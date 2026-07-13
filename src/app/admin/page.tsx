// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { AdminRoute } from "../components/admin/AdminRoute";
import { UserManagement } from "../components/admin/UserManagement";
import { TeamManagement } from "../components/admin/TeamManagement";
import { CardManagement } from "../components/admin/CardManagement";
import { CubucksManagement } from "../components/admin/CubucksManagement";
import { SeasonManagement } from "../components/admin/SeasonManagement";
import { ChamberManagement } from "@/app/components/admin/ChamberManagement";
import { ResortManagement } from "@/app/components/admin/ResortManagement";
import { TradeSettings } from "../components/admin/TradeSettings";
import { CardRatingSync } from "../components/admin/CardRatingSync";
import { ReportManagement } from "../components/admin/ReportManagement";
import { NewsManagement } from "../components/admin/NewsManagement";
import { VoteManagement } from "../components/admin/VoteManagement";
import { CountdownTimerManagement } from "../components/admin/CountdownTimerManagement";
import { HistoryRequestManagement } from "../components/admin/HistoryRequestManagement";
import { GlossaryManagement } from "../components/admin/GlossaryManagement";
import { DraftOrderManagement } from "../components/admin/DraftOrderManagement";
import { DraftSessionManagement } from "../components/admin/DraftSessionManagement";
import { EssenceManagement } from "../components/admin/EssenceManagement";
import { CypherManagement } from "@/app/components/admin/CypherManagement"; 
import { getTeamsWithMembers } from "../actions/teamActions";
import { getCardPool } from "../actions/cardActions";
import { SimMatchScheduler } from "@/app/components/admin/SimMatchScheduler";
import { getAllSeasons, getActiveSeasonNumber } from "@/app/actions/scheduleActions";
import { PvpReplayList } from "@/app/components/admin/PvpReplayList"; 


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Users, Trophy, Layers, Coins, CalendarRange, CalendarDays, Swords, 
  BarChart3, Megaphone, Vote, Timer, AlertTriangle, ScrollText, BookOpen, 
  Settings, Shield, Crown, Database, Plug, Lightbulb, ArrowRight, ListOrdered, 
  Sparkles, Play, Key
} from "lucide-react";

type TabType = "dashboard" | "teams" | "content" | "seasons" | "draft" | "community";

interface Stats {
  totalUsers: number;
  activeTeams: number;
  cardPoolSize: number;
  draftEvents: number;
  activeSeasonNumber: number;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeTeams: 8,
    cardPoolSize: 0,
    activeSeasonNumber: 1,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [teams, { cards }, activeSeasonNumber] = await Promise.all([
        getTeamsWithMembers(),
        getCardPool(),
        getActiveSeasonNumber(),
      ]);
      const totalMembers = teams.reduce((sum, team) => sum + (team.members?.length || 0), 0);
      setStats({
        totalUsers: totalMembers,
        activeTeams: teams.length,
        cardPoolSize: cards.length,
        draftEvents: 0,
        activeSeasonNumber: activeSeasonNumber ?? 1,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const tabItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <Shield className="size-4" /> },
    { id: "teams", label: "Teams & Users", icon: <Users className="size-4" /> },
    { id: "content", label: "Content Mgmt", icon: <Layers className="size-4" /> },
    { id: "seasons", label: "Seasons & Matches", icon: <CalendarDays className="size-4" /> },
    { id: "draft", label: "Draft Mgmt", icon: <Play className="size-4" /> },
    { id: "community", label: "Community Tools", icon: <Megaphone className="size-4" /> },
  ];
  
  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: <Users className="size-5 text-muted-foreground" /> },
    { label: "Active Teams", value: stats.activeTeams, icon: <Trophy className="size-5 text-muted-foreground" /> },
    { label: "Card Pool Size", value: stats.cardPoolSize, icon: <Layers className="size-5 text-muted-foreground" /> },
    { label: "Draft Events", value: stats.draftEvents, icon: <Swords className="size-5 text-muted-foreground" /> },
  ];

const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Admin Settings & Reports</h2>
            <ReportManagement />
            <ChamberManagement />
            <ResortManagement />
            <TradeSettings />
        </div>
      );
      case "teams": return (
        <div className="space-y-8">
            <UserManagement /> <hr/> <TeamManagement onUpdate={loadStats} />
        </div>
      );
      case "content": return (
        <div className="space-y-8">
            <h2 className="text-xl font-semibold">Card & Content Management</h2>
            <CardManagement onUpdate={loadStats} /> <hr/>
            <CardRatingSync /> <hr/>
            <GlossaryManagement /> <hr/>
            <CypherManagement />
        </div>
      );
       case "seasons": return (
        <div className="space-y-8">
            <h2 className="text-xl font-semibold">Season & Schedule Management</h2>
            <SeasonManagement /> <hr/>
            <SimMatchScheduler activeSeasonNumber={stats.activeSeasonNumber} /> <hr/>
            <PvpReplayList />
        </div>
       );
       case "draft": return (
        <div className="space-y-8">
            <h2 className="text-xl font-semibold">Draft Configuration</h2>
            <DraftOrderManagement /> <hr/>
            <DraftSessionManagement /> <hr/>
            <CubucksManagement /> <hr/>
            <EssenceManagement />
        </div>
       );
       case "community": return (
        <div className="space-y-8">
            <h2 className="text-xl font-semibold">Community Engagement Tools</h2>
            <NewsManagement /> <hr/>
            <VoteManagement /> <hr/>
            <CountdownTimerManagement />
        </div>
       );
      default: return null;
    }
  };


 return (
    <AdminRoute>
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="size-8" />
                    <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
                </div>
                <p className="text-muted-foreground">Manage Dynasty Cube users, teams, and card pools</p>
            </div>
            
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
                <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto mb-6">
                    {tabItems.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 py-2.5">
                        {tab.icon}
                        <span>{tab.label}</span>
                    </TabsTrigger>
                    ))}
                </TabsList>
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
