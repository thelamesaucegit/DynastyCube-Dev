// src/types/history.ts
// =============================================================================
// HISTORY SYSTEM TYPES
// =============================================================================
// Single source of truth for all TypeScript types used by the history system.
//
// SECTIONS:
//   1. Slot type aliases (imported from schema config)
//   2. Database row types (mirror Supabase table shapes exactly)
//   3. Enriched / composed UI types (what components consume)
//   4. Filter and view state
//   5. Legacy re-exports (backward compat with existing components)
// =============================================================================

import type { TeamSlotType, LeagueSlotType } from "@/config/historySlotSchema";

// Re-export slot types so consumers only need to import from this file
export type { TeamSlotType, LeagueSlotType };

/** Union of all possible slot type strings */
export type SlotType = TeamSlotType | LeagueSlotType;

// =============================================================================
// 1. DATABASE ROW TYPES
// These mirror the Supabase table column shapes exactly.
// Use these when reading from or writing to the database directly.
// =============================================================================

export interface HistoryEraRow {
  id: string;
  name: string;
  display_order: number;
  description: string | null;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistorySeasonRow {
  id: string;
  era_id: string;
  name: string;
  display_order: number;
  spreadsheet_url: string | null;
  description: string | null;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistorySectionRow {
  id: string;
  owner_type: "team" | "league";
  owner_id: string | null;
  era_id: string | null;
  season_id: string | null;
  // Maps to a slot type from historySlotSchema.ts.
  // null for legacy sections created before the slot system.
  slot_type: SlotType | null;
  title: string;
  display_order: number;
  // Team IDs referenced/mentioned in this section (for cross-team filtering)
  referenced_team_ids: string[];
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntryRow {
  id: string;
  section_id: string;
  content: string;
  display_order: number;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// 2. ENRICHED / COMPOSED UI TYPES
// These are assembled by historyActions.ts and consumed directly by components.
// They represent the fully composed hierarchy, not raw DB rows.
// =============================================================================

/**
 * A single slot in a team or league history entry.
 *
 * Each slot corresponds to one entry in TEAM_SLOT_SCHEMA or LEAGUE_SLOT_SCHEMA.
 * If a slot has no DB record yet, sectionId is null and entries is [].
 * Empty slots (no entries) are hidden in the UI but always present in the data
 * so that cross-team slot positioning stays consistent.
 */
export interface HistorySlot {
  // null when this slot type exists in the schema but has no DB record yet
  sectionId: string | null;
  slotType: SlotType;
  // Human-readable label from the slot schema (e.g. "Championship")
  title: string;
  entries: HistoryEntryRow[];
  // Team IDs referenced in this slot (drives cross-team filter surfacing)
  referencedTeamIds: string[];
  isHidden: boolean;
  // The order value from the slot schema definition
  displayOrder: number;
}

/**
 * All slots for a single team within a single season.
 * Slots are always ordered per TEAM_SLOT_SCHEMA regardless of DB display_order.
 */
export interface TeamSeasonEntry {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  seasonId: string;
  // Always contains the full set of slots from TEAM_SLOT_SCHEMA.
  // Slots with no content have sectionId: null and entries: [].
  slots: HistorySlot[];
}

/**
 * All league-level slots for a single season.
 * Slots are always ordered per LEAGUE_SLOT_SCHEMA.
 */
export interface LeagueSeasonEntry {
  seasonId: string;
  slots: HistorySlot[];
}

/**
 * A fully composed season, ready for the UI to render.
 * Contains the season metadata, league-level content, and all team entries.
 */
export interface ComposedSeason {
  season: HistorySeasonRow;
  leagueEntry: LeagueSeasonEntry;
  // One entry per team that has any content in this season.
  // When a team filter is active, this may include teams whose content was
  // surfaced via the cross-team reference system.
  teamEntries: TeamSeasonEntry[];
}

/**
 * A fully composed era, ready for the UI to render.
 */
export interface ComposedEra {
  era: HistoryEraRow;
  seasons: ComposedSeason[];
}

// =============================================================================
// 3. FILTER AND VIEW STATE
// Used by the history page to track active filter selections and view mode.
// =============================================================================

/**
 * The three independent filter dropdowns on the history page.
 * null in any field means "All" (no filter applied for that dimension).
 */
export interface HistoryFilterState {
  eraId: string | null;
  seasonId: string | null;
  teamId: string | null;
}

/**
 * Controls the inner hierarchy order when no filters conflict.
 *   season-first: Era > Season > Team  (default)
 *   team-first:   Era > Team > Season
 */
export type ViewMode = "season-first" | "team-first";

// =============================================================================
// 4. SUPPORTING TYPES
// =============================================================================

export interface TeamBasic {
  id: string;
  name: string;
  emoji: string;
  is_hidden: boolean;
}

export interface HistorianUser {
  user_id: string;
  display_name: string;
  team_name: string;
  team_emoji: string;
}

// =============================================================================
// 5. LEGACY TYPES
// Kept for backward compatibility with existing components until they are
// rewritten. Do not use these in new code.
// =============================================================================

/** @deprecated Use HistorySectionRow instead */
export interface HistorySection {
  id: string;
  owner_type: "team" | "league";
  owner_id: string | null;
  title: string;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  entries?: HistoryEntryRow[];
}

/** @deprecated Use HistoryEntryRow instead */
export type HistoryEntry = HistoryEntryRow;

export interface HistoryUpdateRequest {
  id: string;
  requester_id: string;
  request_type: "append_entry" | "new_section";
  target_owner_type: "team" | "league";
  target_owner_id: string | null;
  target_section_id: string | null;
  proposed_title: string | null;
  proposed_content: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields populated by getAllHistoryRequests
  requester_display_name?: string;
  target_section_title?: string;
  target_team_name?: string;
}
