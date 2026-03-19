// src/components/history/HistoryTeamSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import type { TeamSeasonEntry, HistorySlot } from "@/types/history";
import { TEAM_SLOT_SCHEMA } from "@/config/historySlotSchema";

// =============================================================================
// PROPS
// =============================================================================

interface HistoryTeamSectionProps {
  teamEntry: TeamSeasonEntry;
  /** When true the accordion starts open */
  defaultOpen?: boolean;
  /** When true this user can directly edit this team's content */
  canEdit: boolean;
  isAdmin: boolean;
  /**
   * When true, this team entry was surfaced by a cross-team filter
   * (i.e. it's not the primary filtered team, but references it).
   * Used to add a subtle visual indicator so the user understands why it appeared.
   */
  isCrossTeamSurfaced?: boolean;
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistoryTeamSection({
  teamEntry,
  defaultOpen = false,
  canEdit,
  isAdmin,
  isCrossTeamSurfaced = false,
  onRefresh,
}: HistoryTeamSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Sync open state if defaultOpen changes (e.g. filter applied after mount)
  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  // --------------------------------------------------------------------------
  // Visible slots: filter out empty slots and hidden slots (for non-admins).
  // Empty slots still exist in teamEntry.slots (the schema guarantees this)
  // but we never render them — they only matter for positional logic.
  // Slots are always in TEAM_SLOT_SCHEMA order because buildTeamSeasonEntry
  // in historyActions maps over the schema array directly.
  // --------------------------------------------------------------------------

  const visibleSlots = teamEntry.slots.filter(
    (slot) => slot.entries.length > 0 && (isAdmin || !slot.isHidden)
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
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="font-semibold">
          {teamEntry.teamEmoji} {teamEntry.teamName}
        </span>

        {/* Badge shown when this entry was surfaced via cross-team reference */}
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

        {!isOpen && visibleSlots.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground mr-1">
            {visibleSlots.length}{" "}
            {visibleSlots.length === 1 ? "section" : "sections"}
          </span>
        )}
      </button>

      {/* Team content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-6 border-t">
          {visibleSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No history has been written for this team yet.
            </p>
          ) : (
            visibleSlots.map((slot) => (
              <HistorySlotDisplay
                key={slot.slotType}
                slot={slot}
                canEdit={canEdit}
                isAdmin={isAdmin}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// HISTORY SLOT DISPLAY
// Renders the content of one slot (e.g. "Flavor Text", "Draft Picks").
// Each slot type has its own visual treatment defined here.
// =============================================================================

// Slot types that get a special italic/poem treatment
const FLAVOR_SLOT_TYPES = new Set(["flavor_text"]);

// Slot types that render as a simple list rather than prose
// (Extend this set if a new slot type warrants list rendering)
const LIST_SLOT_TYPES = new Set(["draft_picks"]);

function HistorySlotDisplay({
  slot,
  canEdit,
  isAdmin,
}: {
  slot: HistorySlot;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const isFlavor = FLAVOR_SLOT_TYPES.has(slot.slotType);
  const isList = LIST_SLOT_TYPES.has(slot.slotType);

  return (
    <div className="space-y-2">
      {/*
        Slot label header.
        Flavor text slots get no label — the poem/haiku speaks for itself.
        All other slots show their TEAM_SLOT_SCHEMA label.
      */}
      {!isFlavor && (
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {slot.title}
        </h4>
      )}

      {/* Slot entries */}
      <div className={isFlavor ? "pl-4 border-l-2 border-muted" : ""}>
        {slot.entries.map((entry) => (
          <SlotEntryContent
            key={entry.id}
            content={entry.content}
            isFlavor={isFlavor}
            isList={isList}
          />
        ))}
      </div>
    </div>
  );
}


// =============================================================================
// SLOT ENTRY CONTENT
// Handles per-entry rendering. Content is stored as plain text in the DB.
//
// FUTURE: If content is migrated to Markdown or rich text, update the
// rendering here (e.g. swap the <p> for a Markdown renderer component).
//
// Adding a new content format:
//   1. Add a new `isXxx` boolean prop (or detect by slot type)
//   2. Add a branch in the render below
// =============================================================================

function SlotEntryContent({
  content,
  isFlavor,
  isList,
}: {
  content: string;
  isFlavor: boolean;
  isList: boolean;
}) {
  if (isFlavor) {
    // Haiku / poem: italic, preserve line breaks, subtle indent
    return (
      <p className="text-sm italic leading-relaxed whitespace-pre-line text-muted-foreground">
        {content}
      </p>
    );
  }

  if (isList) {
    // Draft picks etc.: split on newlines and render as a compact list
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    return (
      <ul className="space-y-0.5">
        {lines.map((line, i) => (
          <li key={i} className="text-sm flex gap-2">
            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
            <span>{line.trim().replace(/^[-•]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Default: prose paragraph, preserving intentional line breaks
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  );
}
