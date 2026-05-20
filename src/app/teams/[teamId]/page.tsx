// src/app/teams/[teamId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsWithMembers, getTeamByShortName } from "@/app/actions/teamActions";
import { getTeamDraftPicks, getTeamDecks, toggleKeeperStatus } from "@/app/actions/draftActions";
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
import { getAutoDraftPreview, toggleQueuePickVote, type AutoDraftPreviewResult } from "@/app/actions/autoDraftActions";
import { getActiveDraftSession } from "@/app/actions/draftSessionActions";
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
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

interface TeamMember {
  id: string;
  user_id: string;
  user_display_name?: string;
  joined_at: string;
}

interface Team {
  id: string;         // UUID primary key
  short_name: string; // URL slug e.g. 'shards', 'ninja'
  name: string;
  emoji: string;
  motto: string;
  members?: TeamMember[];
}

type TabType = "picks" | "decks" | "members" | "draft" | "stats" | "roles" | "trades" | "matches" | "votes";

export default function TeamPage() {
  const params = useParams();
  const teamShortName = params?.teamId as string;
  
  const { user } = useAuth();
  const { useOldestArt } = useSettings();
  
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
    const [togglingKeeper, setTogglingKeeper] = useState<string | null>(null); // <-- NEW STATE

  const isFreeAgencyActive = seasonPhase === "season";
  const [draftPreview, setDraftPreview] = useState<AutoDraftPreviewResult | null>(null);
  const [activeDraftSessionId, setActiveDraftSessionId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  
  const isUserTeamMember = team?.members?.some(
    (member) => member.user_id === user?.id
  ) || userRoles.length > 0;

  useEffect(() => {
    console.log("[TeamPage] useEffect triggered. teamShortName:", teamShortName, "user:", user?.id);
    
    // Safety guard: Wait until Next.js router successfully hydrates the URL parameter
    if (!teamShortName) {
      console.log("[TeamPage] Waiting for teamShortName to hydrate from URL...");
      return; 
    }
    
    console.log("[TeamPage] Calling loadTeamData()...");
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamShortName, user?.id]);

  const loadTeamData = async () => {
    setLoading(true);
    console.log("[TeamPage] loadTeamData Phase 1 Started");
    
    try {
      // --- Phase 1: Fetch data that has no dependencies ---
      const { team: foundTeam, error: teamError } = await getTeamByShortName(teamShortName);
      
      if (teamError) {
        console.error("[TeamPage] API Error fetching team:", teamError);
      }
      
      if (teamError || !foundTeam) {
        console.log("[TeamPage] Team not found or error occurred. Setting team to null.");
        setTeam(null);
        setLoading(false);
        return;
      }
      
      console.log("[TeamPage] Team successfully fetched:", foundTeam.name);
      const teamUUID = foundTeam.id;

      // --- Phase 2: Fetch data that is needed for the next phase ---
      console.log("[TeamPage] loadTeamData Phase 2 Started");
      const { session: activeSession } = await getActiveDraftSession();
      const sessionId = activeSession?.id || null;
      console.log("[TeamPage] Active Draft Session ID:", sessionId);
      setActiveDraftSessionId(sessionId); 

      // --- Phase 3: Fetch all remaining data in parallel ---
      console.log("[TeamPage] loadTeamData Phase 3 Started (Promise.all)");
      const previewPromise = sessionId
        ? getAutoDraftPreview(teamUUID, sessionId)
        : Promise.resolve(null as AutoDraftPreviewResult | null);

      const [seasonResult, picksResult, decksResult, rolesResult, membersResult, previewResult] = await Promise.all([
        getCurrentSeason(),
        getTeamDraftPicks(teamUUID, sessionId || undefined),
        getTeamDecks(teamUUID),
        getCurrentUserRolesForTeam(teamUUID),
        getTeamMembersWithRoles(teamUUID),
        previewPromise,
      ]);
      
      console.log("[TeamPage] Phase 3 Completed. Processing results...");
      
      foundTeam.members = membersResult.members.map(m => ({ 
        id: m.member_id, 
        user_id: m.user_id, 
        team_id: m.team_id,
        user_email: m.user_email,
        user_display_name: m.user_display_name,
        joined_at: m.joined_at,
      }));

      setTeam(foundTeam);
      setDraftPicks(picksResult.picks);
      setDecks(decksResult.decks);
      setUserRoles(rolesResult.roles);
      setMembersWithRoles(membersResult.members);
      setDraftPreview(previewResult);
      setSeasonPhase(seasonResult.season?.phase || null);
      
      // Determine and set the default active tab
      const isMember = foundTeam.members?.some((m) => m.user_id === user?.id) || rolesResult.roles.length > 0;
      let defaultTab: TabType = "picks";
      const currentPhase = seasonResult.season?.phase;
      
      if (currentPhase === "preseason" || currentPhase === "draft") {
        defaultTab = isMember ? "draft" : "picks";
      } else if (currentPhase === "season" || currentPhase === "playoffs") {
        defaultTab = "picks";
      } else if (currentPhase === "postseason") {
        defaultTab = isMember ? "votes" : "picks";
      }
      
      console.log("[TeamPage] Setting active tab to:", defaultTab);
      setActiveTab(defaultTab);
      
    } catch (error) {
      console.error("[TeamPage] Critical Try/Catch Error loading team data:", error);
      setTeam(null);
    } finally {
      console.log("[TeamPage] loadTeamData Finally Block - turning off loading spinner");
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="size-10 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading Team...</p>
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
            <h2 className="text-2xl font-bold mb-2">Team Not Found</h2>
            <p className="text-muted-foreground">
              The team &quot;{teamShortName}&quot; does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDraftComplete = async () => {
    if (!activeDraftSessionId || !team) return;
    const { picks } = await getTeamDraftPicks(team.id, activeDraftSessionId);
    setDraftPicks(picks);
    setCubucksRefreshKey((prev) => prev + 1);
    const preview = await getAutoDraftPreview(team.id, activeDraftSessionId);
    setDraftPreview(preview);
  };

  const handleToggleVote = async () => {
    if (!draftPreview?.nextPick?.id || !activeDraftSessionId) return;
    setIsVoting(true);
    try {
      const result = await toggleQueuePickVote(
        team.short_name,
        draftPreview.nextPick.id,
        activeDraftSessionId
      );
      if (result.success) {
        if (result.pickExecuted) {
          await handleDraftComplete();
        } else {
          const updatedPreview = await getAutoDraftPreview(team.id, activeDraftSessionId);
          setDraftPreview(updatedPreview);
        }
      } else {
        alert(result.error || "Failed to submit vote");
      }
    } catch (error) {
      console.error("Error toggling vote:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleUndraftCard = async (pick: DraftPick) => {
    console.log(`[Undraft Action] Initiated for card: ${pick.card_name} (ID: ${pick.id})`);
        if (pick.is_keeper) return; // Guard clause

    // 1. Prevent cutting cards during an active draft session
    if (activeDraftSessionId) {
      console.warn("[Undraft Action] Blocked: Cannot cut cards while a draft session is active.");
      alert("Cards cannot be cut from your pool during an active draft session.");
      return;
    }

    // 2. Prevent proceeding if critical data is missing or action is already processing
    if (!pick.id || undrafting || !team) {
      console.error("[Undraft Action] Blocked: Missing required state or already processing.", {
        pickId: pick.id,
        isUndrafting: undrafting,
        hasTeam: !!team
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to undraft "${pick.card_name}"? The Çubucks spent will be refunded to the team.`
    );
    
    if (!confirmed) {
      console.log("[Undraft Action] Cancelled by user.");
      return;
    }

    console.log(`[Undraft Action] Proceeding with refund for team ${team.id}`);
    
    setUndrafting(pick.id);
    setUndraftMessage(null);

    try {
      const result = await refundDraftPick(team.id, pick.id, pick.card_id, pick.card_name);
      console.log("[Undraft Action] Refund API result:", result);

      if (result.success) {
        setUndraftMessage({
          type: "success",
          text: `Undrafted ${pick.card_name}! Refunded ${result.refundAmount} Çubucks.`,
        });
        
        console.log("[Undraft Action] Refreshing team picks...");
        const { picks } = await getTeamDraftPicks(team.id, activeDraftSessionId || undefined);
        setDraftPicks(picks);
        setCubucksRefreshKey((prev) => prev + 1);
      } else {
        console.error("[Undraft Action] Refund failed:", result.error);
        setUndraftMessage({
          type: "error",
          text: result.error || "Failed to undraft card",
        });
      }
    } catch (error) {
      console.error("[Undraft Action] Exception during refund:", error);
      setUndraftMessage({
        type: "error",
        text: "An unexpected error occurred.",
      });
    } finally {
      setUndrafting(null);
      setTimeout(() => setUndraftMessage(null), 5000);
    }
  };
// --- NEW HANDLER FOR KEEPERS ---
  const currentKeepersCount = draftPicks.filter(p => p.is_keeper).length;

  const handleToggleKeeper = async (pick: DraftPick) => {
    if (!pick.is_keeper && currentKeepersCount >= 8) {
      alert("You can only designate up to 8 Keepers.");
      return;
    }
    setTogglingKeeper(pick.id);
    try {
      const result = await toggleKeeperStatus(pick.id, !pick.is_keeper);
      if (result.success) {
        // Optimistically update the UI
        setDraftPicks(prev => prev.map(p => p.id === pick.id ? { ...p, is_keeper: !p.is_keeper } : p));
      } else {
        alert(result.error || "Failed to update keeper status.");
      }
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred.");
    } finally {
      setTogglingKeeper(null);
    }
  };
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number, disabled?: boolean }[] = [
    ...(isUserTeamMember ? [{
      id: "draft" as TabType,
      label: "Draft & Free Agency",
      icon: <Target className="size-4" />,
      count: undefined,
      disabled: false 
    }] : []),
    { id: "picks" as TabType, label: "Team Pool", icon: <Layers className="size-4" />, count: draftPicks.length },
    { id: "decks" as TabType, label: "Decks", icon: <BookOpen className="size-4" />, count: decks.length },
    { id: "trades" as TabType, label: "Trades", icon: <ArrowLeftRight className="size-4" />, count: undefined },
    { id: "matches" as TabType, label: "Matches", icon: <Swords className="size-4" />, count: undefined },
    ...(isUserTeamMember ? [{ id: "votes" as TabType, label: "Votes", icon: <Vote className="size-4" />, count: undefined }] : []),
    { id: "stats" as TabType, label: "Statistics", icon: <BarChart3 className="size-4" />, count: undefined },
    ...(isUserTeamMember ? [{ id: "roles" as TabType, label: "Team Roles", icon: <Crown className="size-4" />, count: undefined }] : []),
    { id: "members" as TabType, label: "Members", icon: <Users className="size-4" />, count: team.members?.length || 0 },
  ];

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <span className="text-7xl">{team.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-1">{team.name}</h1>
                  <p className="text-lg text-muted-foreground italic">&quot;{team.motto}&quot;</p>
                </div>
                <Button asChild>
                  <Link href={`/teams/${teamShortName}/trades`} className="shrink-0">
                    <ArrowLeftRight className="size-4 mr-2" />
                    View Trades
                  </Link>
                </Button>
              </div>
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <span><strong className="text-foreground">{draftPicks.length}</strong> cards</span>
                <span className="text-muted-foreground/50">|</span>
                <span><strong className="text-foreground">{decks.length}</strong> decks</span>
                <span className="text-muted-foreground/50">|</span>
                <span><strong className="text-foreground">{team.members?.length || 0}</strong> members</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DraftStatusWidget variant="team" teamId={team.id} />
      
      <div className="mb-6">
        <TeamCubucksDisplay teamId={team.id} showTransactions={true} refreshKey={cubucksRefreshKey} isUserTeamMember={isUserTeamMember} />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
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

        <Card>
          <CardContent className="pt-6">
            <TabsContent value="draft">
              {activeTab === "draft" && isUserTeamMember && (
                <div className="space-y-8">
                  {draftPreview?.source === "manual_queue" && draftPreview.nextPick && (
                    <Card className="border-primary/50 bg-primary/5 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="w-24 h-36 shrink-0 rounded-md overflow-hidden shadow-md bg-muted">
                            {(() => {
                              const imageUrl = getCardImageUrl(draftPreview.nextPick!, useOldestArt);
                              return imageUrl && (
                                <Image
                                  src={imageUrl}
                                  alt={draftPreview.nextPick!.card_name}
                                  width={96}
                                  height={144}
                                  className="w-full h-full object-cover"
                                />
                              );
                            })()}
                          </div>
                          <div className="flex-1 text-center md:text-left">
                            <Badge className="mb-2 bg-primary">Up Next in Queue</Badge>
                            <h3 className="text-xl font-bold mb-2">{draftPreview.nextPick.card_name}</h3>
                            <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
                              This card is at the top of your team&apos;s manual queue. Vote to confirm it for immediate submission. If the vote threshold is met while your team is on the clock, the pick will be processed instantly.
                            </p>
                            {(() => {
                              const currentVotes = draftPreview.votes?.length || 0;
                              const threshold = draftPreview.voteThreshold || 1;
                              const isVoted = user?.id ? draftPreview.votes?.includes(user.id) : false;

                              return (
                                <Button 
                                  onClick={handleToggleVote} 
                                  disabled={isVoting || !activeDraftSessionId}
                                  className={isVoted ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                                >
                                  {isVoting && <Loader2 className="size-4 animate-spin mr-2" />}
                                  {!isVoting && <Vote className="size-4 mr-2" />}
                                  {isVoted ? "Retract Vote" : "Confirm pick for immediate submission"} 
                                  <span className="ml-2 font-normal opacity-90">
                                    ({currentVotes}/{threshold} votes in favor)
                                  </span>
                                </Button>
                              );
                            })()}
                            {!activeDraftSessionId && (
                              <p className="text-xs text-destructive mt-2">Cannot vote: No active draft session found.</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">Draft Priority Queue</h2>
                      <p className="text-sm text-muted-foreground">Set your team&apos;s desired draft picks before the draft begins.</p>
                    </div>
                    <DraftQueueManager teamId={team.id} isUserTeamMember={isUserTeamMember} />
                  </div>

                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">Draft Progress & Pick Order</h2>
                      <p className="text-sm text-muted-foreground">View the current draft progress and upcoming pick order.</p>
                    </div>
                    <DraftStatusWidget variant="team" teamId={team.id} />
                  </div>

                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">Free Agent Pool</h2>
                      <p className="text-sm text-muted-foreground">Browse cards available for acquisition. Acquiring free agents is only enabled during the active season.</p>
                    </div>
                    <DraftInterface
                      teamId={team.id} 
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
                      Team Pool
                    </h2>
                    {isUserTeamMember && seasonPhase === "playoffs" && (
                      <Badge variant="outline" className="bg-primary/5">
                        Keepers: {currentKeepersCount} / 8
                      </Badge>
                    )}
                  </div>

                  {undraftMessage && (
                    <div
                      className={`mb-4 p-4 rounded-lg border flex items-center gap-2 ${
                        undraftMessage.type === "success"
                          ? "bg-accent text-foreground"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {undraftMessage.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
                      {undraftMessage.text}
                    </div>
                  )}

                  {draftPicks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Layers className="size-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg mb-1">No cards drafted yet</p>
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
                        const isToggling = togglingKeeper === pick.id;
                        const isKeeper = pick.is_keeper;
                        const imageUrl = getCardImageUrl(pick, useOldestArt);
                        
                        return (
                          <CardPreview key={pick.id} card={pick}>
                            <div className={`group relative bg-muted rounded-lg overflow-hidden border transition-all hover:shadow-md ${isKeeper && isUserTeamMember ? 'ring-2 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] border-green-500' : 'hover:border-primary/50'}`}>
                              
                              {imageUrl && (
                                <div className="relative h-64">
                                  <Image src={imageUrl} alt={pick.card_name} fill className="object-cover" />
                                </div>
                              )}
                              
                              <div className="p-2">
                                <div className="flex justify-between items-start">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-sm truncate">{pick.card_name}</h4>
                                    <p className="text-xs text-muted-foreground truncate">{pick.card_set}</p>
                                  </div>
                                </div>
                                
                                {pick.cubecobra_elo != null && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                                    ELO: {pick.cubecobra_elo.toLocaleString()}
                                  </p>
                                )}
                                
                                {isKeeper && isUserTeamMember && (
                                  <Badge className="mt-1.5 bg-green-600 hover:bg-green-600 text-[10px] uppercase font-bold tracking-wider">
                                    KEEPER
                                  </Badge>
                                )}
                              </div>

                              {/* OVERLAY CONTROLS */}
                              {isUserTeamMember && (
                                <>
                                  {/* Darken image on hover to make buttons pop */}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

                                  {/* Cut Button - Only if NOT a keeper */}
                                  {!isKeeper && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); handleUndraftCard(pick); }}
                                      disabled={isUndrafting || !!undrafting || !!togglingKeeper}
                                      className="absolute top-2 right-2 bg-destructive hover:bg-destructive/90 text-white text-xs font-bold px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10"
                                      title="Cut and Refund"
                                    >
                                      {isUndrafting ? "..." : "Cut"}
                                    </button>
                                  )}

                                  {/* Keeper Toggle Button - Only during Playoffs */}
                                  {seasonPhase === "playoffs" && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); handleToggleKeeper(pick); }}
                                      disabled={isToggling || !!undrafting}
                                      className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10 whitespace-nowrap ${isKeeper ? 'bg-gray-700 hover:bg-gray-800 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                    >
                                      {isToggling ? "Saving..." : isKeeper ? "Remove Keeper" : "Designate Keeper"}
                                    </button>
                                  )}
                                </>
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
                  <DeckBuilder teamId={team.id} teamName={team.name} isUserTeamMember={isUserTeamMember} />
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
                    <p className="text-sm text-muted-foreground">Propose trades, manage offers, and negotiate with other teams</p>
                  </div>
                  <div className="text-center py-12">
                    <ArrowLeftRight className="size-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-2xl font-bold mb-4">Team Trade Management</h3>
                    <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                      Trade cards and future draft picks with other teams. Captains and Brokers receive notifications about all trade activities.
                    </p>
                    <Button asChild size="lg">
                      <Link href={`/teams/${teamShortName}/trades`}>
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
                    <p className="text-sm text-muted-foreground">Schedule match times and record results</p>
                  </div>
                  <MatchSchedulingWidget teamId={team.id} userRoles={userRoles} />
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Record Match Results</h3>
                    <MatchRecording teamId={team.id} />
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
                    <p className="text-sm text-muted-foreground">Vote on team decisions and view results</p>
                  </div>
                  <TeamVoting teamId={team.id} userRoles={userRoles} />
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
                    <p className="text-sm text-muted-foreground">Comprehensive statistics for {team.name}&apos;s draft picks and decks</p>
                  </div>
                  <TeamStats teamId={team.id} />
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
                    <p className="text-sm text-muted-foreground">Manage team member roles and responsibilities</p>
                  </div>
                  <TeamRoles teamId={team.id} teamName={team.name} isUserTeamMember={isUserTeamMember} />
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
                        const memberRoleData = membersWithRoles.find((m) => m.user_id === member.user_id);
                        const memberRoles = memberRoleData?.roles || [];
                        
                        return (
                          <div key={member.id} className="flex items-center justify-between bg-muted rounded-lg p-4 border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">{member.user_display_name || "Unknown User"}</p>
                                {memberRoles.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {memberRoles.map((role) => (
                                      <Badge key={role} variant="secondary" title={getRoleDisplayName(role)}>
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
