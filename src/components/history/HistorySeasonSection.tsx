// src/components/history/HistorySeasonSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { HistoryTeamSection } from "@/components/history/HistoryTeamSection";
import type {
  HistoryFilterState,
  TeamSeasonEntry,
  LeagueSeasonEntry,
  HistorySeasonRow,
} from "@/types/history";

// =============================================================================
// PROPS
// =============================================================================

interface HistorySeasonSectionProps {
  season: HistorySeasonRow;
  leagueEntry: LeagueSeasonEntry;
  /** One entry per team present in this season (may be a subset when filtered) */
  teamEntries: TeamSeasonEntry[];
  /** When true the accordion starts open — set by parent when this season is filtered */
  defaultOpen?: boolean;
  filters: HistoryFilterState;
  isAdmin: boolean;
  isHistorian: boolean;
  historianTeamId: string | null;
  onRefresh: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HistorySeasonSection({
  season,
  leagueEntry,
  teamEntries,
  defaultOpen = false,
  filters,
  isAdmin,
  isHistorian,
  historianTeamId,
  onRefresh,
}: HistorySeasonSectionProps) {
  // Seasons start collapsed unless the parent signals they should open
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Re-open if the season filter changes to match this season
  useEffect(() => {
    if (filters.seasonId === season.id) {
      setIsOpen(true);
    }
  }, [filters.seasonId, season.id]);

  // --------------------------------------------------------------------------
  // Determine whether the league entry has any visible content.
  // If all league slots are empty, we omit the league section from the UI.
  // --------------------------------------------------------------------------
  const hasLeagueContent = leagueEntry.slots.some(
    (slot) => slot.entries.length > 0 && !slot.isHidden
  );

  return (
    <div>
      {/* Season accordion header */}
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

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-base">{season.name}</span>

          {season.description && (
            <span className="text-sm text-muted-foreground truncate hidden sm:block">
              — {season.description}
            </span>
          )}

          {/* Link to the season's draft spreadsheet if one is stored */}
          {season.spreadsheet_url && (
            <a
              href={season.spreadsheet_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // don't toggle accordion
              className="ml-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
              title="View draft spreadsheet"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {!isOpen && (
          <span className="text-xs text-muted-foreground mr-1 shrink-0">
            {teamEntries.length}{" "}
            {teamEntries.length === 1 ? "team" : "teams"}
          </span>
        )}
      </button>

      {/* Season content */}
      {isOpen && (
        <div className="border-t">

          {/* --- League-level content for this season ---
              Rendered as a special section above team entries.
              Only shown if there is at least one non-empty league slot.
          */}
          {hasLeagueContent && (
            <LeagueSeasonContent leagueEntry={leagueEntry} isAdmin={isAdmin} />
          )}

          {/* --- Team entries ---
              One HistoryTeamSection per team that has content in this season.
              Teams are separated by a subtle divider.
          */}
          <div className="divide-y">
            {teamEntries.map((teamEntry) => {
              // Determine if this user can directly edit this team's content
              const canEdit =
                isAdmin ||
                (isHistorian && historianTeamId === teamEntry.teamId);

              // Highlight teams whose content was surfaced via cross-team filter
              const isCrossTeamSurfaced =
                !!filters.teamId &&
                filters.teamId !== teamEntry.teamId;

              return (
                <HistoryTeamSection
                  key={teamEntry.teamId}
                  teamEntry={teamEntry}
                  // Auto-expand the team whose filter is active,
                  // or auto-expand cross-team entries since the user filtered for them
                  defaultOpen={
                    filters.teamId === teamEntry.teamId || isCrossTeamSurfaced
                  }
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  isCrossTeamSurfaced={isCrossTeamSurfaced}
                  onRefresh={onRefresh}
                />
              );
            })}
          </div>

          {/* Empty state — no team content */}
          {teamEntries.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No team history has been written for this season yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// LEAGUE SEASON CONTENT
// Displays the league-level slots (cap rules, votes, etc.) for a season.
// Rendered above team entries when content exists.
// =============================================================================

function LeagueSeasonContent({
  leagueEntry,
  isAdmin,
}: {
  leagueEntry: LeagueSeasonEntry;
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const visibleSlots = leagueEntry.slots.filter(
    (slot) =>
      slot.entries.length > 0 && (isAdmin || !slot.isHidden)
  );

  if (visibleSlots.length === 0) return null;

  return (
    <div className="border-b bg-muted/20">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-6 py-2.5 text-left
                   hover:bg-muted/40 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          League Records
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-4 space-y-4">
          {visibleSlots.map((slot) => (
            <div key={slot.slotType}>
              <h4 className="text-xs font-semibold uppercase tracking-wider
                             text-muted-foreground mb-1.5">
                {slot.title}
              </h4>
              <div className="space-y-2">
                {slot.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                  >
                    {entry.content}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
