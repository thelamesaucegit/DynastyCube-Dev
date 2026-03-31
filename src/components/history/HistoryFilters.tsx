// src/components/history/HistoryFilters.tsx
"use client";

import React, { useState } from "react";
import { LayoutList, Users, Pencil, PencilOff, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { InlineEraForm } from "@/components/history/HistoryAdminForms";
import type { HistoryFilterState, ViewMode, TeamBasic } from "@/types/history";
import type { HistoryEraRow, HistorySeasonRow } from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistoryFiltersProps {
  eras: (HistoryEraRow & { seasons: HistorySeasonRow[] })[];
  teams: TeamBasic[];
  filters: HistoryFilterState;
  viewMode: ViewMode;
  isAdmin: boolean;
  isHistorian: boolean;
  editMode: boolean;
  onFilterChange: (key: keyof HistoryFilterState, value: string | null) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onEditModeChange: (value: boolean) => void;
  /** Called after any structural change so the page can reload content + dropdowns */
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryFilters({
  eras,
  teams,
  filters,
  viewMode,
  isAdmin,
  isHistorian,
  editMode,
  onFilterChange,
  onViewModeChange,
  onEditModeChange,
  onRefresh,
}: HistoryFiltersProps) {
  // Only shown in edit mode — allows creating a brand-new era from the filter bar
  const [showEraForm, setShowEraForm] = useState(false);

  // --------------------------------------------------------------------------
  // Season dropdown: filtered by era if one is selected
  // --------------------------------------------------------------------------

  const seasonOptions = filters.eraId
    ? (eras.find((e) => e.id === filters.eraId)?.seasons ?? [])
    : eras.flatMap((e) => e.seasons);

  function handleSeasonChange(seasonId: string | null) {
    onFilterChange("seasonId", seasonId);
    // If chosen season belongs to a different era, clear the era filter
    if (seasonId && filters.eraId) {
      const seasonEra = eras.find((e) => e.seasons.some((s) => s.id === seasonId));
      if (seasonEra && seasonEra.id !== filters.eraId) {
        onFilterChange("eraId", null);
      }
    }
  }

  function handleEraChange(eraId: string | null) {
    onFilterChange("eraId", eraId);
    // If the currently selected season doesn't belong to the new era, clear it
    if (eraId && filters.seasonId) {
      const selectedEra = eras.find((e) => e.id === eraId);
      if (!selectedEra?.seasons.some((s) => s.id === filters.seasonId)) {
        onFilterChange("seasonId", null);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-3 mb-6">

      {/* Main filter bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border bg-card">

        {/* Era dropdown */}
        <div className="flex flex-col gap-1 min-w-[150px]">
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
                {era.is_hidden ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Season dropdown */}
        <div className="flex flex-col gap-1 min-w-[150px]">
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
            {filters.eraId
              ? seasonOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_hidden ? " (hidden)" : ""}
                  </option>
                ))
              : eras.map((era) => (
                  <optgroup key={era.id} label={era.name}>
                    {era.seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.is_hidden ? " (hidden)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
        </div>

        {/* Team dropdown */}
        <div className="flex flex-col gap-1 min-w-[150px]">
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
                {team.is_hidden ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            View by
          </label>
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              type="button"
              title="Season-first (Era → Season → Team)"
              onClick={() => onViewModeChange("season-first")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
                ${viewMode === "season-first"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
                }`}
            >
              <LayoutList className="h-4 w-4" />
              Season
            </button>
            <button
              type="button"
              title="Team-first (Era → Team → Season)"
              onClick={() => onViewModeChange("team-first")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
                         border-l border-input
                ${viewMode === "team-first"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
                }`}
            >
              <Users className="h-4 w-4" />
              Team
            </button>
          </div>
        </div>

        {/* Clear filters */}
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
            Clear
          </button>
        )}

        {/*
          Edit Mode toggle — only rendered for admin users.
          Turning it on reveals inline CRUD controls at every level of the
          history hierarchy. Turning it off returns to clean reading mode.
        */}
        {(isAdmin || isHistorian) && (
          <button
            type="button"
            onClick={() => {
              onEditModeChange(!editMode);
              setShowEraForm(false); // close any open forms when toggling
            }}
            className={`self-end flex items-center gap-1.5 h-9 px-3 rounded-md text-sm
                        font-medium border transition-colors
              ${editMode
                ? "bg-amber-500/15 border-amber-500/50 text-amber-600 hover:bg-amber-500/25"
                : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            title={editMode ? "Exit Edit Mode" : "Enter Edit Mode"}
          >
            {editMode
              ? <><PencilOff className="h-4 w-4" /> Exit Edit Mode</>
              : <><Pencil className="h-4 w-4" /> Edit Mode</>
            }
          </button>
        )}
      </div>

      {/*
        Admin action bar — only visible in edit mode.
        Contains top-level structural actions: creating a new Era.
        Season creation lives inside HistoryEraSection (closer to where it belongs).
      */}
      {editMode && (isAdmin || isHistorian) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border
                        border-amber-500/30 bg-amber-500/5">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Edit Mode
          </span>
          <div className="flex-1" />
          {isAdmin && !showEraForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEraForm(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Era
            </Button>
          )}
        </div>
      )}

      {/* New Era form — appears in the filter bar area so it's visually top-level */}
      {editMode && isAdmin && showEraForm && (
        <InlineEraForm
          onSuccess={() => {
            setShowEraForm(false);
            onRefresh();
          }}
          onCancel={() => setShowEraForm(false)}
        />
      )}
    </div>
  );
}
