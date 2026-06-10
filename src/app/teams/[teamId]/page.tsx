// src/app/teams/[teamId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { TrophyCase } from "@/app/components/team/TrophyCase";
import { TeamEssenceDisplay } from "@/app/components/team/TeamEssenceDisplay";
import { getTeamByShortName } from "@/app/actions/teamActions";
import { getTeamDraftPicks, getTeamDecks, toggleKeeperStatus } from "@/app/actions/draftActions";
import { refundDraftPick } from "@/app/actions/cubucksActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions";
import { getActiveDraftSession } from "@/app/actions/draftSessionActions";
import { getAutoDraftPreview, toggleQueuePickVote, type AutoDraftPreviewResult } from "@/app/actions/autoDraftActions";
import { getCurrentUserRolesForTeam, getTeamMembersWithRoles, type TeamMemberWithRoles } from "@/app/actions/roleActions";
import { getRoleEmoji, getRoleDisplayName } from "@/app/utils/roleUtils";
import { getTeamHats } from "@/app/actions/hatActions"; 
import { DraftInterface } from "@/app/components/DraftInterface";
import { DeckBuilder } from "@/app/components/DeckBuilder";
import { TeamStats } from "@/app/components/TeamStats";
import { TeamRoles } from "@/app/components/TeamRoles";
import { TeamCubucksDisplay } from "@/app/components/TeamCubucksDisplay";
import { MatchRecording } from "@/app/components/MatchRecording";
import { MatchSchedulingWidget } from "@/app/components/team/MatchSchedulingWidget";
import { TeamVoting } from "@/app/components/team/TeamVoting";
import { DraftStatusWidget } from "@/app/components/DraftStatusWidget";
import { DraftQueueManager } from "@/app/components/DraftQueueManager";
import type { DraftPick, Deck } from "@/app/actions/draftActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { createIdentitySwapPoll, createTeamPoll } from "@/app/actions/voteActions"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { MoonStar, Sun, Target, Layers, BookOpen, ArrowLeftRight, Swords, BarChart3, Crown, Users, Loader2, AlertCircle, ExternalLink, CalendarDays, CheckCircle2, XCircle, Vote } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string; 
  user_display_name?: string;
  user_email?: string | null; 
  joined_at: string;
}

interface Team {
  id: string;
  short_name: string;
  name: string;
  emoji: string;
  motto: string;
  members?: TeamMember[];
}

interface TeamHatData {
  quantity: number;
  hats: {
    hatId: number;
    hatName: string | null;
    hatLevel: number | null;
    emoji: string | null;
  } | {
    hatId: number;
    hatName: string | null;
    hatLevel: number | null;
    emoji: string | null;
  }[] | null;
}

