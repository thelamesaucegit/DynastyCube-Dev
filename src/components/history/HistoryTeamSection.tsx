// src/components/history/HistoryTeamSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { HistoryEntryRenderer } from "@/app/components/history/HistoryEntryRenderer";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import {
  InlineEntryForm,
  AdminHiddenToggle,
  AdminDeleteButton,
} from "@/components/history/HistoryAdminForms";
import {
  adminToggleSectionHidden,
  adminToggleEntryHidden,
  adminDeleteEntry,
} from "@/app/actions/historyActions";
import { TEAM_SLOT_SCHEMA } from "@/config/historySlotSchema";
import type { TeamSeasonEntry, HistorySlot, TeamBasic } from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistoryTeamSectionProps {
  teamEntry: TeamSeasonEntry;
  /** Needed to create new slot sections (adminUpsertSlotSection requires eraId) */
  eraId: string;
  /** Same as teamEntry.seasonId — passed explicitly for clarity */
  seasonId: string;
  defaultOpen?: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  /**
   * When true all slot types from TEAM_SLOT_SCHEMA are shown (including
   * empty ones) so the admin can add entries to any slot.
   * When false only slots with visible entries are shown.
   */
  editMode: boolean;
  /** All visible teams — used for referenced-team selection in cross-team slots */
  allTeams: TeamBasic[];
  /** True when this entry was surfaced by a cross-team filter */
  isCrossTeamSurfaced?: boolean;
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryTeamSection({
  teamEntry,
  eraId,
  seasonId,
  defaultOpen = false,
  canEdit,
  isAdmin,
  editMode,
  allTeams,
  isCrossTeamSurfaced = false,
  onRefresh,
}: HistoryTeamSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  // --------------------------------------------------------------------------
  // SLOT VISIBILITY RULES
  //
  // In read mode:  show only slots that have at least one visible entry.
  // In edit mode:  show ALL slots from TEAM_SLOT_SCHEMA so the admin can add
  //               content to currently empty slots.
  //
  // teamEntry.slots is always the full set from TEAM_SLOT_SCHEMA (guaranteed
  // by buildTeamSeasonEntry in historyActions). In edit mode we map over the
  // schema directly to ensure correct ordering even for slots with no DB record.
  // --------------------------------------------------------------------------

  const slotsToRender: HistorySlot[] = editMode
    ? TEAM_SLOT_SCHEMA.map((slotDef) => {
        const existing = teamEntry.slots.find(
          (s) => s.slotType === slotDef.type
        );
        // Return existing slot data, or a blank placeholder for empty slots
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
    : teamEntry.slots.filter(
        (s) => s.entries.length > 0 && (isAdmin || !s.isHidden)
      );

  return (
    <div>
      {/* Team accordion header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
                   hover:bg-muted/30 transition-colors"
      >
        {isOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <span className="font-semibold">
          {teamEntry.teamEmoji} {teamEntry.teamName}
        </span>

        {/* Cross-team badge */}
        {isCrossTeamSurfaced && (
          <span
            className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-xs
                       bg-primary/10 text-primary font-medium"
            title="This section references your selected team"
          >
            <Link2 className="h-3 w-3" />
            Referenced
          </span>
        )}

        {!isOpen && slotsToRender.filter((s) => s.entries.length > 0).length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground mr-1">
            {slotsToRender.filter((s) => s.entries.length > 0).length} sections
          </span>
        )}
      </button>

      {/* Team content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-2 space-y-6 border-t">
          {slotsToRender.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No history has been written for this team yet.
            </p>
          ) : (
            slotsToRender.map((slot) => (
              <TeamSlotDisplay
                key={slot.slotType}
                slot={slot}
                teamId={teamEntry.teamId}
                eraId={eraId}
                seasonId={seasonId}
                canEdit={canEdit}
                isAdmin={isAdmin}
                editMode={editMode}
                allTeams={allTeams}
                onRefresh={onRefresh}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// TEAM SLOT DISPLAY
// Renders one slot (e.g. "Draft Picks", "Championship") with its entries.
// In edit mode, shows admin controls for adding/editing/deleting entries and
// toggling slot visibility.
// =============================================================================
   const FLAVOR_SLOT_TYPES = new Set(["flavor_text"]);


function TeamSlotDisplay({
  slot,
  teamId,
  eraId,
  seasonId,
  canEdit,
  isAdmin,
  editMode,
  allTeams,
  onRefresh,
}: {
  slot: HistorySlot;
  teamId: string;
  eraId: string;
  seasonId: string;
  canEdit: boolean;
  isAdmin: boolean;
  editMode: boolean;
  allTeams: TeamBasic[];
  onRefresh: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const isFlavor = FLAVOR_SLOT_TYPES.has(slot.slotType);
  const hasEntries = slot.entries.length > 0;

  // In read mode, skip empty slots entirely.
  // In edit mode, always render so the admin can add entries.
  const shouldShow = hasEntries || (editMode && canEdit);
  if (!shouldShow) return null;

  return (
    <div className="space-y-2">
      {/*
        Slot label header.
        Flavor text slots get no label — the poem speaks for itself.
        In edit mode we always show the label so the admin knows which slot is which.
      */}
      {(!isFlavor || editMode) && (
        <div className="flex items-center gap-2">
          <h4 className={`text-xs font-semibold uppercase tracking-wider flex-1
            ${isFlavor ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
            {slot.title}
            {slot.isHidden && (
              <span className="ml-2 text-amber-600 font-normal">(hidden)</span>
            )}
          </h4>

          {/* Slot-level admin controls */}
          {editMode && canEdit && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Hide/show toggle — only available once the section exists in DB */}
              {slot.sectionId && isAdmin && (
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
      )}

      {/* Existing entries */}
      <div className={isFlavor ? "pl-4 border-l-2 border-muted" : "space-y-2"}>
        {slot.entries.map((entry) => (
          <div key={entry.id} className="group">
            {editingEntryId === entry.id ? (
              // Inline edit form for this specific entry
              <InlineEntryForm
                sectionId={slot.sectionId}
                entryId={entry.id}
                initialContent={entry.content}
                slotType={slot.slotType}
                slotTitle={slot.title}
                ownerType="team"
                ownerId={teamId}
                eraId={eraId}
                seasonId={seasonId}
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
                {/* Entry content */}
                <div className="flex-1">
                  <SlotEntryContent
                    content={entry.content}
                    isFlavor={isFlavor}
                    isHidden={entry.is_hidden}
                    showHiddenState={editMode && isAdmin}
                  />
                </div>

                {/*
                  Per-entry admin controls.
                  Visible on hover to keep the reading experience clean.
                  Admins get hide + delete; non-admin historians get edit only.
                */}
                {editMode && canEdit && (
                  <div className="shrink-0 flex items-start gap-1 pt-0.5
                                  opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditingEntryId(entry.id)}
                      className="px-1.5 py-0.5 text-xs rounded text-muted-foreground
                                 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <>
                        <AdminHiddenToggle
                          isHidden={entry.is_hidden}
                          onToggle={async (v) => {
                            await adminToggleEntryHidden(entry.id, v);
                            onRefresh();
                          }}
                          size="xs"
                        />
                        <AdminDeleteButton
                          label="Delete"
                          onConfirm={async () => {
                            await adminDeleteEntry(entry.id);
                            onRefresh();
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add entry form */}
      {editMode && canEdit && showAddForm && (
        <InlineEntryForm
          sectionId={slot.sectionId}
          slotType={slot.slotType}
          slotTitle={slot.title}
          ownerType="team"
          ownerId={teamId}
          eraId={eraId}
          seasonId={seasonId}
          referencedTeamIds={slot.referencedTeamIds}
          allTeams={allTeams}
          onSuccess={(newSectionId) => {
            setShowAddForm(false);
            onRefresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Empty slot placeholder in edit mode */}
      {!hasEntries && editMode && canEdit && !showAddForm && (
        <p className="text-xs text-muted-foreground italic pl-1">
          No entries yet — use Add Entry above.
        </p>
      )}
    </div>
  );
}


// =============================================================================
// SLOT ENTRY CONTENT
// Handles per-entry rendering with slot-type-specific formatting.
//
// ADDING A NEW FORMAT:
//   1. Add the slot type to the relevant set above (FLAVOR_SLOT_TYPES etc.)
//   2. Add an `isXxx` boolean derived from the slot type
//   3. Add a render branch below
//
// FUTURE: If content is migrated to Markdown, swap the <p> tags for a
// Markdown renderer component here — this is the only place to update.
// =============================================================================

// Slot types whose entries get the flavor text (italic, border-left) visual treatment.
   // The markdown renderer handles the text itself — this only controls the wrapper style.

   function SlotEntryContent({
     content,
     isFlavor,
     isHidden,
     showHiddenState,
   }: {
     content: string;
     isFlavor: boolean;
     isHidden: boolean;
     showHiddenState: boolean;
   }) {
     const hiddenStyle = showHiddenState && isHidden ? "opacity-40" : "";
     return (
       <div className={hiddenStyle}>
         <HistoryEntryRenderer content={content} />
       </div>
     );
   }
