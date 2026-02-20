// src/app/schedule/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getActiveSeasonSchedule,
  getAllSeasons,
  getScheduleWeeks,
  type ScheduleWeek,
} from "@/app/actions/scheduleActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Calendar, Clock, Loader2, AlertCircle } from "lucide-react";

interface Match {
  id: string;
  status: string;
  home_team: {
    id: string;
    name: string;
    emoji: string;
  };
  away_team: {
    id: string;
    name: string;
    emoji: string;
  };
  home_team_wins: number;
  away_team_wins: number;
  best_of: number;
}

interface WeekWithMatches extends ScheduleWeek {
  matches: Match[];
}

export default function SchedulePage() {
  const [weeks, setWeeks] = useState<WeekWithMatches[]>([]);
  const [seasons, setSeasons] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get active season schedule
      const scheduleResult = await getActiveSeasonSchedule();

      if (scheduleResult.success && scheduleResult.season) {
        setWeeks(scheduleResult.weeks as WeekWithMatches[]);
        setSelectedSeason(scheduleResult.season);
      } else {
        setError(scheduleResult.error || "No active season found");
      }

      // Get all seasons for dropdown
      const seasonsResult = await getAllSeasons();
      if (seasonsResult.success) {
        setSeasons(seasonsResult.seasons);
      }
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
      } else {
        // Need to get matches for each week
        const weeksWithMatches: WeekWithMatches[] = result.weeks.map((week) => ({
          ...week,
          matches: [],
        }));
        setWeeks(weeksWithMatches);
        setSelectedSeason(season);
      }
    } catch (err) {
      console.error("Error loading season schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const getWeekStatus = (week: WeekWithMatches) => {
    const now = new Date();
    const startDate = new Date(week.start_date);
    const endDate = new Date(week.end_date);

    if (now < startDate) return "upcoming";
    if (now > endDate) return "completed";
    return "current";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Season Schedule
          </h1>
          <p className="text-lg text-muted-foreground">
            {selectedSeason
              ? `${selectedSeason.name} \u2014 ${selectedSeason.status.charAt(0).toUpperCase() + selectedSeason.status.slice(1)}`
              : "View match schedules and deadlines"}
          </p>
        </div>
        {seasons.length > 0 && (
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Select Season
            </label>
            <Select value={selectedSeason?.id || ""} onValueChange={handleSeasonChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose season..." />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.name} ({season.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="mb-6 border-yellow-500/50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Weeks */}
      {weeks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              No Schedule Available
            </h2>
            <p className="text-muted-foreground">
              The schedule for this season hasn&apos;t been set up yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => {
            const status = getWeekStatus(week);
            const deckDeadlinePassed = new Date(week.deck_submission_deadline) < new Date();

            return (
              <Card
                key={week.id}
                className={`transition-all ${
                  status === "current"
                    ? "border-primary shadow-lg ring-1 ring-primary/20"
                    : status === "upcoming"
                    ? "border-border"
                    : "border-border opacity-75"
                }`}
              >
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <CardTitle className="text-2xl">
                          Week {week.week_number}
                        </CardTitle>
                        {status === "current" && (
                          <Badge className="bg-primary">CURRENT WEEK</Badge>
                        )}
                        {status === "upcoming" && (
                          <Badge variant="secondary">UPCOMING</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(week.start_date)} - {formatDate(week.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium flex items-center gap-1.5 justify-end ${deckDeadlinePassed ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />
                        Deck Submission Deadline
                      </p>
                      <p className={`text-lg font-bold ${deckDeadlinePassed ? "text-destructive" : ""}`}>
                        {formatDeadline(week.deck_submission_deadline)}
                        {deckDeadlinePassed && " (Passed)"}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Week Notes */}
                  {week.notes && (
                    <div className="mb-4 p-3 bg-accent rounded-lg">
                      <p className="text-sm">{week.notes}</p>
                    </div>
                  )}

                  {/* Matches */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Scheduled Matches
                    </h3>
                    {week.matches.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No matches scheduled for this week
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {week.matches.map((match) => (
                          <Card key={match.id} className="bg-muted/50">
                            <CardContent className="py-4">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-4 flex-1">
                                  {/* Home Team */}
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-2xl">{match.home_team.emoji}</span>
                                    <span className="font-semibold">
                                      {match.home_team.name}
                                    </span>
                                  </div>

                                  {/* Score / VS */}
                                  <div className="flex items-center gap-3 text-center px-4">
                                    <span className="text-xl font-bold">
                                      {match.home_team_wins}
                                    </span>
                                    <span className="text-muted-foreground text-sm font-medium">VS</span>
                                    <span className="text-xl font-bold">
                                      {match.away_team_wins}
                                    </span>
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex items-center gap-2 flex-1 justify-end">
                                    <span className="font-semibold">
                                      {match.away_team.name}
                                    </span>
                                    <span className="text-2xl">{match.away_team.emoji}</span>
                                  </div>
                                </div>

                                {/* Match Status */}
                                <div className="flex flex-col items-center gap-1 md:ml-4">
                                  <Badge
                                    variant={
                                      match.status === "completed"
                                        ? "default"
                                        : match.status === "in_progress"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className={
                                      match.status === "completed"
                                        ? "bg-emerald-600"
                                        : ""
                                    }
                                  >
                                    {match.status.replace("_", " ").toUpperCase()}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground">
                                    Best of {match.best_of}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
