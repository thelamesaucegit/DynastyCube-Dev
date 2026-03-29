// src/config/historySlotSchema.ts
// =============================================================================
// HISTORY SLOT SCHEMA — SINGLE SOURCE OF TRUTH
// =============================================================================
// This file defines every possible "slot" that can appear in a team or league
// history entry for a given season.
//
// ─── TO ADD A NEW SLOT ────────────────────────────────────────────────────────
//  1. Add the string literal to TEAM_SLOT_TYPES or LEAGUE_SLOT_TYPES below.
//  2. Add a SlotDefinition entry to TEAM_SLOT_SCHEMA or LEAGUE_SLOT_SCHEMA.
//  3. Choose an `order` value (gaps are intentional — use one that slots it
//     into the right position without renumbering everything else).
//  4. Set crossTeamSurfaceable: true if the slot typically names an opposing
//     team (e.g. a postseason matchup or championship result).
//  5. No database migration is required — slot_type is stored as plain text.
// ─────────────────────────────────────────────────────────────────────────────
//
// ─── SLOT ORDERING ────────────────────────────────────────────────────────────
//  The `order` field controls display position within a team or league entry.
//  Lower numbers appear first. Team and league slots have independent ordering
//  (a team slot with order: 0 and a league slot with order: 0 do not conflict).
//  Gaps of 10 between slots allow future insertions without renumbering.
// ─────────────────────────────────────────────────────────────────────────────
//
// ─── CROSS-TEAM SURFACING ─────────────────────────────────────────────────────
//  When a user applies a Team filter, the page surfaces:
//    a) All sections owned by that team.
//    b) Sections owned by OTHER teams that reference this team in
//       referenced_team_ids — but ONLY if the slot is crossTeamSurfaceable.
//  Set crossTeamSurfaceable: true for any slot that describes a head-to-head
//  event (postseason matchups, championship, etc.).
// ─────────────────────────────────────────────────────────────────────────────


// =============================================================================
// TEAM SLOT TYPES
// Each string here is a valid value for slot_type on a team-owned
// history_section row.
// =============================================================================

export const TEAM_SLOT_TYPES = [
  "flavor_text",    // Haiku, poem, or flavour quote at the top of the entry
  "narrative",      // Team's prose story for the season
  "draft_picks",    // Draft pick number, first 5 picks, and final deck colour(s)
  "regular_season", // Regular season record, seed, and notable notes
  "postseason_r1",  // First round postseason matchup result
  "postseason_r2",  // Second round (semi-final) postseason matchup result
  "postseason_r3",  // Third round postseason matchup (if bracket requires it)
  "championship",   // Championship match result
  "awards",         // Champion's Trophy, blessings, or other end-of-season awards
] as const;

export type TeamSlotType = (typeof TEAM_SLOT_TYPES)[number];


// =============================================================================
// LEAGUE SLOT TYPES
// Each string here is a valid value for slot_type on a league-owned
// history_section row (owner_type = "league", owner_id = null).
// =============================================================================

export const LEAGUE_SLOT_TYPES = [
  "season_overview",  // High-level narrative overview of the season
  "cap_rules",        // The cap amount and any rule changes for this season
  "votes",            // All league votes taken during or after the season
  "draft_rules",      // Draft-specific rule changes or notable draft events
  "notable_trades",   // First trade of the season and other historically notable trades
] as const;

export type LeagueSlotType = (typeof LEAGUE_SLOT_TYPES)[number];


// =============================================================================
// SLOT DEFINITION INTERFACE
// Every entry in TEAM_SLOT_SCHEMA and LEAGUE_SLOT_SCHEMA must satisfy this.
// =============================================================================

export interface SlotDefinition {
  /**
   * The unique string key for this slot.
   * Stored as slot_type in history_sections.
   */
  type: TeamSlotType | LeagueSlotType;

  /**
   * Human-readable label displayed in the UI
   * (e.g. the accordion header for this slot).
   */
  label: string;

  /**
   * Display position within the team or league entry.
   * Lower = shown first. Use gaps of 10 to allow future insertions.
   * Team and league slots have independent ordering.
   */
  order: number;

  /**
   * When true, this slot is surfaced under a team that is REFERENCED
   * (not the owner) in the section's referenced_team_ids array.
   *
   * Set this to true for any slot that describes a head-to-head event
   * where both teams should see the record in their filtered view.
   */
  crossTeamSurfaceable: boolean;

  /**
   * Developer note explaining what content belongs in this slot.
   * Not displayed in the UI — exists purely for code maintainability.
   */
  description: string;
}


// =============================================================================
// TEAM SLOT SCHEMA
// The canonical ordered list of slots for every team's history entry.
// Components and server actions import this to build the full slot structure.
// =============================================================================

