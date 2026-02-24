// src/app/teams/[teamId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsWithMembers } from "@/app/actions/teamActions";
import { getTeamDraftPicks, getTeamDecks } from "@/app/actions/draftActions";
import { refundDraftPick } from "@/app/actions/cubucksActions";
import { DraftInterface } from "@/app/components/DraftInterface";
import { DeckBuilder } from "@/app/components/DeckBuilder";
import { CardPreview } from "@/app/components/CardPreview";
import { TeamStats } from "@/app/components/TeamStats";
import { TeamRoles } from "@/app/components/TeamRoles";
import { TeamCubucksDisplay } from "@/app/components/TeamCubucksDisplay";
import { MatchRecording } from "@/app/components/MatchRecording";
import { MatchSchedulingWidget } from "@/app/components/team/MatchSchedulingWidget";
import { TeamVoting } from "@/app/components/team/TeamVoting";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import { DraftQueueManager } from "@/app/components/DraftQueueManager";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions";
import { getCurrentUserRolesForTeam, getTeamMembersWithRoles, type TeamMemberWithRoles } from "@/app/actions/roleActions";
import { getRoleEmoji, getRoleDisplayName } from "@/app/utils/roleUtils";
import type { DraftPick, Deck } from "@/app/actions/draftActions";
import Link from "next/link";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Target,
  Layers,
  BookOpen,
  ArrowLeftRight,
  Swords,
  BarChart3,
  Crown,
  Users,
  Loader2,
  AlertCircle,
  ExternalLink,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Vote,
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  user_display_name?: string;
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members?: TeamMember[];
}

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

type TabType = "picks" | "decks" | "members" | "draft" | "stats" | "roles" | "trades" | "matches" | "votes";

