// src/components/history/HistoryFilters.tsx
"use client";

import React from "react";
import { LayoutList, Users } from "lucide-react";
import type {
  HistoryFilterState,
  ViewMode,
  TeamBasic,
} from "@/types/history";
import type { HistoryEraRow, HistorySeasonRow } from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistoryFiltersProps {
  /** Eras with their nested seasons — used to populate Era and Season dropdowns */
  eras: (HistoryEraRow & { seasons: HistorySeasonRow[] })[];
  /** Teams list — used to populate Team dropdown */
  teams: TeamBasic[];
  /** Current active filter values */
  filters: HistoryFilterState;
  /** Current view hierarchy mode */
  viewMode: ViewMode;
  /** Called when any single filter dropdown changes */
  onFilterChange: (key: keyof HistoryFilterState, value: string | null) => void;
  /** Called when the view mode toggle is clicked */
  onViewModeChange: (mode: ViewMode) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryFilters({
  eras,
  teams,
  filters,
  viewMode,
  onFilterChange,
  onViewModeChange,
}: HistoryFiltersProps) {

  // --------------------------------------------------------------------------
  // Season dropdown options
  // If an era is selected, only show seasons belonging to that era.
  // If no era is selected, show all seasons (grouped by era label in the select).
  // --------------------------------------------------------------------------

  const seasonOptions = filters.eraId
    ? (eras.find((e) => e.id === filters.eraId)?.seasons ?? [])
    : eras.flatMap((e) => e.seasons);

  // --------------------------------------------------------------------------
  // When season changes, if the new season belongs to a different era than
  // the current era filter, clear the era filter so they don't conflict.
  // --------------------------------------------------------------------------

  function handleSeasonChange(seasonId: string | null) {
    onFilterChange("seasonId", seasonId);

    if (seasonId && filters.eraId) {
      const seasonEra = eras.find((e) =>
        e.seasons.some((s) => s.id === seasonId)
      );
      if (seasonEra && seasonEra.id !== filters.eraId) {
        // The chosen season is in a different era — clear era filter to avoid
        // a state where no results would ever match.
        onFilterChange("eraId", null);
      }
    }
  }

  // --------------------------------------------------------------------------
  // When era changes, if the current season filter no longer belongs to the
  // newly selected era, clear the season filter.
  // --------------------------------------------------------------------------

  function handleEraChange(eraId: string | null) {
    onFilterChange("eraId", eraId);

    if (eraId && filters.seasonId) {
      const selectedEra = eras.find((e) => e.id === eraId);
      const seasonBelongsToEra = selectedEra?.seasons.some(
        (s) => s.id === filters.seasonId
      );
      if (!seasonBelongsToEra) {
        onFilterChange("seasonId", null);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-lg border bg-card">

      {/* --- Era dropdown --- */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Era
        </label>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm
                     focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.eraId ?? ""}
          onChange={(e) => handleEraChange(e.target.value || null)}
        >
          <option value="">All Eras</option>
          {eras.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name}
            </option>
          ))}
        </select>
      </div>

      {/* --- Season dropdown --- */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Season
        </label>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm
                     focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.seasonId ?? ""}
          onChange={(e) => handleSeasonChange(e.target.value || null)}
        >
          <option value="">All Seasons</option>
          {/*
            If no era filter is set, group seasons by era using <optgroup>.
            If an era filter is set, the seasons are already filtered above
            and we don't need grouping.
          */}
          {filters.eraId
            ? seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))
            : eras.map((era) => (
                <optgroup key={era.id} label={era.name}>
                  {era.seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
      </div>

      {/* --- Team dropdown --- */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Team
        </label>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm
                     focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.teamId ?? ""}
          onChange={(e) => onFilterChange("teamId", e.target.value || null)}
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.emoji} {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* --- Spacer: pushes view toggle to the right on wider screens --- */}
      <div className="flex-1" />

      {/* --- View mode toggle (Season-first vs Team-first) ---
          The toggle is disabled when a team filter is active because in that
          case the content is already scoped to one team and the toggle adds
          no meaningful reorganisation.
      */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          View by
        </label>
        <div className="flex rounded-md border border-input overflow-hidden">
          <button
            type="button"
            title="Season-first view (Era → Season → Team)"
            onClick={() => onViewModeChange("season-first")}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
              ${
                viewMode === "season-first"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }
            `}
          >
            <LayoutList className="h-4 w-4" />
            Season
          </button>
          <button
            type="button"
            title="Team-first view (Era → Team → Season)"
            onClick={() => onViewModeChange("team-first")}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-input
              ${
                viewMode === "team-first"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }
            `}
          >
            <Users className="h-4 w-4" />
            Team
          </button>
        </div>
      </div>

      {/* --- Clear filters button — only visible when any filter is active --- */}
      {(filters.eraId || filters.seasonId || filters.teamId) && (
        <button
          type="button"
          onClick={() => {
            onFilterChange("eraId", null);
            onFilterChange("seasonId", null);
            onFilterChange("teamId", null);
          }}
          className="self-end h-9 px-3 rounded-md text-sm text-muted-foreground
                     hover:text-foreground hover:bg-muted transition-colors border border-input"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
