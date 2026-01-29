// src/app/teams/[teamId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import Layout from "@/components/Layout";
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
import { getCurrentUserRolesForTeam, getTeamMembersWithRoles, type TeamMemberWithRoles } from "@/app/actions/roleActions";
import { getRoleEmoji, getRoleDisplayName } from "@/app/utils/roleUtils";
import type { DraftPick, Deck } from "@/app/actions/draftActions";
import Link from "next/link";
import "@/styles/pages/teams.css";

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

type TabType = "picks" | "decks" | "members" | "draft" | "stats" | "roles" | "trades" | "matches";

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
    } catch (error) {
      console.error("Error loading team data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading team...</p>
        </div>
      </Layout>
    );
  }

  if (!team) {
    return (
      <Layout>
        <div className="py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Team Not Found
            </h2>
            <p className="text-red-800 dark:text-red-200">
              The team &quot;{teamId}&quot; does not exist.
            </p>
          </div>
        </div>
      </Layout>
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

  const tabs = [
    // Only show Draft Cards tab to team members
    ...(isUserTeamMember ? [{ id: "draft" as TabType, label: "🎯 Draft Cards", count: undefined }] : []),
    { id: "picks" as TabType, label: "🎴 Draft Picks", count: draftPicks.length },
    { id: "decks" as TabType, label: "📚 Decks", count: decks.length },
    { id: "trades" as TabType, label: "🔄 Trades", count: undefined },
    { id: "matches" as TabType, label: "⚔️ Matches", count: undefined },
    { id: "stats" as TabType, label: "📊 Statistics", count: undefined },
    // Only show roles tab to team members
    ...(isUserTeamMember ? [{ id: "roles" as TabType, label: "👑 Team Roles", count: undefined }] : []),
    { id: "members" as TabType, label: "👥 Members", count: team.members?.length || 0 },
  ];

  return (
    <Layout>
      <div className="py-8">
        {/* Team Header */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-8 mb-6 shadow-lg">
          <div className="flex items-center gap-6">
            <span className="text-8xl">{team.emoji}</span>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {team.name}
                  </h1>
                  <p className="text-xl text-gray-700 dark:text-gray-300 italic">
                    &quot;{team.motto}&quot;
                  </p>
                </div>
                <Link
                  href={`/teams/${teamId}/trades`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg flex items-center gap-2"
                >
                  <span>🔄</span>
                  <span>View Trades</span>
                </Link>
              </div>
              <div className="flex gap-4 mt-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  <strong className="text-gray-900 dark:text-gray-100">{draftPicks.length}</strong> cards
                </span>
                <span>•</span>
                <span>
                  <strong className="text-gray-900 dark:text-gray-100">{decks.length}</strong> decks
                </span>
                <span>•</span>
                <span>
                  <strong className="text-gray-900 dark:text-gray-100">{team.members?.length || 0}</strong> members
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Cubucks Balance */}
        <div className="mb-6">
          <TeamCubucksDisplay teamId={teamId} showTransactions={true} refreshKey={cubucksRefreshKey} isUserTeamMember={isUserTeamMember} />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 font-semibold transition-colors relative
                  ${
                    activeTab === tab.id
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }
                `}
              >
                {tab.label} {tab.count !== undefined && `(${tab.count})`}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
          {activeTab === "draft" && isUserTeamMember && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Draft Cards from Pool
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Select cards from the available pool to add to your team&apos;s collection
                </p>
              </div>
              <DraftInterface teamId={teamId} teamName={team.name} isUserTeamMember={isUserTeamMember} onDraftComplete={handleDraftComplete} />
            </div>
          )}

          {activeTab === "picks" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Draft Picks
                </h2>
              </div>

              {/* Success/Error Messages */}
              {undraftMessage && (
                <div
                  className={`mb-4 p-4 rounded-lg border ${
                    undraftMessage.type === "success"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                      : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                  }`}
                >
                  {undraftMessage.type === "success" ? "✓" : "✗"} {undraftMessage.text}
                </div>
              )}

              {draftPicks.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-500">
                  <p className="text-lg mb-2">No cards drafted yet</p>
                  <p className="text-sm">
                    {isUserTeamMember
                      ? "Your team hasn't selected any cards from the pool"
                      : `${team.name} hasn't selected any cards from the pool`}
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
                          className="group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-all hover:shadow-lg"
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
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                              {pick.card_name}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {pick.card_set}
                            </p>
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
                              <span className="px-4 py-2 rounded-lg font-semibold shadow-lg bg-red-600 hover:bg-red-700 text-white">
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

          {activeTab === "decks" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Deck Builder
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {isUserTeamMember
                    ? "Create and manage decks from your drafted cards"
                    : `View and manage ${team.name}'s decks`}
                </p>
              </div>
              <DeckBuilder teamId={teamId} teamName={team.name} isUserTeamMember={isUserTeamMember} />
            </div>
          )}

          {activeTab === "trades" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  🔄 Trade Center
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Propose trades, manage offers, and negotiate with other teams
                </p>
              </div>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Team Trade Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
                  Trade cards and future draft picks with other teams. Captains and Brokers receive notifications about all trade activities.
                </p>
                <Link
                  href={`/teams/${teamId}/trades`}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors shadow-lg"
                >
                  View All Trades →
                </Link>
              </div>
            </div>
          )}

          {activeTab === "matches" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  ⚔️ Matches
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Schedule match times and record results
                </p>
              </div>

              {/* Match Scheduling Widget - Only for Pilots and Captains */}
              <MatchSchedulingWidget teamId={teamId} userRoles={userRoles} />

              {/* Match Recording */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Record Match Results
                </h3>
                <MatchRecording teamId={teamId} />
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Team Statistics
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Comprehensive statistics for {team.name}&apos;s draft picks and decks
                </p>
              </div>
              <TeamStats teamId={teamId} />
            </div>
          )}

          {activeTab === "roles" && isUserTeamMember && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Team Roles & Permissions
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage team member roles and responsibilities
                </p>
              </div>
              <TeamRoles teamId={teamId} teamName={team.name} isUserTeamMember={isUserTeamMember} />
            </div>
          )}

          {activeTab === "members" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Team Members
              </h2>
              {!team.members || team.members.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-500">
                  <p className="text-lg mb-2">No members yet</p>
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
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {member.user_display_name || "Unknown User"}
                            </p>
                            {/* Display role badges */}
                            {memberRoles.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {memberRoles.map((role) => (
                                  <span
                                    key={role}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                                    title={getRoleDisplayName(role)}
                                  >
                                    {getRoleEmoji(role)} {getRoleDisplayName(role)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
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
        </div>
      </div>
    </Layout>
  );
}