export default function TeamPage({ params }: TeamPageProps) {
  const { teamId } = use(params);
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [membersWithRoles, setMembersWithRoles] = useState<TeamMemberWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("picks");
  const [undrafting, setUndrafting] = useState<string | null>(null);
  const [undraftMessage, setUndraftMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cubucksRefreshKey, setCubucksRefreshKey] = useState(0);
    const [seasonPhase, setSeasonPhase] = useState<string | null>(null);

  const isFreeAgencyActive = seasonPhase === 'season';

  // Check if current user is a member of this team
  const isUserTeamMember = team?.members?.some(
    (member) => member.user_id === user?.id
  ) || userRoles.length > 0;

  useEffect(() => {
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      // Load team info
      const teams = await getTeamsWithMembers();
      const foundTeam = teams.find((t) => t.id === teamId);
      setTeam(foundTeam || null);

      // Load draft picks
      const { picks } = await getTeamDraftPicks(teamId);
      setDraftPicks(picks);

      // Load decks
      const { decks: teamDecks } = await getTeamDecks(teamId);
      setDecks(teamDecks);

      // Load user's roles for this team
      console.log("[TeamPage] Fetching roles for team:", teamId);
      const { roles, error: rolesError } = await getCurrentUserRolesForTeam(teamId);
      console.log("[TeamPage] Roles returned:", roles);
      console.log("[TeamPage] Roles error:", rolesError);
      setUserRoles(roles);

      // Load all members with their roles
      const { members: allMembersWithRoles } = await getTeamMembersWithRoles(teamId);
      setMembersWithRoles(allMembersWithRoles);
      const { season, error: seasonError } = await getCurrentSeason();
      if (seasonError) {
          console.error("Could not fetch season status:", seasonError);
      }
          // Set the phase from the returned season object
      setSeasonPhase(season?.phase || null);
    } catch (error) {
      console.error("Error loading team data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="size-10 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading team...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="size-10 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              Team Not Found
            </h2>
            <p className="text-muted-foreground">
              The team &quot;{teamId}&quot; does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDraftComplete = async () => {
    // Reload draft picks when a card is drafted
    const { picks } = await getTeamDraftPicks(teamId);
    setDraftPicks(picks);
    // Refresh the cubucks display
    setCubucksRefreshKey((prev) => prev + 1);
  };

  const handleUndraftCard = async (pick: DraftPick) => {
    if (!pick.id || undrafting) return;

    const confirmed = window.confirm(
      `Are you sure you want to undraft "${pick.card_name}"? The cubucks spent will be refunded to the team.`
    );
    if (!confirmed) return;

    setUndrafting(pick.id);
    setUndraftMessage(null);

    const result = await refundDraftPick(
      teamId,
      pick.id,
      pick.card_id,
      pick.card_name
    );

    if (result.success) {
      setUndraftMessage({
        type: "success",
        text: `Undrafted ${pick.card_name}! Refunded ${result.refundAmount} Cubucks.`,
      });
      // Reload draft picks
      const { picks } = await getTeamDraftPicks(teamId);
      setDraftPicks(picks);
      // Refresh the cubucks display
      setCubucksRefreshKey((prev) => prev + 1);
    } else {
      setUndraftMessage({
        type: "error",
        text: result.error || "Failed to undraft card",
      });
    }

    setUndrafting(null);
    setTimeout(() => setUndraftMessage(null), 5000);
  };
  const isDraftingEnabled = seasonPhase === 'season';

 const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number, disabled?: boolean }[] = [
    // Conditionally add the Draft tab and control its state
    ...(isUserTeamMember ? [{
      id: "draft" as TabType,
      label: "Draft & Free Agency",
      icon: <Target className="size-4" />,
      count: undefined,
      disabled: false 
    }] : []),
    { id: "picks" as TabType, label: "Draft Picks", icon: <Layers className="size-4" />, count: draftPicks.length },
    { id: "decks" as TabType, label: "Decks", icon: <BookOpen className="size-4" />, count: decks.length },
    { id: "trades" as TabType, label: "Trades", icon: <ArrowLeftRight className="size-4" />, count: undefined },
    { id: "matches" as TabType, label: "Matches", icon: <Swords className="size-4" />, count: undefined },
    // Only show Votes tab to team members
    ...(isUserTeamMember ? [{ id: "votes" as TabType, label: "Votes", icon: <Vote className="size-4" />, count: undefined }] : []),
    { id: "stats" as TabType, label: "Statistics", icon: <BarChart3 className="size-4" />, count: undefined },
    // Only show roles tab to team members
    ...(isUserTeamMember ? [{ id: "roles" as TabType, label: "Team Roles", icon: <Crown className="size-4" />, count: undefined }] : []),
    { id: "members" as TabType, label: "Members", icon: <Users className="size-4" />, count: team.members?.length || 0 },
  ];
  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Team Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <span className="text-7xl">{team.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-1">
                    {team.name}
                  </h1>
                  <p className="text-lg text-muted-foreground italic">
                    &quot;{team.motto}&quot;
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/teams/${teamId}/trades`} className="shrink-0">
                    <ArrowLeftRight className="size-4 mr-2" />
                    View Trades
                  </Link>
                </Button>
              </div>
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{draftPicks.length}</strong> cards
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span>
                  <strong className="text-foreground">{decks.length}</strong> decks
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span>
                  <strong className="text-foreground">{team.members?.length || 0}</strong> members
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft Status */}
      <DraftStatusWidget variant="team" teamId={teamId} />

      {/* Team Cubucks Balance */}
      <div className="mb-6">
        <TeamCubucksDisplay teamId={teamId} showTransactions={true} refreshKey={cubucksRefreshKey} isUserTeamMember={isUserTeamMember} />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
      >
        <TabsList className="flex-wrap h-auto gap-1 mb-6">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content */}
        <Card>
          <CardContent className="pt-6">
             <TabsContent value="draft">
              {activeTab === "draft" && isUserTeamMember && (
                <div className="space-y-8">
                  {/* SECTION 1: DRAFT QUEUE (Always Visible) */}
                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                        Draft Priority Queue
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Set your team&apos;s desired draft picks before the draft begins.
                      </p>
                    </div>
                    <DraftQueueManager teamId={teamId} isUserTeamMember={isUserTeamMember} />
                  </div>

                  {/* SECTION 2: FREE AGENCY POOL (Always Visible) */}
                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                        Free Agent Pool
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Browse cards available for acquisition. Acquiring free agents is only enabled during the active season.
                      </p>
                    </div>
                    
                    {/* --- KEY CHANGE: Pass the status down as a prop --- */}
                    <DraftInterface
                      teamId={teamId}
                      teamName={team.name}
                      isUserTeamMember={isUserTeamMember}
                      onDraftComplete={handleDraftComplete}
                      isFreeAgencyEnabled={isFreeAgencyActive} 
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="picks">
              {activeTab === "picks" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Layers className="size-5" />
                      Draft Picks
                    </h2>
                  </div>

                  {/* Success/Error Messages */}
                  {undraftMessage && (
                    <div
                      className={`mb-4 p-4 rounded-lg border flex items-center gap-2 ${
                        undraftMessage.type === "success"
                          ? "bg-accent text-foreground"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {undraftMessage.type === "success" ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <XCircle className="size-4 shrink-0" />
                      )}
                      {undraftMessage.text}
                    </div>
                  )}

                  {draftPicks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Layers className="size-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg mb-1">No cards drafted yet</p>
                      <p className="text-sm">
                        {isUserTeamMember
                          ? "Your team hasn&apos;t selected any cards from the pool"
                          : `${team.name} hasn&apos;t selected any cards from the pool`}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {draftPicks.map((pick) => {
                        const isUndrafting = undrafting === pick.id;
                        return (
                          <CardPreview
                            key={pick.id}
                            imageUrl={pick.image_url || ""}
                            cardName={pick.card_name}
                          >
                            <div
                              className="group relative bg-muted rounded-lg overflow-hidden border hover:border-primary/50 transition-all hover:shadow-md"
                            >
                              {pick.image_url && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={pick.image_url}
                                  alt={pick.card_name}
                                  className="w-full h-64 object-cover"
                                />
                              )}
                              <div className="p-2">
                                <h4 className="font-semibold text-sm truncate">
                                  {pick.card_name}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                  {pick.card_set}
                                </p>
                                {pick.cubecobra_elo != null && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                                    ELO: {pick.cubecobra_elo.toLocaleString()}
                                  </p>
                                )}
                              </div>

                              {/* Undraft Button Overlay - Only show to team members */}
                              {isUserTeamMember && (
                                <button
                                  onClick={() => handleUndraftCard(pick)}
                                  disabled={isUndrafting || !!undrafting}
                                  className={`
                                    absolute inset-0 bg-black/60 flex items-center justify-center
                                    opacity-0 group-hover:opacity-100 transition-opacity
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                  `}
                                >
                                  <span className="px-4 py-2 rounded-lg font-semibold shadow-lg bg-destructive hover:bg-destructive/90 text-white">
                                    {isUndrafting ? "Removing..." : "Undraft & Refund"}
                                  </span>
                                </button>
                              )}
                            </div>
                          </CardPreview>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="decks">
              {activeTab === "decks" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <BookOpen className="size-5" />
                      Deck Builder
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isUserTeamMember
                        ? "Create and manage decks from your drafted cards"
                        : `View and manage ${team.name}&apos;s decks`}
                    </p>
                  </div>
                  <DeckBuilder teamId={teamId} teamName={team.name} isUserTeamMember={isUserTeamMember} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="trades">
              {activeTab === "trades" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <ArrowLeftRight className="size-5" />
                      Trade Center
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Propose trades, manage offers, and negotiate with other teams
                    </p>
                  </div>
                  <div className="text-center py-12">
                    <ArrowLeftRight className="size-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-2xl font-bold mb-4">
                      Team Trade Management
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                      Trade cards and future draft picks with other teams. Captains and Brokers receive notifications about all trade activities.
                    </p>
                    <Button asChild size="lg">
                      <Link href={`/teams/${teamId}/trades`}>
                        View All Trades
                        <ExternalLink className="size-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="matches">
              {activeTab === "matches" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <Swords className="size-5" />
                      Matches
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Schedule match times and record results
                    </p>
                  </div>

                  {/* Match Scheduling Widget - Only for Pilots and Captains */}
                  <MatchSchedulingWidget teamId={teamId} userRoles={userRoles} />

                  {/* Match Recording */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Record Match Results
                    </h3>
                    <MatchRecording teamId={teamId} />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="votes">
              {activeTab === "votes" && isUserTeamMember && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <Vote className="size-5" />
                      Team Votes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Vote on team decisions and view results
                    </p>
                  </div>
                  <TeamVoting teamId={teamId} userRoles={userRoles} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats">
              {activeTab === "stats" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <BarChart3 className="size-5" />
                      Team Statistics
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive statistics for {team.name}&apos;s draft picks and decks
                    </p>
                  </div>
                  <TeamStats teamId={teamId} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="roles">
              {activeTab === "roles" && isUserTeamMember && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <Crown className="size-5" />
                      Team Roles & Permissions
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage team member roles and responsibilities
                    </p>
                  </div>
                  <TeamRoles teamId={teamId} teamName={team.name} isUserTeamMember={isUserTeamMember} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="members">
              {activeTab === "members" && (
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                    <Users className="size-5" />
                    Team Members
                  </h2>
                  {!team.members || team.members.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="size-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg mb-1">No members yet</p>
                      <p className="text-sm">This team is waiting for players to join</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {team.members.map((member) => {
                        // Find this member's roles from membersWithRoles
                        const memberRoleData = membersWithRoles.find(
                          (m) => m.user_id === member.user_id
                        );
                        const memberRoles = memberRoleData?.roles || [];

                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between bg-muted rounded-lg p-4 border"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">
                                  {member.user_display_name || "Unknown User"}
                                </p>
                                {/* Display role badges */}
                                {memberRoles.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {memberRoles.map((role) => (
                                      <Badge
                                        key={role}
                                        variant="secondary"
                                        title={getRoleDisplayName(role)}
                                      >
                                        {getRoleEmoji(role)} {getRoleDisplayName(role)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <CalendarDays className="size-3" />
                                Joined {new Date(member.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
