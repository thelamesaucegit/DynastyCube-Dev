// src/components/history/HistorySeasonSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { HistoryTeamSection } from "@/components/history/HistoryTeamSection";
import {
  InlineSeasonForm,
  InlineEntryForm,
  AdminHiddenToggle,
} from "@/components/history/HistoryAdminForms";
import {
  adminUpdateSeason,
  adminToggleSectionHidden,
} from "@/app/actions/historyActions";
import { LEAGUE_SLOT_SCHEMA, TEAM_SLOT_SCHEMA } from "@/config/historySlotSchema";
import type {
  HistoryFilterState,
  TeamSeasonEntry,
  LeagueSeasonEntry,
  HistorySeasonRow,
  TeamBasic,
  HistorySlot,
} from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistorySeasonSectionProps {
  season: HistorySeasonRow;
  leagueEntry: LeagueSeasonEntry;
  teamEntries: TeamSeasonEntry[];
  defaultOpen?: boolean;
  filters: HistoryFilterState;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/** Builds a synthetic (empty) TeamSeasonEntry for a team not yet in this season */
function makeSyntheticTeamEntry(team: TeamBasic, seasonId: string): TeamSeasonEntry {
  return {
    teamId: team.id,
    teamName: team.name,
    teamEmoji: team.emoji,
    seasonId,
    slots: TEAM_SLOT_SCHEMA.map((slotDef) => ({
      sectionId: null,
      slotType: slotDef.type,
      title: slotDef.label,
      entries: [],
      referencedTeamIds: [],
      isHidden: false,
      displayOrder: slotDef.order,
    })),
  };
}

export function HistorySeasonSection({
  season,
  leagueEntry,
  teamEntries,
  defaultOpen = false,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  editMode,
  allTeams,
  onRefresh,
}: HistorySeasonSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showEditForm, setShowEditForm] = useState(false);
  const [pendingTeams, setPendingTeams] = useState<TeamBasic[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    if (filters.seasonId === season.id) setIsOpen(true);
  }, [filters.seasonId, season.id]);

  // In edit mode, show league content even if it's empty (so admin can add to it).
  // In read mode, only show league content if at least one slot has entries.
  const hasLeagueContent = editMode
    ? true
    : leagueEntry.slots.some((s) => s.entries.length > 0 && !s.isHidden);

  const existingTeamIds = new Set(teamEntries.map((e) => e.teamId));
  const pendingTeamIds = new Set(pendingTeams.map((t) => t.id));

  // Teams admin can still add (not already in season, not pending)
  const availableTeams = allTeams.filter(
    (t) => !existingTeamIds.has(t.id) && !pendingTeamIds.has(t.id)
  );

  // Historian's team info — for the "Add My Team" shortcut
  const historianTeam =
    isHistorian && historianTeamId
      ? (allTeams.find((t) => t.id === historianTeamId) ?? null)
      : null;
  const canHistorianAddOwnTeam =
    historianTeam !== null &&
    !existingTeamIds.has(historianTeam.id) &&
    !pendingTeamIds.has(historianTeam.id);

  function handleAddTeamFromPicker() {
    const team = allTeams.find((t) => t.id === selectedTeamId);
    if (team) {
      setPendingTeams((prev) => [...prev, team]);
      setSelectedTeamId("");
      setShowTeamPicker(false);
    }
  }

  function handleAddMyTeam() {
    if (historianTeam) {
      setPendingTeams((prev) => [...prev, historianTeam]);
    }
  }

  return (
    <div>
      {/* Season header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left
                     hover:bg-muted/40 transition-colors"
        >
          {isOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-base flex items-center gap-2">
              {season.name}
              {season.is_hidden && (
                <span className="text-xs font-normal px-1.5 py-0.5 rounded
                                 bg-amber-500/15 text-amber-600">
                  Hidden
                </span>
              )}
            </span>
            {season.description && (
              <span className="text-sm text-muted-foreground truncate hidden sm:block">
                — {season.description}
              </span>
            )}
            {season.spreadsheet_url && (
              <a
                href={season.spreadsheet_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
                title="View draft spreadsheet"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {!isOpen && (
            <span className="text-xs text-muted-foreground mr-1 shrink-0">
              {teamEntries.length} {teamEntries.length === 1 ? "team" : "teams"}
            </span>
          )}
        </button>

        {/* Season admin controls */}
        {editMode && isAdmin && (
          <div className="flex items-center gap-1.5 pr-4 shrink-0">
            <AdminHiddenToggle
              isHidden={season.is_hidden}
              onToggle={async (newValue) => {
                await adminUpdateSeason(season.id, { is_hidden: newValue });
                onRefresh();
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEditForm((v) => !v)}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            {availableTeams.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowTeamPicker((v) => !v);
                  setShowEditForm(false);
                }}
                className="gap-1 h-7 px-2 text-xs"
              >
                <Plus className="h-3 w-3" />
                Team
              </Button>
            )}
          </div>
        )}

        {/* Historian shortcut — only visible when their team isn't in this season */}
        {editMode && isHistorian && !isAdmin && canHistorianAddOwnTeam && (
          <div className="pr-4 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddMyTeam}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3" />
              Add My Team
            </Button>
          </div>
        )}
      </div>

      {/* Edit season form */}
      {editMode && isAdmin && showEditForm && (
        <div className="px-4 pb-2">
          <InlineSeasonForm
            eraId={season.era_id}
            season={season}
            onSuccess={() => {
              setShowEditForm(false);
              onRefresh();
            }}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      )}

      {/* Team picker — admin selects which team to add */}
      {editMode && isAdmin && showTeamPicker && (
        <div className="px-4 pb-3">
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 flex items-center gap-2">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a team…</option>
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.emoji} {team.name}
                  {team.is_hidden ? " (hidden)" : ""}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleAddTeamFromPicker}
              disabled={!selectedTeamId}
            >
              Add Team
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowTeamPicker(false);
                setSelectedTeamId("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Season content */}
      {isOpen && (
        <div className="border-t">
          {/* League-level content for this season */}
          {hasLeagueContent && (
            <LeagueSeasonContent
              leagueEntry={leagueEntry}
              season={season}
              isAdmin={isAdmin}
              editMode={editMode}
              allTeams={allTeams}
              onRefresh={onRefresh}
            />
          )}

          {/* Team entries */}
          <div className="divide-y">
            {teamEntries.map((teamEntry) => {
              const canEdit =
                isAdmin || (isHistorian && historianTeamId === teamEntry.teamId);
              const isCrossTeamSurfaced =
                !!filters.teamId && filters.teamId !== teamEntry.teamId;

              return (
                <HistoryTeamSection
                  key={teamEntry.teamId}
                  teamEntry={teamEntry}
                  eraId={season.era_id}
                  seasonId={season.id}
                  defaultOpen={
                    filters.teamId === teamEntry.teamId || isCrossTeamSurfaced
                  }
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  editMode={editMode}
                  allTeams={allTeams}
                  isCrossTeamSurfaced={isCrossTeamSurfaced}
                  onRefresh={onRefresh}
                />
              );
            })}

            {/* Pending teams — added via +Team but not yet saved */}
            {pendingTeams.map((team) => {
              const canEdit =
                isAdmin || (isHistorian && historianTeamId === team.id);
              return (
                <HistoryTeamSection
                  key={`pending-${team.id}`}
                  teamEntry={makeSyntheticTeamEntry(team, season.id)}
                  eraId={season.era_id}
                  seasonId={season.id}
                  defaultOpen={true}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  editMode={editMode}
                  allTeams={allTeams}
                  onRefresh={() => {
                    setPendingTeams((prev) => prev.filter((t) => t.id !== team.id));
                    onRefresh();
                  }}
                />
              );
            })}
          </div>

          {teamEntries.length === 0 && pendingTeams.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              {editMode && (isAdmin || canHistorianAddOwnTeam)
                ? "No team entries for this season yet — use the + Team button above to add one."
                : "No team history has been written for this season yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// LEAGUE SEASON CONTENT
// Displays league-level slots for a season.
// In edit mode, shows all LEAGUE_SLOT_SCHEMA slots (including empty ones)
// so admin can add content to any slot.
// =============================================================================

function LeagueSeasonContent({
  leagueEntry,
  season,
  isAdmin,
  editMode,
  allTeams,
  onRefresh,
}: {
  leagueEntry: LeagueSeasonEntry;
  season: HistorySeasonRow;
  isAdmin: boolean;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // In read mode: only visible slots with entries
  // In edit mode: all slots from the schema (so admin can add to empty ones)
  const slotsToRender: HistorySlot[] = editMode
    ? LEAGUE_SLOT_SCHEMA.map((slotDef) => {
        const existing = leagueEntry.slots.find(
          (s) => s.slotType === slotDef.type
        );
        return (
          existing ?? {
            sectionId: null,
            slotType: slotDef.type,
            title: slotDef.label,
            entries: [],
            referencedTeamIds: [],
            isHidden: false,
            displayOrder: slotDef.order,
          }
        );
      })
    : leagueEntry.slots.filter((s) => s.entries.length > 0 && !s.isHidden);

  if (slotsToRender.length === 0) return null;

  return (
    <div className="border-b bg-muted/20">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-6 py-2.5 text-left
                   hover:bg-muted/40 transition-colors"
      >
        {isOpen
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }
        <span className="text-sm font-medium text-muted-foreground">
          League Records
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-4 space-y-6">
          {slotsToRender.map((slot) => (
            <LeagueSlotDisplay
              key={slot.slotType}
              slot={slot}
              season={season}
              isAdmin={isAdmin}
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


// =============================================================================
// LEAGUE SLOT DISPLAY
// Renders one league slot with its entries and (in edit mode) admin controls.
// =============================================================================

function LeagueSlotDisplay({
  slot,
  season,
  isAdmin,
  editMode,
  allTeams,
  onRefresh,
}: {
  slot: HistorySlot;
  season: HistorySeasonRow;
  isAdmin: boolean;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const hasEntries = slot.entries.length > 0;
  const showSlot = hasEntries || (editMode && isAdmin);
  if (!showSlot) return null;

  return (
    <div className="space-y-2">
      {/* Slot header with admin controls */}
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {slot.title}
          {slot.isHidden && (
            <span className="ml-2 text-amber-600 font-normal">(hidden)</span>
          )}
        </h4>
        {editMode && isAdmin && (
          <div className="flex items-center gap-1.5">
            {slot.sectionId && (
              <AdminHiddenToggle
                isHidden={slot.isHidden}
                onToggle={async (v) => {
                  await adminToggleSectionHidden(slot.sectionId!, v);
                  onRefresh();
                }}
                size="xs"
              />
            )}
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-1.5 py-0.5 text-xs rounded text-muted-foreground
                         hover:text-foreground hover:bg-muted transition-colors"
            >
              + Add Entry
            </button>
          </div>
        )}
      </div>

      {/* Existing entries */}
      <div className="space-y-2">
        {slot.entries.map((entry) => (
          <div key={entry.id} className="group">
            {editingEntryId === entry.id ? (
              <InlineEntryForm
                sectionId={slot.sectionId}
                entryId={entry.id}
                initialContent={entry.content}
                slotType={slot.slotType}
                slotTitle={slot.title}
                ownerType="league"
                ownerId={null}
                eraId={season.era_id}
                seasonId={season.id}
                referencedTeamIds={slot.referencedTeamIds}
                allTeams={allTeams}
                onSuccess={() => {
                  setEditingEntryId(null);
                  onRefresh();
                }}
                onCancel={() => setEditingEntryId(null)}
              />
            ) : (
              <div className="flex gap-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">
                  {entry.content}
                </p>
                {editMode && isAdmin && (
                  <div className="shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100
                                  transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditingEntryId(entry.id)}
                      className="px-1.5 py-0.5 text-xs rounded text-muted-foreground
                                 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add entry form */}
      {editMode && isAdmin && showAddForm && (
        <InlineEntryForm
          sectionId={slot.sectionId}
          slotType={slot.slotType}
          slotTitle={slot.title}
          ownerType="league"
          ownerId={null}
          eraId={season.era_id}
          seasonId={season.id}
          referencedTeamIds={slot.referencedTeamIds}
          allTeams={allTeams}
          onSuccess={() => {
            setShowAddForm(false);
            onRefresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Empty state in edit mode */}
      {!hasEntries && editMode && isAdmin && !showAddForm && (
        <p className="text-xs text-muted-foreground italic">
          No entries yet — use Add Entry above.
        </p>
      )}
    </div>
  );
}
