// src/components/history/HistoryEraSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { HistorySeasonSection } from "@/components/history/HistorySeasonSection";
import {
  InlineEraForm,
  InlineSeasonForm,
  AdminHiddenToggle,
} from "@/components/history/HistoryAdminForms";
import { adminUpdateEra } from "@/app/actions/historyActions";
import type { PivotedEra, TeamEraGroup } from "@/app/history/page";
import type {
  HistoryFilterState,
  ViewMode,
  ComposedSeason,
  TeamBasic,
} from "@/types/history";

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
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT — routes to season-first or team-first layout
// =============================================================================

export function HistoryEraSection({
  pivotedEra,
  viewMode,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  editMode,
  allTeams,
  onRefresh,
}: HistoryEraSectionProps) {
  // Eras start expanded by default (spec requirement)
  const [isOpen, setIsOpen] = useState(true);

  const sharedProps = {
    pivotedEra,
    filters,
    isOpen,
    onToggle: () => setIsOpen((v) => !v),
    isAdmin,
    isHistorian,
    historianTeamId,
    editMode,
    allTeams,
    onRefresh,
  };

  return viewMode === "team-first"
    ? <TeamFirstEraSection {...sharedProps} />
    : <SeasonFirstEraSection {...sharedProps} />;
}


// =============================================================================
// SHARED ERA HEADER
// Renders the era title, collapse chevron, and (in edit mode) admin controls.
// =============================================================================

function EraHeader({
  era,
  isOpen,
  onToggle,
  childCount,
  isAdmin,
  editMode,
  onRefresh,
}: {
  era: PivotedEra["era"];
  isOpen: boolean;
  onToggle: () => void;
  childCount: number;
  isAdmin: boolean;
  editMode: boolean;
  onRefresh: () => void;
}) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);

  return (
    <div>
      <div className="flex items-center">
        {/* Main clickable header */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 p-4 text-left
                     hover:bg-muted/50 transition-colors rounded-tl-lg"
        >
          {isOpen
            ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          }
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              {era.name}
              {/* Visual indicator when era is hidden from non-admins */}
              {era.is_hidden && (
                <span className="text-xs font-normal px-1.5 py-0.5 rounded
                                 bg-amber-500/15 text-amber-600">
                  Hidden
                </span>
              )}
            </h2>
            {era.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {era.description}
              </p>
            )}
          </div>
          {!isOpen && (
            <span className="ml-auto text-xs text-muted-foreground mr-2">
              {childCount} {childCount === 1 ? "season" : "seasons"}
            </span>
          )}
        </button>

        {/*
          Admin controls — only visible in edit mode.
          Rendered to the right of the header so they don't interfere with
          the expand/collapse click target.
        */}
        {editMode && isAdmin && (
          <div className="flex items-center gap-1.5 pr-4 shrink-0">
            <AdminHiddenToggle
              isHidden={era.is_hidden}
              onToggle={async (newValue) => {
                await adminUpdateEra(era.id, { is_hidden: newValue });
                onRefresh();
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowEditForm((v) => !v);
                setShowSeasonForm(false);
              }}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowSeasonForm((v) => !v);
                setShowEditForm(false);
              }}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3" />
              Season
            </Button>
          </div>
        )}
      </div>

      {/* Edit era form — inline below header */}
      {editMode && isAdmin && showEditForm && (
        <div className="px-4 pb-3">
          <InlineEraForm
            era={era}
            onSuccess={() => {
              setShowEditForm(false);
              onRefresh();
            }}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      )}

      {/* Add season form — inline below header */}
      {editMode && isAdmin && showSeasonForm && (
        <div className="px-4 pb-3">
          <InlineSeasonForm
            eraId={era.id}
            onSuccess={() => {
              setShowSeasonForm(false);
              onRefresh();
            }}
            onCancel={() => setShowSeasonForm(false)}
          />
        </div>
      )}
    </div>
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
  editMode,
  allTeams,
  onRefresh,
}: {
  pivotedEra: PivotedEra;
  filters: HistoryFilterState;
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <EraHeader
        era={pivotedEra.era}
        isOpen={isOpen}
        onToggle={onToggle}
        childCount={pivotedEra.seasons.length}
        isAdmin={isAdmin}
        editMode={editMode}
        onRefresh={onRefresh}
      />

      {isOpen && (
        <div className="border-t divide-y">
          {pivotedEra.seasons.map((composedSeason) => (
            <HistorySeasonSection
              key={composedSeason.season.id}
              season={composedSeason.season}
              leagueEntry={composedSeason.leagueEntry}
              teamEntries={composedSeason.teamEntries}
              defaultOpen={filters.seasonId === composedSeason.season.id}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              editMode={editMode}
              allTeams={allTeams}
              onRefresh={onRefresh}
            />
          ))}

          {/* Empty state */}
          {pivotedEra.seasons.length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              {editMode && isAdmin
                ? "No seasons yet — use the Season button above to add one."
                : "No seasons have been recorded for this era."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// TEAM-FIRST LAYOUT  (Era → Team → Season)
// =============================================================================

function TeamFirstEraSection({
  pivotedEra,
  filters,
  isOpen,
  onToggle,
  isAdmin,
  isHistorian,
  historianTeamId,
  editMode,
  allTeams,
  onRefresh,
}: {
  pivotedEra: PivotedEra;
  filters: HistoryFilterState;
  isOpen: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <EraHeader
        era={pivotedEra.era}
        isOpen={isOpen}
        onToggle={onToggle}
        childCount={pivotedEra.seasons.length}
        isAdmin={isAdmin}
        editMode={editMode}
        onRefresh={onRefresh}
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
              editMode={editMode}
              allTeams={allTeams}
              onRefresh={onRefresh}
            />
          ))}

          {pivotedEra.teamGroups.length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              No team history for this era yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// TEAM GROUP SECTION (team-first mode only)
// =============================================================================

function TeamGroupSection({
  teamGroup,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  editMode,
  allTeams,
  onRefresh,
}: {
  teamGroup: TeamEraGroup;
  filters: HistoryFilterState;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(filters.teamId === teamGroup.teamId);

  useEffect(() => {
    if (filters.teamId === teamGroup.teamId) setIsOpen(true);
  }, [filters.teamId, teamGroup.teamId]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
                   hover:bg-muted/40 transition-colors"
      >
        {isOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        }
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
              teamEntries={[teamEntry]}
              defaultOpen={filters.seasonId === season.id}
              filters={filters}
              isAdmin={isAdmin}
              isHistorian={isHistorian}
              historianTeamId={historianTeamId}
              editMode={editMode}
              allTeams={allTeams}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
