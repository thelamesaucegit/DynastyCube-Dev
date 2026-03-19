// src/app/history/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getComposedHistory,
  getErasAndSeasonsForFilters,
  getTeamsForFilter,
  getCurrentUserHistorianInfo,
} from "@/app/actions/historyActions";
import { HistoryFilters } from "@/components/history/HistoryFilters";
import { HistoryEraSection } from "@/components/history/HistoryEraSection";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import type {
  ComposedEra,
  ComposedSeason,
  TeamSeasonEntry,
  HistoryFilterState,
  HistorySeasonRow,
  LeagueSeasonEntry,
  ViewMode,
  TeamBasic,
} from "@/types/history";
import type { HistoryEraRow } from "@/types/history";

// =============================================================================
// TEAM-FIRST PIVOT TYPES
// When viewMode is "team-first", the inner hierarchy flips from
// Era > Season > Team  →  Era > Team > Season.
// These types represent the pivoted structure.
// =============================================================================

/** One team's presence across multiple seasons within a single era */
export interface TeamEraGroup {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  /** Ordered by season.display_order */
  seasons: {
    season: HistorySeasonRow;
    teamEntry: TeamSeasonEntry;
    leagueEntry: LeagueSeasonEntry;
  }[];
}

/** A ComposedEra augmented with the team-first pivot grouping */
export interface PivotedEra {
  era: HistoryEraRow;
  /** Used in team-first mode — one group per team that appears in this era */
  teamGroups: TeamEraGroup[];
  /** Used in season-first mode — the original season array */
  seasons: ComposedSeason[];
}

// =============================================================================
// PIVOT HELPER
// Transforms ComposedEra[] (season-first) into PivotedEra[] (team-first ready).
// Called only when viewMode switches — result is memoized in the component.
// =============================================================================

function pivotEras(eras: ComposedEra[]): PivotedEra[] {
  return eras.map((composedEra) => {
    // Collect every team ID that appears in any season of this era
    const teamMap = new Map<string, Omit<TeamEraGroup, "seasons">>();
    const teamSeasons = new Map<
      string,
      TeamEraGroup["seasons"]
    >();

    composedEra.seasons.forEach((composedSeason) => {
      composedSeason.teamEntries.forEach((teamEntry) => {
        if (!teamMap.has(teamEntry.teamId)) {
          teamMap.set(teamEntry.teamId, {
            teamId: teamEntry.teamId,
            teamName: teamEntry.teamName,
            teamEmoji: teamEntry.teamEmoji,
          });
          teamSeasons.set(teamEntry.teamId, []);
        }

        teamSeasons.get(teamEntry.teamId)!.push({
          season: composedSeason.season,
          teamEntry,
          leagueEntry: composedSeason.leagueEntry,
        });
      });
    });

    // Assemble team groups, sorted by team name for consistent ordering
    const teamGroups: TeamEraGroup[] = Array.from(teamMap.values())
      .sort((a, b) => a.teamName.localeCompare(b.teamName))
      .map((team) => ({
        ...team,
        seasons: teamSeasons.get(team.teamId)!,
      }));

    return {
      era: composedEra.era,
      seasons: composedEra.seasons,
      teamGroups,
    };
  });
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function HistoryPage() {
  // --- Data state ---
  const [composedEras, setComposedEras] = useState<ComposedEra[]>([]);
  const [erasForFilter, setErasForFilter] = useState<
    (HistoryEraRow & { seasons: HistorySeasonRow[] })[]
  >([]);
  const [teamsForFilter, setTeamsForFilter] = useState<TeamBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- User permission state ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHistorian, setIsHistorian] = useState(false);
  const [historianTeamId, setHistorianTeamId] = useState<string | null>(null);

  // --- Filter + view mode state ---
  const [filters, setFilters] = useState<HistoryFilterState>({
    eraId: null,
    seasonId: null,
    teamId: null,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("season-first");

  // ==========================================================================
  // INITIAL LOAD
  // Fetches filter dropdown options and user info in parallel.
  // History content is loaded separately (see loadHistory).
  // ==========================================================================

  useEffect(() => {
    const init = async () => {
      try {
        const [erasResult, teamsResult, userInfo] = await Promise.all([
          getErasAndSeasonsForFilters(),
          getTeamsForFilter(),
          getCurrentUserHistorianInfo(),
        ]);

        if (erasResult.eras) setErasForFilter(erasResult.eras);
        if (teamsResult.teams) setTeamsForFilter(teamsResult.teams);

        setIsAdmin(userInfo.isAdmin);
        setIsHistorian(userInfo.isHistorian);
        setHistorianTeamId(userInfo.historianTeamId ?? null);
      } catch {
        setError("Failed to initialize history page");
      }
    };

    init();
  }, []);

  // ==========================================================================
  // HISTORY CONTENT LOAD
  // Re-runs whenever the active filters change.
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getComposedHistory(filters);
      if (result.error) {
        setError(result.error);
      } else {
        setComposedEras(result.eras);
      }
    } catch {
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ==========================================================================
  // PIVOT MEMO
  // Pivots the season-first data into team-first structure.
  // Only recalculates when composedEras changes.
  // ==========================================================================

  const pivotedEras = useMemo(() => pivotEras(composedEras), [composedEras]);

  // ==========================================================================
  // FILTER HANDLERS
  // Each dropdown sets one key; the others remain unchanged.
  // When a season filter is set, auto-clear conflicting era filter only if
  // the chosen season does not belong to the chosen era.
  // ==========================================================================

  const handleFilterChange = useCallback(
    (key: keyof HistoryFilterState, value: string | null) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">History</h1>
        <p className="text-lg text-muted-foreground">
          Records and chronicles of the Dynasty Cube league
        </p>
      </div>

      {/* Filter bar — dropdowns for Era, Season, Team and the view mode toggle */}
      <HistoryFilters
        eras={erasForFilter}
        teams={teamsForFilter}
        filters={filters}
        viewMode={viewMode}
        onFilterChange={handleFilterChange}
        onViewModeChange={handleViewModeChange}
      />

      {/* Content area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : pivotedEras.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No history records found for the selected filters.
        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {pivotedEras.map((pivotedEra) => (
            <HistoryEraSection
              key={pivotedEra.era.id}
              pivotedEra={pivotedEra}
              viewMode={viewMode}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              onRefresh={loadHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