export const TEAM_SLOT_SCHEMA: SlotDefinition[] = [
  {
    type: "flavor_text",
    label: "Season Flavor",
    order: 0,
    crossTeamSurfaceable: false,
    description:
      "A haiku, poem, or flavour quote written from the team's perspective. " +
      "Displayed at the very top of the team entry before any prose.",
  },
  {
    type: "narrative",
    label: "Season Narrative",
    order: 10,
    crossTeamSurfaceable: false,
    description:
      "The team's prose story for the season — their journey, key decisions, " +
      "memorable moments, and overall arc.",
  },
  {
    type: "draft_picks",
    label: "Draft Picks",
    order: 20,
    crossTeamSurfaceable: false,
    description:
      "The team's draft pick number in The Draft, their first 5 picks in order, " +
      "and the final deck colour(s) they ended up with.",
  },
  {
    type: "regular_season",
    label: "Regular Season",
    order: 30,
    crossTeamSurfaceable: false,
    description:
      "The team's regular season record (match W-L, game W-L), their final seed, " +
      "and any notable notes about their regular season performance.",
  },
  {
    type: "postseason_r1",
    label: "Postseason — Round 1",
    order: 40,
    crossTeamSurfaceable: true,
    description:
      "The team's first round postseason matchup result, including opponent and score. " +
      "crossTeamSurfaceable: also appears when filtering to the opposing team.",
  },
  {
    type: "postseason_r2",
    label: "Postseason — Round 2",
    order: 50,
    crossTeamSurfaceable: true,
    description:
      "The team's second round (semi-final) postseason matchup result. " +
      "crossTeamSurfaceable: also appears when filtering to the opposing team.",
  },
  {
    type: "postseason_r3",
    label: "Postseason — Round 3",
    order: 60,
    crossTeamSurfaceable: true,
    description:
      "A third postseason round if the bracket structure requires it. " +
      "crossTeamSurfaceable: also appears when filtering to the opposing team.",
  },
  {
    type: "championship",
    label: "Championship",
    order: 70,
    crossTeamSurfaceable: true,
    description:
      "The championship match result. " +
      "crossTeamSurfaceable: appears under both the champion and the runner-up.",
  },
  {
    type: "awards",
    label: "Awards & Blessings",
    order: 80,
    crossTeamSurfaceable: false,
    description:
      "The Champion's Trophy, any league-voted blessings, or other end-of-season " +
      "awards bestowed on or voted for by this team.",
  },
];


// =============================================================================
// LEAGUE SLOT SCHEMA
// The canonical ordered list of slots for league-level content within a season.
// =============================================================================

export const LEAGUE_SLOT_SCHEMA: SlotDefinition[] = [
  {
    type: "season_overview",
    label: "Season Overview",
    order: 0,
    crossTeamSurfaceable: false,
    description:
      "A high-level narrative overview of the season written from the league perspective.",
  },
  {
    type: "cap_rules",
    label: "Cap & Rules",
    order: 10,
    crossTeamSurfaceable: false,
    description:
      "The cap amount set for this season and any rule changes enacted before or during it.",
  },
  {
    type: "votes",
    label: "League Votes",
    order: 20,
    crossTeamSurfaceable: false,
    description:
      "All votes the league took during or after the season, including the result of each vote.",
  },
  {
    type: "draft_rules",
    label: "Draft Rules",
    order: 30,
    crossTeamSurfaceable: false,
    description:
      "Draft-specific rule changes (day/night time rules, new roles, etc.) or " +
      "notable events that occurred during The Draft.",
  },
  {
    type: "notable_trades",
    label: "Notable Trades",
    order: 40,
    crossTeamSurfaceable: false,
    description:
      "The first completed trade of the season and any other historically significant trades.",
  },
];


// =============================================================================
// CONVENIENCE LOOKUPS
// Pre-built for O(1) access — import these instead of calling .find() on the
// schema arrays in hot paths.
// =============================================================================

/**
 * Look up any SlotDefinition by its type string.
 * e.g. SLOT_DEFINITION_MAP.get("championship")
 */
export const SLOT_DEFINITION_MAP = new Map<
  TeamSlotType | LeagueSlotType,
  SlotDefinition
>([
  ...TEAM_SLOT_SCHEMA.map(
    (s): [TeamSlotType | LeagueSlotType, SlotDefinition] => [s.type, s]
  ),
  ...LEAGUE_SLOT_SCHEMA.map(
    (s): [TeamSlotType | LeagueSlotType, SlotDefinition] => [s.type, s]
  ),
]);

/**
 * Set of all slot types that should be surfaced when filtering by a
 * referenced (non-owner) team. Used in the cross-team query logic in
 * historyActions.ts.
 */
export const CROSS_TEAM_SURFACEABLE_SLOTS = new Set<TeamSlotType | LeagueSlotType>(
  [...TEAM_SLOT_SCHEMA, ...LEAGUE_SLOT_SCHEMA]
    .filter((s) => s.crossTeamSurfaceable)
    .map((s) => s.type)
);

/**
 * Sorted array version of CROSS_TEAM_SURFACEABLE_SLOTS, ready to pass
 * directly into a Supabase `.in()` filter without conversion.
 */
export const CROSS_TEAM_SURFACEABLE_SLOT_ARRAY = Array.from(
  CROSS_TEAM_SURFACEABLE_SLOTS
);
