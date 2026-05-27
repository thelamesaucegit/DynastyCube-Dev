// src/app/schedule/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  getActiveSeasonSchedule,
  getAllSeasons,
  getScheduleWeeks,
  type ScheduleWeek,
} from "@/app/actions/scheduleActions";
import { getWeekMatchesAndSims, type UnifiedMatch } from "@/app/actions/matchActions"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Calendar, Clock, Loader2, AlertCircle, PlayCircle, Bot, Swords, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { formatDateTime } from "@/app/utils/timezoneUtils";
import { useUserTimezone } from "@/hooks/useUserTimezone";

// Add broadcast timing helpers to UnifiedMatch for the UI
interface StreamMatchUI extends UnifiedMatch {
    broadcastStartTime: number;
    broadcastEndTime: number;
    streamStatus: 'upcoming' | 'live' | 'replay';
}

interface WeekWithMatches extends ScheduleWeek {
  matches: StreamMatchUI[];
}

const getWeekStatus = (week: ScheduleWeek) => {
  const now = new Date();
  const startDate = new Date(week.start_date);
  const logicalEndDate = new Date(new Date(week.end_date).getTime() - (10 * 60000));
  if (now < startDate) return "upcoming";
  if (now > logicalEndDate) return "completed";
  return "current";
};

// HELPER: Attach Broadcast Timings to matches!
function enhanceMatchWithStreamTiming(match: UnifiedMatch): StreamMatchUI {
    // 1. Calculate Broadcast Start (Match Date + 30 mins)
    const baseTime = new Date(match.scheduled_for || match.created_at || Date.now()).getTime();
    const broadcastStartTime = baseTime + (30 * 60000);
    
    // 2. Calculate Broadcast End (Start + (Steps * 2s)). Fallback to 10 mins if steps aren't provided.
    const steps = match.total_steps || 300; 
    const broadcastEndTime = broadcastStartTime + (steps * 2000);
    
    const now = Date.now();
    let streamStatus: 'upcoming' | 'live' | 'replay' = 'replay';
    
    if (now < broadcastStartTime) streamStatus = 'upcoming';
    else if (now >= broadcastStartTime && now <= broadcastEndTime) streamStatus = 'live';

    return {
        ...match,
        broadcastStartTime,
        broadcastEndTime,
        streamStatus
    };
}

