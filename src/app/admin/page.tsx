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
import { getActiveSeasonNumber } from "@/app/actions/scheduleActions";
import { PvpReplayList } from "@/app/components/admin/PvpReplayList"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Users, Trophy, Layers, Coins, CalendarDays, Swords, 
  Megaphone, Vote, Timer, AlertTriangle, ScrollText, 
  Settings, Shield, Sparkles, Play, Key, ArrowRight, ListOrdered, Crown
} from "lucide-react";

// The 6 Consolidated Tab Types
type TabType = "dashboard" | "teams" | "content" | "seasons" | "draft" | "community";

interface Stats {
  totalUsers: number;
  activeTeams: number;
  cardPoolSize: number;
  activeSeasonNumber: number;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
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
    { id: "draft", label: "Draft & Economy", icon: <Play className="size-4" /> },
    { id: "community", label: "Community Tools", icon: <Megaphone className="size-4" /> },
  ];

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: <Users className="size-5 text-muted-foreground" /> },
    { label: "Active Teams", value: stats.activeTeams, icon: <Trophy className="size-5 text-muted-foreground" /> },
    { label: "Card Pool Size", value: stats.cardPoolSize, icon: <Layers className="size-5 text-muted-foreground" /> },
    { label: "Active Season", value: `Season ${stats.activeSeasonNumber}`, icon: <CalendarDays className="size-5 text-muted-foreground" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": 
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="size-5 text-destructive" />
                <h2 className="text-xl font-semibold">User Reports</h2>
            </div>
            <ReportManagement />
            
            <hr className="border-border my-6" />
            
            <div className="flex items-center gap-2 mb-2">
                <Settings className="size-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Core Settings</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChamberManagement />
                <ResortManagement />
                <div className="lg:col-span-2">
                    <TradeSettings />
                </div>
            </div>
          </div>
        );
        
      case "teams": 
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Users className="size-5" /> User & Player Directory</h2>
              <p className="text-sm text-muted-foreground">Manage system users, view registration metrics, and assign platform privileges.</p>
            </div>
            <UserManagement /> 
            
            <hr className="border-border my-6"/> 
            
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Trophy className="size-5" /> Faction Management</h2>
              <p className="text-sm text-muted-foreground">Review faction details, manage rosters, and assign team affiliations.</p>
            </div>
            <TeamManagement onUpdate={loadStats} />
          </div>
        );
        
      case "content": 
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Layers className="size-5" /> Cube Card Management</h2>
              <p className="text-sm text-muted-foreground">Add new cards to the draft pool, adjust base valuations, and prune pool bloat.</p>
            </div>
            <CardManagement onUpdate={loadStats} /> 
            
            <hr className="border-border my-6"/>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CardRatingSync />
                <GlossaryManagement />
            </div>
            
            <hr className="border-border my-6"/>
            <CypherManagement />
          </div>
        );
        
       case "seasons": 
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><CalendarDays className="size-5" /> Season Timeline</h2>
              <p className="text-sm text-muted-foreground">Initialize new seasons, adjust phase progression boundaries, and trigger playoff transitions.</p>
            </div>
            <SeasonManagement /> 
            
            <hr className="border-border my-6"/>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                   <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Swords className="size-5" /> Sim Match Scheduler</h2>
                   <p className="text-sm text-muted-foreground mb-4">Predictably schedule week-specific simulated Forge matches on the half-hour CT.</p>
                   <SimMatchScheduler activeSeasonNumber={stats.activeSeasonNumber} />
                </div>
                <div className="space-y-6">
                   <div>
                       <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Play className="size-5" /> Match Utilities</h2>
                       <p className="text-sm text-muted-foreground mb-4 font-medium">Quick links to run live game simulations or view uploads.</p>
                       <Card className="mb-4">
                          <CardHeader className="py-4">
                            <CardTitle className="text-md flex items-center gap-2"><Swords className="size-4 text-primary" /> Forge Match Simulator</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <Button asChild size="sm" className="w-full">
                              <a href="/admin/match-runner" className="inline-flex items-center justify-between w-full">
                                <span>Open Match Runner</span>
                                <ArrowRight className="size-4" />
                              </a>
                            </Button>
                          </CardContent>
                       </Card>
                       <Card>
                          <CardHeader className="py-4">
                            <CardTitle className="text-md flex items-center gap-2"><Crown className="size-4 text-yellow-500" /> Team Role Management</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <a href="/admin/roles" className="inline-flex items-center justify-between w-full">
                                <span>Manage Team Roles</span>
                                <ArrowRight className="size-4" />
                              </a>
                            </Button>
                          </CardContent>
                       </Card>
                   </div>
                </div>
            </div>
            
            <hr className="border-border my-6"/>
            <PvpReplayList />
          </div>
        );
        
       case "draft": 
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><ListOrdered className="size-5" /> Draft Order Generation</h2>
                  <p className="text-sm text-muted-foreground mb-4">Calculate reverse-standing lottery seeds or assign manual pick offsets.</p>
                  <DraftOrderManagement />
                </div>
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Play className="size-5" /> Draft Session Control</h2>
                  <p className="text-sm text-muted-foreground mb-4">Schedule active timers, adjust horas per pick, or forcefully pause ongoing draft events.</p>
                  <DraftSessionManagement />
                </div>
            </div>
            
            <hr className="border-border my-6"/>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Coins className="size-5 text-yellow-600" /> Çubucks Financial Ledger</h2>
                  <p className="text-sm text-muted-foreground mb-4">Adjust team coin balances, distribute performance rewards, or fine infractions.</p>
                  <CubucksManagement />
                </div>
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Sparkles className="size-5 text-indigo-500" /> Team Essence Ledger</h2>
                  <p className="text-sm text-muted-foreground mb-4">Distribute celestial Essence crystals utilized by teams to trigger specific meta-abilities.</p>
                  <EssenceManagement />
                </div>
            </div>
          </div>
        );
        
       case "community": 
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Megaphone className="size-5 text-primary" /> News Bulletin Manager</h2>
                  <p className="text-sm text-muted-foreground mb-4">Publish dynamic, system-wide news alerts that display directly on player dashboards.</p>
                  <NewsManagement />
                </div>
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Vote className="size-5 text-indigo-500" /> Voting & Mottos</h2>
                  <p className="text-sm text-muted-foreground mb-4">Approve player-proposed team mottos or schedule league-wide policy referendums.</p>
                  <VoteManagement />
                </div>
            </div>
            
            <hr className="border-border my-6"/>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><Timer className="size-5 text-amber-500" /> Countdown Timers</h2>
                  <p className="text-sm text-muted-foreground mb-4">Create, edit, or terminate the active homepage timers (e.g. offseason clocks).</p>
                  <CountdownTimerManagement />
                </div>
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-1"><ScrollText className="size-5 text-emerald-500" /> History & Archives</h2>
                  <p className="text-sm text-muted-foreground mb-4">Review historical team rosters, draft records, and finalize historical queries.</p>
                  <HistoryRequestManagement />
                </div>
            </div>
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm font-medium">{stat.label}</CardDescription>
                {stat.icon}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto mb-6 gap-1 p-1 bg-muted rounded-xl">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 py-2.5 rounded-lg font-medium text-xs sm:text-sm">
                {tab.icon}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          <Card className="border-border/50 bg-background/50 backdrop-blur-md shadow-xl mt-6">
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