type TabType = "picks" | "decks" | "members" | "draft" | "stats" | "roles" | "trades" | "matches" | "votes" | "trophies";

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
  const [teamHats, setTeamHats] = useState<TeamHatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("picks");
  const [undrafting, setUndrafting] = useState<string | null>(null);
  const [undraftMessage, setUndraftMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cubucksRefreshKey, setCubucksRefreshKey] = useState(0);
  const [seasonPhase, setSeasonPhase] = useState<string | null>(null);
  const [togglingKeeper, setTogglingKeeper] = useState<string | null>(null);
  const isFreeAgencyActive = seasonPhase === "season";
  const [draftPreview, setDraftPreview] = useState<AutoDraftPreviewResult | null>(null);
  const [activeDraftSessionId, setActiveDraftSessionId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  
  const isUserTeamMember = team?.members?.some(
    (member) => member.user_id === user?.id
  ) || userRoles.length > 0;

  const loadTeamData = useCallback(async () => {
    if (!teamShortName) {
        return;
    }
    setLoading(true);
    try {
      const { team: foundTeam, error: teamError } = await getTeamByShortName(teamShortName);
      if (teamError || !foundTeam) {
        throw new Error(teamError || "Team not found.");
      }
      
      const seasonResult = await getCurrentSeason();
      const currentPhase = seasonResult.season?.phase || null;
      setSeasonPhase(currentPhase);
      const teamUUID = foundTeam.id;

      let sessionId: string | null = null;
      if (currentPhase === 'draft') {
        const { session: activeSession } = await getActiveDraftSession();
        sessionId = activeSession?.id || null;
        setActiveDraftSessionId(sessionId);
      } else {
        setActiveDraftSessionId(null);
      }

      const dataPromises: [
          Promise<{ picks: DraftPick[], error?: string }>,
          Promise<{ decks: Deck[], error?: string }>,
          Promise<{ roles: string[], error?: string }>,
          Promise<{ members: TeamMemberWithRoles[], error?: string }>,
          Promise<AutoDraftPreviewResult | null>,
          Promise<TeamHatData[]> 
      ] = [
        getTeamDraftPicks(teamUUID, sessionId || undefined),
        getTeamDecks(teamUUID),
        getCurrentUserRolesForTeam(teamUUID),
        getTeamMembersWithRoles(teamUUID),
        sessionId ? getAutoDraftPreview(teamUUID, sessionId) : Promise.resolve(null),
        getTeamHats(teamUUID) as Promise<TeamHatData[]>
      ];

      const [picksResult, decksResult, rolesResult, membersResult, previewResult, hatsResult] = await Promise.all(dataPromises);

      foundTeam.members = membersResult.members.map(m => ({ 
        id: m.member_id, 
        user_id: m.user_id,
        team_id: m.team_id, 
        user_email: m.user_email, 
        user_display_name: m.user_display_name || undefined,
        joined_at: m.joined_at,
      }));

      setTeam(foundTeam);
      setDraftPicks(picksResult.picks);
      setDecks(decksResult.decks);
      setUserRoles(rolesResult.roles);
      setMembersWithRoles(membersResult.members);
      setDraftPreview(previewResult);
      setTeamHats(hatsResult);

      const isMember = foundTeam.members?.some((m) => m.user_id === user?.id) || rolesResult.roles.length > 0;

      let defaultTab: TabType = "picks";
      if (currentPhase === "preseason" || currentPhase === "draft") {
        defaultTab = isMember ? "draft" : "picks";
      } else if (currentPhase === "season" || currentPhase === "playoffs") {
        defaultTab = "picks";
      } else if (currentPhase === "postseason") {
        defaultTab = isMember ? "votes" : "picks";
      }
      setActiveTab(defaultTab);
    } catch (error) {
      console.error("[TeamPage] Critical error loading team data:", error);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [teamShortName, user?.id]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleDraftComplete = async () => {
      if (!activeDraftSessionId || !team) return;
      const { picks } = await getTeamDraftPicks(team.id, activeDraftSessionId);
      setDraftPicks(picks);
      setCubucksRefreshKey((prev) => prev + 1);
      const preview = await getAutoDraftPreview(team.id, activeDraftSessionId);
      setDraftPreview(preview);
  };
  
  const handleToggleVote = async () => {
      if (!draftPreview?.nextPick?.id || !activeDraftSessionId || !team) return;
      setIsVoting(true);
      try {
          const result = await toggleQueuePickVote(team.short_name, draftPreview.nextPick.id, activeDraftSessionId);
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

  // THE FIX: Intercept Cut Requests for non-officer team members
  const handleUndraftCard = async (pick: DraftPick) => {
    if (pick.is_keeper) return;
    if (activeDraftSessionId) {
      alert("Cards cannot be cut from your pool during an active draft session.");
      return;
    }
    if (!pick.id || undrafting || !team || !user) return;

    const hasCutPermission = userRoles.includes("captain") || userRoles.includes("pilot") || userRoles.includes("broker");

    // Scenario A: User HAS permission. Execute cut instantly.
    if (hasCutPermission) {
        const confirmed = window.confirm(`Are you sure you want to cut "${pick.card_name}"? The Çubucks spent will be refunded to the team.`);
        if (!confirmed) return;
        
        setUndrafting(pick.id);
        setUndraftMessage(null);
        try {
          const result = await refundDraftPick(team.id, pick.id, pick.card_id, pick.card_name);
          if (result.success) {
            setUndraftMessage({ type: "success", text: `Cut ${pick.card_name}! Refunded ${result.refundAmount} Çubucks.` });
            const { picks } = await getTeamDraftPicks(team.id, activeDraftSessionId || undefined);
            setDraftPicks(picks);
            setCubucksRefreshKey((prev) => prev + 1);
          } else {
            setUndraftMessage({ type: "error", text: result.error || "Failed to cut card" });
          }
        } catch (error) {
          setUndraftMessage({ type: "error", text: "An unexpected error occurred." });
        } finally {
          setUndrafting(null);
          setTimeout(() => setUndraftMessage(null), 5000);
        }
        return;
    }

    // Scenario B: User DOES NOT have permission. Initiate a Vote!
    const confirmed = window.confirm(`You do not have direct permission to cut cards. Would you like to initiate a team vote to cut "${pick.card_name}"?`);
    if (!confirmed) return;

    setUndrafting(pick.id);
    try {
        const endsAt = new Date();
        endsAt.setHours(endsAt.getHours() + 12);

        // Note: For this to securely enforce the "1 per day" limit, your `createTeamPoll` backend 
        // action will need to check the `polls` table to see if this `created_by` user has submitted 
        // a poll titled "Cut " in the last 24 hours! Assuming the UI sends the request cleanly here:
        const result = await createTeamPoll(
            team.id,
            `Cut ${pick.card_name}?`,
            `Do we want to cut ${pick.card_name} and refund its Çubucks cost?`,
            endsAt.toISOString(),
            false, // no multiple votes
            false, // do not show results early
            [`Cut ${pick.card_name}`, "Keep it"],
            user.id
        );

        if (result.success) {
            setUndraftMessage({ type: "success", text: `A 12-hour team vote to cut ${pick.card_name} has been initiated! Check the Votes tab.` });
            // In a complete implementation, you'd have a cron job or manual trigger resolve this poll 
            // and actually execute the refund if "Cut" wins!
        } else {
            setUndraftMessage({ type: "error", text: result.error || "Failed to initiate vote. (You may have hit your daily limit)." });
        }
    } catch (e) {
        setUndraftMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
        setUndrafting(null);
        setTimeout(() => setUndraftMessage(null), 5000);
    }
  };

  const currentKeepersCount = draftPicks.filter(p => p.is_keeper).length;

  const handleToggleKeeper = async (pick: DraftPick) => {
    if (!pick.id) return; 
    if (!pick.is_keeper && currentKeepersCount >= 8) {
      alert("You can only designate up to 8 Keepers.");
      return;
    }
    setTogglingKeeper(pick.id);
    try {
      const result = await toggleKeeperStatus(pick.id, !pick.is_keeper);
      if (result.success) {
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
    ...(isUserTeamMember ? [{ id: "draft" as TabType, label: "Draft & Free Agency", icon: <Target className="size-4" />, count: undefined, disabled: false }] : []),
    { id: "picks" as TabType, label: "Team Pool", icon: <Layers className="size-4" />, count: draftPicks.length },
    { id: "decks" as TabType, label: "Decks", icon: <BookOpen className="size-4" />, count: decks.length },
    { id: "trades" as TabType, label: "Trades", icon: <ArrowLeftRight className="size-4" />, count: undefined },
    { id: "matches" as TabType, label: "Matches", icon: <Swords className="size-4" />, count: undefined },
        { id: "trophies" as TabType, label: "Trophy Case", icon: <Crown className="size-4 text-yellow-500" />, count: undefined },
    ...(isUserTeamMember ? [{ id: "votes" as TabType, label: "Votes", icon: <Vote className="size-4" />, count: undefined }] : []),
    { id: "stats" as TabType, label: "Statistics", icon: <BarChart3 className="size-4" />, count: undefined },
    ...(isUserTeamMember ? [{ id: "roles" as TabType, label: "Team Roles", icon: <Crown className="size-4" />, count: undefined }] : []),
    { id: "members" as TabType, label: "Members", icon: <Users className="size-4" />, count: team?.members?.length || 0 },
  ];
  
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
        <Card className="border-destructive"><CardContent className="pt-6 text-center">
          <AlertCircle className="size-10 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Team Not Found</h2>
          <p className="text-muted-foreground">The team &quot;{teamShortName}&quot; does not exist.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            
            <div className="flex items-end">
              <span className="text-7xl leading-none">{team.emoji}</span>
              {teamHats && teamHats.length > 0 && (
                <div className="flex flex-col gap-1 ml-2 pb-1">
                  {teamHats.map((th) => {
                    const hat = Array.isArray(th.hats) ? th.hats[0] : th.hats;
                    if (!hat || !hat.emoji) return null;
                    const isCursedHat = hat.hatId === 2;
                    return (
                      <div 
                        key={`hat-${hat.hatId}`} 
                        className={`text-2xl ${isCursedHat ? 'animate-pulse' : 'animate-bounce'}`} 
                        title={`${hat.hatName || 'Hat'} ${isCursedHat ? `(Level ${hat.hatLevel || 1})` : `(x${th.quantity})`}`}
                      >
                        {hat.emoji}
                        {isCursedHat ? (
                          <span className="text-xs text-red-500 font-bold ml-1">Lv.{hat.hatLevel || 1}</span>
                        ) : (
                          th.quantity > 1 && <span className="text-xs text-muted-foreground ml-1">x{th.quantity}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

      {isUserTeamMember && (team.short_name === 'changelings' || team.short_name === 'mimics') && seasonPhase !== 'draft' && (
        <Card className="mb-6 border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                {team.short_name === 'changelings' ? <MoonStar className="size-5 text-indigo-500"/> : <Sun className="size-5 text-amber-500"/>}
                The Great Aurora
              </h3>
              <p className="text-sm text-muted-foreground">
                As long as the cosmos remain neutral, any team member may initiate a 12-hour vote to transform the team's identity.
              </p>
            </div>
            <Button 
              onClick={async () => {
                if (!user?.id) return;
                const activeIdentity = team.short_name === 'changelings' ? 'changelings' : 'mimics';
                const result = await createIdentitySwapPoll(team.id, user.id, activeIdentity);
                alert(result.message || result.error);
                if (result.success) {
                  window.location.reload(); 
                }
              }}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white shadow-md"
            >
              Initiate Transformation Vote
            </Button>
          </CardContent>
        </Card>
      )}

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
        <div className="w-full">
          <TeamCubucksDisplay 
              teamId={team.id} 
              showTransactions={true} 
              refreshKey={cubucksRefreshKey} 
              isUserTeamMember={isUserTeamMember} 
          />
        </div>
        <div className="w-full">
          <TeamEssenceDisplay 
              teamId={team.id} 
              isUserTeamMember={isUserTeamMember} 
          />
        </div>
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
                          /* THE FIX: Removed CardPreview, implemented object-contain on image */
                          <div key={pick.id} className={`group relative bg-muted rounded-lg overflow-hidden border transition-all hover:shadow-md ${isKeeper && isUserTeamMember ? 'ring-2 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] border-green-500' : 'hover:border-primary/50'}`}>
                            
                            {imageUrl && (
                              <div className="relative h-80 bg-zinc-950/40 border-b border-border/10">
                                <Image src={imageUrl} alt={pick.card_name} fill className="object-contain" />
                              </div>
                            )}
                            
                            <div className="p-2">
                              <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-semibold text-sm truncate">{pick.card_name}</h4>
                                  <p className="text-xs text-muted-foreground truncate">{pick.card_set}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1">
                                {pick.cubecobra_elo != null && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                    ELO: {pick.cubecobra_elo.toLocaleString()}
                                  </p>
                                )}
                                {/* THE FIX: Added Çubucks cost! */}
                                <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500">
                                  Ç {pick.cubucks_cost || 1}
                                </p>
                              </div>
                              
                              {isKeeper && isUserTeamMember && (
                                <Badge className="mt-1.5 bg-green-600 hover:bg-green-600 text-[10px] uppercase font-bold tracking-wider">
                                  KEEPER
                                </Badge>
                              )}
                            </div>
                            
                            {/* OVERLAY CONTROLS */}
                            {isUserTeamMember && (
                              <>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                                {/* Cut Button - Only if NOT a keeper */}
                                {!isKeeper && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); handleUndraftCard(pick); }}
                                    disabled={isUndrafting || !!undrafting || !!togglingKeeper}
                                    className="absolute top-2 right-2 bg-destructive hover:bg-destructive/90 text-white text-xs font-bold px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10 pointer-events-auto"
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
                                    className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10 whitespace-nowrap pointer-events-auto ${isKeeper ? 'bg-gray-700 hover:bg-gray-800 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                  >
                                    {isToggling ? "Saving..." : isKeeper ? "Remove Keeper" : "Designate Keeper"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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
  <TabsContent value="trophies">
              {activeTab === "trophies" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                      <Crown className="size-5 text-yellow-500" />
                      Trophy Case
                    </h2>
                    <p className="text-sm text-muted-foreground">Historical championships won by {team.name}</p>
                  </div>
                  <TrophyCase teamId={team.id} />
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