export default function SchedulePage() {
  const { timezone } = useUserTimezone();
  const [weeks, setWeeks] = useState<WeekWithMatches[]>([]);
  const [seasons, setSeasons] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  const setupDefaultOpenWeeks = (weeksData: WeekWithMatches[]) => {
    const defaultOpen: Record<string, boolean> = {};
    const currentWeek = weeksData.find(w => getWeekStatus(w) === "current");
    
    if (currentWeek) {
      defaultOpen[currentWeek.id] = true;
    } else {
      const upcomingWeek = weeksData.find(w => getWeekStatus(w) === "upcoming");
      if (upcomingWeek) defaultOpen[upcomingWeek.id] = true;
      else if (weeksData.length > 0) defaultOpen[weeksData[weeksData.length - 1].id] = true;
    }
    setOpenWeeks(defaultOpen);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const scheduleResult = await getActiveSeasonSchedule();
      if (scheduleResult.success && scheduleResult.season) {
        const weeksWithData = await Promise.all(
          (scheduleResult.weeks as ScheduleWeek[]).map(async (week) => {
            const { matches } = await getWeekMatchesAndSims(week.id);
            return { ...week, matches: (matches || []).map(enhanceMatchWithStreamTiming) };
          })
        );
        setWeeks(weeksWithData);
        setSelectedSeason(scheduleResult.season);
        setupDefaultOpenWeeks(weeksWithData); 
      } else {
        setError(scheduleResult.error || "No active season found");
      }
      const seasonsResult = await getAllSeasons();
      if (seasonsResult.success) setSeasons(seasonsResult.seasons);
    } catch (err) {
      console.error("Error loading schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = async (seasonId: string) => {
    if (!seasonId) return;
    const season = seasons.find((s) => s.id === seasonId);
    if (!season) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getScheduleWeeks(seasonId);
      if (result.error) {
        setError(result.error);
        setWeeks([]);
        setOpenWeeks({});
      } else {
        const weeksWithData = await Promise.all(
          result.weeks.map(async (week) => {
            const { matches } = await getWeekMatchesAndSims(week.id);
            return { ...week, matches: (matches || []).map(enhanceMatchWithStreamTiming) };
          })
        );
        setWeeks(weeksWithData);
        setSelectedSeason(season);
        setupDefaultOpenWeeks(weeksWithData);
      }
    } catch (err) {
      console.error("Error loading season schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = (weekId: string) => setOpenWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }));
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatDeadline = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Season Schedule</h1>
          <p className="text-lg text-muted-foreground">
            {selectedSeason
              ? `${selectedSeason.name} — ${selectedSeason.status.charAt(0).toUpperCase() + selectedSeason.status.slice(1)}`
              : "View match schedules and deadlines"}
          </p>
        </div>
        {seasons.length > 0 && (
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Select Season</label>
            <Select value={selectedSeason?.id || ""} onValueChange={handleSeasonChange}>
              <SelectTrigger><SelectValue placeholder="Choose season..." /></SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>{season.name} ({season.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <Card className="mb-6 border-yellow-500/50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {weeks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Schedule Available</h2>
            <p className="text-muted-foreground">The schedule for this season hasn&apos;t been set up yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => {
            const status = getWeekStatus(week);
            const deckDeadlinePassed = new Date(week.deck_submission_deadline) < new Date();
            const isOpen = openWeeks[week.id] || false;

            return (
              <Card
                key={week.id}
                className={`transition-all overflow-hidden ${
                  status === "current" ? "border-primary shadow-lg ring-1 ring-primary/20"
                    : status === "upcoming" ? "border-border" : "border-border opacity-80"
                }`}
              >
                <div 
                  onClick={() => toggleWeek(week.id)}
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors"
                >
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <CardTitle className="text-2xl">
                              {week.is_playoff_week ? (week.notes || "Playoffs") : `Week ${week.week_number}`}
                          </CardTitle>
                          {status === "current" && <Badge className="bg-primary">CURRENT WEEK</Badge>}
                          {status === "upcoming" && <Badge variant="secondary">UPCOMING</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(week.start_date)} - {formatDate(week.end_date)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-4 md:ml-4">
                        <div className="text-left md:text-right">
                          <p className={`text-sm font-medium flex items-center md:justify-end gap-1.5 ${deckDeadlinePassed ? "text-destructive" : "text-muted-foreground"}`}>
                            <Clock className="h-3.5 w-3.5" /> Deck Submission Deadline
                          </p>
                          <p className={`text-lg font-bold ${deckDeadlinePassed ? "text-destructive" : ""}`}>
                            {formatDeadline(week.deck_submission_deadline)}
                            {deckDeadlinePassed && " (Passed)"}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 pointer-events-none rounded-full">
                          {isOpen ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </div>

                {isOpen && (
                  <CardContent className="pt-4 border-t border-border/50">
                    {week.notes && (
                      <div className="mb-4 p-3 bg-accent rounded-lg">
                        <p className="text-sm">{week.notes}</p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Scheduled Matches
                      </h3>
                      {week.matches.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No matches scheduled for this week</p>
                      ) : (
                        <div className="space-y-3">
                          {week.matches.map((match) => {
                            // NEW: Destructure the dynamic statuses we calculated at the top
                            const { streamStatus, broadcastStartTime, broadcastEndTime } = match;
                            const isMasked = streamStatus === 'upcoming' || streamStatus === 'live';

                            return (
                              <Card key={match.id} className="bg-muted/50 border border-border/50">
                                <CardContent className="p-4">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    
                                    {/* Teams Section */}
                                    <div className="flex items-center justify-between gap-4 flex-1">
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className="text-2xl">{match.home_team?.emoji}</span>
                                        <span className="font-semibold text-lg">{match.home_team?.name || 'TBD'}</span>
                                      </div>
                                      
                                      {/* Score / VS - MASKED IF BEFORE BROADCAST END */}
                                      <div className="flex items-center gap-3 text-center px-4">
                                        {match.status === 'completed' && !isMasked ? (
                                          <>
                                            <span className={`text-xl font-bold ${match.home_team_wins > match.away_team_wins ? 'text-primary' : 'text-muted-foreground'}`}>
                                              {match.home_team_wins}
                                            </span>
                                            <span className="text-muted-foreground text-sm font-medium">VS</span>
                                            <span className={`text-xl font-bold ${match.away_team_wins > match.home_team_wins ? 'text-primary' : 'text-muted-foreground'}`}>
                                              {match.away_team_wins}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-muted-foreground text-sm font-medium">VS</span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2 flex-1 justify-end">
                                        <span className="font-semibold text-lg">{match.away_team?.name || 'TBD'}</span>
                                        <span className="text-2xl">{match.away_team?.emoji}</span>
                                      </div>
                                    </div>
                                    
                                    {/* Status & Actions Section */}
                                    <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-3 lg:gap-1 lg:ml-6 lg:pl-6 lg:border-l border-border/50 min-w-[140px]">
                                      <div className="flex flex-col items-center">
                                        {/* Status Badge is purely based on the Stream Time! */}
                                        <Badge
                                          variant={streamStatus === 'replay' ? "default" : streamStatus === "live" ? "destructive" : "outline"}
                                          className={`mb-1 ${streamStatus === 'replay' ? 'bg-emerald-600' : ''} ${streamStatus === 'live' ? 'animate-pulse' : ''}`}
                                        >
                                          {streamStatus === 'replay' ? 'COMPLETED' : streamStatus === 'live' ? 'LIVE NOW' : 'UPCOMING'}
                                        </Badge>
                                        
                                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                          {match.matchType === 'sim' ? <Bot className="h-3 w-3"/> : <Swords className="h-3 w-3"/>}
                                          {/* Format the BROADCAST time, not the DB time */}
                                          {formatDateTime(new Date(broadcastStartTime).toISOString(), timezone)}
                                        </span>
                                      </div>
                                      
                                      {/* Replay or Live Stream Button based on window */}
                                      {match.sim_match_id && (
                                        <Link href={isMasked ? `/stream/${match.sim_match_id}` : `/argentum-viewer/${match.sim_match_id}`}>
                                          <Button size="sm" variant={streamStatus === 'live' ? 'default' : 'secondary'} className={`w-full mt-2 flex items-center gap-1.5 ${streamStatus === 'live' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}>
                                            {streamStatus === 'live' ? <Radio className="h-4 w-4 animate-ping" /> : <PlayCircle className="h-4 w-4" />} 
                                            {streamStatus === 'upcoming' ? 'Waiting Room' : streamStatus === 'live' ? 'Tune In' : 'Watch Replay'}
                                          </Button>
                                        </Link>
                                      )}
                                    </div>

                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
