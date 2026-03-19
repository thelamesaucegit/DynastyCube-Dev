// src/components/history/HistoryEraSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { HistorySeasonSection } from "@/components/history/HistorySeasonSection";
import type { PivotedEra, TeamEraGroup } from "@/app/history/page";
import type { HistoryFilterState, ViewMode, ComposedSeason } from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistoryEraSectionProps {
  pivotedEra: PivotedEra;
  viewMode: ViewMode;
  filters: HistoryFilterState;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryEraSection({
  pivotedEra,
  viewMode,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  onRefresh,
}: HistoryEraSectionProps) {
  // Eras are expanded by default (see spec: "only thing expanded should be the Eras")
  const [isOpen, setIsOpen] = useState(true);

  // --------------------------------------------------------------------------
  // Season-first view: render Era > Season > Team
  // Team-first view:   render Era > Team > Season
  //
  // The view toggle has no effect when filters already collapse the content
  // to a single dimension — the data returned from the server already
  // reflects the filter, so both modes produce equivalent output in that case.
  // --------------------------------------------------------------------------

  if (viewMode === "team-first") {
    return (
      <TeamFirstEraSection
        pivotedEra={pivotedEra}
        filters={filters}
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        isAdmin={isAdmin}
        isHistorian={isHistorian}
        historianTeamId={historianTeamId}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <SeasonFirstEraSection
      pivotedEra={pivotedEra}
      filters={filters}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      isAdmin={isAdmin}
      isHistorian={isHistorian}
      historianTeamId={historianTeamId}
      onRefresh={onRefresh}
    />
  );
}


// =============================================================================
// SHARED ERA HEADER
// Used by both season-first and team-first layouts.
// =============================================================================

function EraHeader({
  name,
  description,
  isOpen,
  onToggle,
  childCount,
}: {
  name: string;
  description?: string | null;
  isOpen: boolean;
  onToggle: () => void;
  childCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left
                 hover:bg-muted/50 transition-colors rounded-t-lg"
    >
      <div className="flex items-center gap-3">
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight">{name}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {!isOpen && (
        <span className="text-xs text-muted-foreground mr-1">
          {childCount} {childCount === 1 ? "season" : "seasons"}
        </span>
      )}
    </button>
  );
}


// =============================================================================
// SEASON-FIRST LAYOUT  (Era → Season → Team)
// =============================================================================

function SeasonFirstEraSection({
  pivotedEra,
  filters,
  isOpen,
  onToggle,
  isAdmin,
  isHistorian,
  historianTeamId,
  onRefresh,
}: {
  pivotedEra: PivotedEra;
  filters: HistoryFilterState;
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <EraHeader
        name={pivotedEra.era.name}
        description={pivotedEra.era.description}
        isOpen={isOpen}
        onToggle={onToggle}
        childCount={pivotedEra.seasons.length}
      />

      {isOpen && (
        <div className="border-t divide-y">
          {pivotedEra.seasons.map((composedSeason) => (
            <HistorySeasonSection
              key={composedSeason.season.id}
              season={composedSeason.season}
              leagueEntry={composedSeason.leagueEntry}
              teamEntries={composedSeason.teamEntries}
              // Auto-expand the season if it matches the active season filter
              defaultOpen={filters.seasonId === composedSeason.season.id}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// TEAM-FIRST LAYOUT  (Era → Team → Season)
// Each team group accordion contains one HistorySeasonSection per season
// the team appears in.
// =============================================================================

function TeamFirstEraSection({
  pivotedEra,
  filters,
  isOpen,
  onToggle,
  isAdmin,
  isHistorian,
  historianTeamId,
  onRefresh,
}: {
  pivotedEra: PivotedEra;
  filters: HistoryFilterState;
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <EraHeader
        name={pivotedEra.era.name}
        description={pivotedEra.era.description}
        isOpen={isOpen}
        onToggle={onToggle}
        childCount={pivotedEra.seasons.length}
      />

      {isOpen && (
        <div className="border-t divide-y">
          {pivotedEra.teamGroups.map((teamGroup) => (
            <TeamGroupSection
              key={teamGroup.teamId}
              teamGroup={teamGroup}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// TEAM GROUP SECTION (used only in team-first mode)
// Renders one team accordion that contains its seasons nested inside.
// =============================================================================

function TeamGroupSection({
  teamGroup,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  onRefresh,
}: {
  teamGroup: TeamEraGroup;
  filters: HistoryFilterState;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  onRefresh: () => void;
}) {
  // Auto-expand the team group if it matches the active team filter
  const [isOpen, setIsOpen] = useState(
    filters.teamId === teamGroup.teamId
  );

  // If the team filter changes (e.g. user picks a different team), update
  useEffect(() => {
    if (filters.teamId === teamGroup.teamId) {
      setIsOpen(true);
    }
  }, [filters.teamId, teamGroup.teamId]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
                   hover:bg-muted/40 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-lg font-semibold">
          {teamGroup.teamEmoji} {teamGroup.teamName}
        </span>
        {!isOpen && (
          <span className="ml-auto text-xs text-muted-foreground">
            {teamGroup.seasons.length}{" "}
            {teamGroup.seasons.length === 1 ? "season" : "seasons"}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-t divide-y ml-4">
          {teamGroup.seasons.map(({ season, teamEntry, leagueEntry }) => (
            <HistorySeasonSection
              key={season.id}
              season={season}
              leagueEntry={leagueEntry}
              // In team-first mode, only pass the one team's entry per season
              teamEntries={[teamEntry]}
              defaultOpen={filters.seasonId === season.id}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
