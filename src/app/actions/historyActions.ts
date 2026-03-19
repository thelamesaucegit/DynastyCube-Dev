// src/app/actions/historyActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  TEAM_SLOT_SCHEMA,
  LEAGUE_SLOT_SCHEMA,
  CROSS_TEAM_SURFACEABLE_SLOT_ARRAY,
} from "@/config/historySlotSchema";
import type {
  HistoryEraRow,
  HistorySeasonRow,
  HistorySectionRow,
  HistoryEntryRow,
  HistorySlot,
  TeamSeasonEntry,
  LeagueSeasonEntry,
  ComposedSeason,
  ComposedEra,
  HistoryFilterState,
  TeamBasic,
} from "@/types/history";

// Re-export types that existing components still import from this file
export type {
  HistoryEraRow,
  HistorySeasonRow,
  HistorySectionRow,
  HistoryEntryRow,
  HistorySlot,
  TeamSeasonEntry,
  LeagueSeasonEntry,
  ComposedSeason,
  ComposedEra,
  HistoryFilterState,
  TeamBasic,
};

// Legacy type exports — keep until existing components are rewritten
export type { HistorySection, HistoryEntry, HistoryUpdateRequest, HistorianUser } from "@/types/history";


// =============================================================================
// SUPABASE CLIENT
// =============================================================================

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  );
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/** Returns true if the authenticated user has is_admin = true */
async function isUserAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();
  return data?.is_admin ?? false;
}

/** Returns true if userId holds the "historian" role for the given teamId */
async function isUserHistorianForTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  teamId: string
): Promise<boolean> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  if (!membership) return false;

  const { data: role } = await supabase
    .from("team_member_roles")
    .select("id")
    .eq("team_member_id", membership.id)
    .eq("role", "historian")
    .single();

  return !!role;
}

/**
 * Returns the team ID for which the user holds the historian role,
 * or null if they hold no such role.
 */
async function getUserTeamAsHistorian(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: memberships } = await supabase
    .from("team_members")
    .select("id, team_id")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return null;

  for (const membership of memberships) {
    const { data: role } = await supabase
      .from("team_member_roles")
      .select("id")
      .eq("team_member_id", membership.id)
      .eq("role", "historian")
      .single();

    if (role) return membership.team_id;
  }

  return null;
}

// =============================================================================
// PRIVATE: SECTION SELECT STRING
// One place to update if history_sections columns change.
// =============================================================================

const SECTION_SELECT = `
  id, owner_type, owner_id, era_id, season_id, slot_type, title,
  display_order, referenced_team_ids, is_hidden, created_by, created_at, updated_at,
  history_entries (
    id, section_id, content, display_order, is_hidden, created_by, created_at, updated_at
  )
`;

// =============================================================================
// PRIVATE: COMPOSITION HELPERS
// These build the strongly-typed UI objects from raw DB rows.
// They are pure functions — no DB calls.
// =============================================================================

type SectionWithEntries = HistorySectionRow & { entries: HistoryEntryRow[] };

/**
 * Builds a LeagueSeasonEntry from all sections belonging to a season.
 * Maps each LEAGUE_SLOT_SCHEMA entry to a HistorySlot.
 * Slots with no DB record get sectionId: null and entries: [].
 */
function buildLeagueSeasonEntry(
  seasonId: string,
  allSeasonSections: SectionWithEntries[]
): LeagueSeasonEntry {
  const leagueSections = allSeasonSections.filter(
    (s) => s.owner_type === "league" && s.season_id === seasonId
  );

  const slots: HistorySlot[] = LEAGUE_SLOT_SCHEMA.map((slotDef) => {
    const section = leagueSections.find((s) => s.slot_type === slotDef.type);
    return {
      sectionId: section?.id ?? null,
      slotType: slotDef.type,
      title: slotDef.label,
      entries: section?.entries ?? [],
      referencedTeamIds: [],
      isHidden: section?.is_hidden ?? false,
      displayOrder: slotDef.order,
    };
  });

  return { seasonId, slots };
}

/**
 * Builds a TeamSeasonEntry for one team within one season.
 * Maps each TEAM_SLOT_SCHEMA entry to a HistorySlot.
 * Slots with no DB record get sectionId: null and entries: [].
 *
 * The slot order always follows TEAM_SLOT_SCHEMA regardless of DB display_order,
 * so cross-team events snap into the correct positional slot automatically.
 */
function buildTeamSeasonEntry(
  team: TeamBasic,
  seasonId: string,
  allSeasonSections: SectionWithEntries[]
): TeamSeasonEntry {
  // Only sections owned by this team for this season
  const teamSections = allSeasonSections.filter(
    (s) => s.owner_id === team.id && s.season_id === seasonId
  );

  const slots: HistorySlot[] = TEAM_SLOT_SCHEMA.map((slotDef) => {
    const section = teamSections.find((s) => s.slot_type === slotDef.type);
    return {
      sectionId: section?.id ?? null,
      slotType: slotDef.type,
      title: slotDef.label,
      entries: section?.entries ?? [],
      referencedTeamIds: section?.referenced_team_ids ?? [],
      isHidden: section?.is_hidden ?? false,
      displayOrder: slotDef.order,
    };
  });

  return {
    teamId: team.id,
    teamName: team.name,
    teamEmoji: team.emoji,
    seasonId,
    slots,
  };
}

// =============================================================================
// PRIVATE: SECTION FETCHER
// Handles the cross-team filter logic by running two separate queries
// (own sections + referenced sections) and deduplicating the results.
// Using two queries is intentional — it avoids brittle PostgREST OR+AND
// combinations with array operators.
// =============================================================================

async function fetchSectionsForComposition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seasonIds: string[],
  filters: HistoryFilterState,
  isAdmin: boolean
): Promise<SectionWithEntries[]> {
  if (seasonIds.length === 0) return [];

  // Shared base builder: filter by season and hidden status
  function base() {
    let q = supabase
      .from("history_sections")
      .select(SECTION_SELECT)
      .in("season_id", seasonIds);
    if (!isAdmin) q = q.eq("is_hidden", false);
    return q;
  }

  let rawSections: any[] = [];

  if (filters.teamId) {
    // Query A: sections OWNED by the filtered team
    const { data: owned, error: e1 } = await base()
      .eq("owner_type", "team")
      .eq("owner_id", filters.teamId);
    if (e1) throw e1;

    // Query B: cross-team sections that REFERENCE the filtered team.
    // Only surfaces slot types marked crossTeamSurfaceable in the schema
    // (e.g. postseason_r1, championship — not flavor_text or narrative).
    const { data: referenced, error: e2 } = await base()
      .in("slot_type", CROSS_TEAM_SURFACEABLE_SLOT_ARRAY)
      .contains("referenced_team_ids", [filters.teamId]);
    if (e2) throw e2;

    // Deduplicate by section id (a section could theoretically appear in both)
    const seen = new Set<string>();
    for (const s of [...(owned ?? []), ...(referenced ?? [])]) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        rawSections.push(s);
      }
    }
  } else {
    // No team filter — fetch all sections across all seasons
    const { data, error } = await base();
    if (error) throw error;
    rawSections = data ?? [];
  }

  // Attach entries to each section, filtering hidden for non-admins
  return rawSections.map((section) => ({
    ...section,
    entries: (section.history_entries ?? [])
      .filter((e: HistoryEntryRow) => isAdmin || !e.is_hidden)
      .sort(
        (a: HistoryEntryRow, b: HistoryEntryRow) =>
          a.display_order - b.display_order
      ),
  }));
}


// =============================================================================
// PUBLIC: PRIMARY COMPOSED HISTORY FETCH
// This is the main data function called by the history page.
// It returns the full Era > Season > Team hierarchy, pre-composed for the UI.
// =============================================================================

/**
 * Fetches and composes the full history hierarchy based on the given filters.
 *
 * Filter logic:
 *   - eraId: only include that era (and its seasons/teams)
 *   - seasonId: only include that season (still grouped under its era)
 *   - teamId: include sections owned by that team, PLUS cross-team surfaceable
 *     sections from other teams that reference this team
 *
 * When no filters are set, the full visible history is returned.
 */
export async function getComposedHistory(
  filters: HistoryFilterState
): Promise<{ eras: ComposedEra[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Determine admin status — admins see hidden content
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = user ? await isUserAdmin(supabase, user.id) : false;

    // --- STEP 1: FETCH ERAS ---
    let erasQuery = supabase
      .from("history_eras")
      .select("*")
      .order("display_order", { ascending: true });
    if (!isAdmin) erasQuery = erasQuery.eq("is_hidden", false);
    if (filters.eraId) erasQuery = erasQuery.eq("id", filters.eraId);

    const { data: eras, error: erasError } = await erasQuery;
    if (erasError) throw erasError;
    if (!eras || eras.length === 0) return { eras: [] };

    const eraIds = eras.map((e) => e.id);

    // --- STEP 2: FETCH SEASONS ---
    let seasonsQuery = supabase
      .from("history_seasons")
      .select("*")
      .in("era_id", eraIds)
      .order("display_order", { ascending: true });
    if (!isAdmin) seasonsQuery = seasonsQuery.eq("is_hidden", false);
    if (filters.seasonId) seasonsQuery = seasonsQuery.eq("id", filters.seasonId);

    const { data: seasons, error: seasonsError } = await seasonsQuery;
    if (seasonsError) throw seasonsError;
    if (!seasons || seasons.length === 0) return { eras: [] };

    const seasonIds = seasons.map((s) => s.id);

    // --- STEP 3: FETCH SECTIONS WITH ENTRIES ---
    // Handles cross-team filter logic internally (see fetchSectionsForComposition)
    const sections = await fetchSectionsForComposition(
      supabase,
      seasonIds,
      filters,
      isAdmin
    );

    // --- STEP 4: FETCH TEAMS ---
    // Build a map of all teams that appear as owners in the fetched sections,
    // plus (for the team filter case) teams referenced by cross-team sections.
    const ownerTeamIds = [
      ...new Set(
        sections
          .filter((s) => s.owner_type === "team" && s.owner_id)
          .map((s) => s.owner_id!)
      ),
    ];

    let teamMap = new Map<string, TeamBasic>();

    if (ownerTeamIds.length > 0) {
      let teamsQuery = supabase
        .from("teams")
        .select("id, name, emoji, is_hidden")
        .in("id", ownerTeamIds);
      if (!isAdmin) teamsQuery = teamsQuery.eq("is_hidden", false);

      const { data: teamsData, error: teamsError } = await teamsQuery;
      if (teamsError) throw teamsError;
      teamMap = new Map((teamsData ?? []).map((t) => [t.id, t]));
    }

    // --- STEP 5: COMPOSE THE HIERARCHY ---
    const composedEras: ComposedEra[] = eras.map((era) => {
      const eraSeasons = seasons.filter((s) => s.era_id === era.id);

      const composedSeasons: ComposedSeason[] = eraSeasons.map((season) => {
        const seasonSections = sections.filter(
          (s) => s.season_id === season.id
        );

        // League entry: uses LEAGUE_SLOT_SCHEMA ordering
        const leagueEntry = buildLeagueSeasonEntry(season.id, seasonSections);

        // Determine which teams appear in this season (have at least one section)
        const teamIdsInSeason = [
          ...new Set(
            seasonSections
              .filter((s) => s.owner_type === "team" && s.owner_id)
              .map((s) => s.owner_id!)
          ),
        ];

        // Build one TeamSeasonEntry per team that appears in this season
        const teamEntries: TeamSeasonEntry[] = teamIdsInSeason
          .map((teamId) => {
            const team = teamMap.get(teamId);
            // Skip teams hidden from this user
            if (!team) return null;
            return buildTeamSeasonEntry(team, season.id, seasonSections);
          })
          .filter((entry): entry is TeamSeasonEntry => entry !== null);

        return { season, leagueEntry, teamEntries };
      });

      return { era, seasons: composedSeasons };
    });

    return { eras: composedEras };
  } catch (error) {
    console.error("Unexpected error in getComposedHistory:", error);
    return { eras: [], error: "An unexpected error occurred" };
  }
}


// =============================================================================
// PUBLIC: FILTER OPTIONS
// Lightweight fetches for populating the three filter dropdowns on the page.
// =============================================================================

/**
 * Returns all visible eras and their seasons for the filter dropdowns.
 * Admins see hidden eras/seasons; other users do not.
 */
export async function getErasAndSeasonsForFilters(): Promise<{
  eras: (HistoryEraRow & { seasons: HistorySeasonRow[] })[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = user ? await isUserAdmin(supabase, user.id) : false;

    let erasQuery = supabase
      .from("history_eras")
      .select("*")
      .order("display_order", { ascending: true });
    if (!isAdmin) erasQuery = erasQuery.eq("is_hidden", false);

    const { data: eras, error: erasError } = await erasQuery;
    if (erasError) throw erasError;

    if (!eras || eras.length === 0) return { eras: [] };

    let seasonsQuery = supabase
      .from("history_seasons")
      .select("*")
      .in("era_id", eras.map((e) => e.id))
      .order("display_order", { ascending: true });
    if (!isAdmin) seasonsQuery = seasonsQuery.eq("is_hidden", false);

    const { data: seasons, error: seasonsError } = await seasonsQuery;
    if (seasonsError) throw seasonsError;

    const result = eras.map((era) => ({
      ...era,
      seasons: (seasons ?? []).filter((s) => s.era_id === era.id),
    }));

    return { eras: result };
  } catch (error) {
    console.error("Unexpected error in getErasAndSeasonsForFilters:", error);
    return { eras: [], error: "An unexpected error occurred" };
  }
}

/**
 * Returns the teams list for the Team filter dropdown.
 * Admins see hidden teams; other users only see teams where is_hidden = false.
 *
 * NOTE: This replaces the old getTeamsWithHistory() which did not filter
 * by is_hidden. The old function is kept below for backward compatibility.
 */
export async function getTeamsForFilter(): Promise<{
  teams: TeamBasic[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isAdmin = user ? await isUserAdmin(supabase, user.id) : false;

    let query = supabase
      .from("teams")
      .select("id, name, emoji, is_hidden")
      .order("name");
    if (!isAdmin) query = query.eq("is_hidden", false);

    const { data, error } = await query;
    if (error) throw error;

    return { teams: data ?? [] };
  } catch (error) {
    console.error("Unexpected error in getTeamsForFilter:", error);
    return { teams: [], error: "An unexpected error occurred" };
  }
}


// =============================================================================
// PUBLIC: CURRENT USER INFO
// Unchanged from original — used by the page to determine edit permissions.
// =============================================================================

export async function getCurrentUserHistorianInfo(): Promise<{
  isHistorian: boolean;
  historianTeamId: string | null;
  isAdmin: boolean;
  userId: string | null;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isHistorian: false, historianTeamId: null, isAdmin: false, userId: null };
    }

    const admin = await isUserAdmin(supabase, user.id);
    const teamId = await getUserTeamAsHistorian(supabase, user.id);

    return {
      isHistorian: !!teamId,
      historianTeamId: teamId,
      isAdmin: admin,
      userId: user.id,
    };
  } catch (error) {
    console.error("Unexpected error in getCurrentUserHistorianInfo:", error);
    return {
      isHistorian: false,
      historianTeamId: null,
      isAdmin: false,
      userId: null,
      error: "An unexpected error occurred",
    };
  }
}


// =============================================================================
// ADMIN: ERA MANAGEMENT
// =============================================================================

/**
 * Create a new era. Admin only.
 * Automatically assigns the next available display_order.
 */
export async function adminCreateEra(params: {
  name: string;
  description?: string;
  isHidden?: boolean;
}): Promise<{ success: boolean; eraId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { data: last } = await supabase
      .from("history_eras")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = last && last.length > 0 ? last[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from("history_eras")
      .insert({
        name: params.name,
        description: params.description ?? null,
        display_order: nextOrder,
        is_hidden: params.isHidden ?? false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, eraId: data.id };
  } catch (error) {
    console.error("Unexpected error in adminCreateEra:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update era metadata (name, description, is_hidden). Admin only.
 * Pass only the fields you want to change.
 */
export async function adminUpdateEra(
  eraId: string,
  updates: Partial<Pick<HistoryEraRow, "name" | "description" | "is_hidden" | "display_order">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_eras")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", eraId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in adminUpdateEra:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}


// =============================================================================
// ADMIN: SEASON MANAGEMENT
// =============================================================================

/**
 * Create a new season within an era. Admin only.
 * Automatically assigns the next available display_order within the era.
 */
export async function adminCreateSeason(params: {
  eraId: string;
  name: string;
  spreadsheetUrl?: string;
  description?: string;
  isHidden?: boolean;
}): Promise<{ success: boolean; seasonId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { data: last } = await supabase
      .from("history_seasons")
      .select("display_order")
      .eq("era_id", params.eraId)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = last && last.length > 0 ? last[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from("history_seasons")
      .insert({
        era_id: params.eraId,
        name: params.name,
        spreadsheet_url: params.spreadsheetUrl ?? null,
        description: params.description ?? null,
        display_order: nextOrder,
        is_hidden: params.isHidden ?? false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, seasonId: data.id };
  } catch (error) {
    console.error("Unexpected error in adminCreateSeason:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update season metadata. Admin only.
 * Pass only the fields you want to change.
 */
export async function adminUpdateSeason(
  seasonId: string,
  updates: Partial<
    Pick<
      HistorySeasonRow,
      "name" | "description" | "spreadsheet_url" | "is_hidden" | "display_order"
    >
  >
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_seasons")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", seasonId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in adminUpdateSeason:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}


// =============================================================================
// ADMIN: SECTION / SLOT MANAGEMENT
// =============================================================================

/**
 * Create or update a history section for a specific slot.
 * Admin only — use the historian request system for non-admin team historians.
 *
 * If a section already exists for (season_id + owner_id/league + slot_type),
 * this will create a duplicate — the caller should check first.
 */
export async function adminUpsertSlotSection(params: {
  ownerType: "team" | "league";
  ownerId: string | null;
  eraId: string;
  seasonId: string;
  slotType: string;
  title: string;
  referencedTeamIds?: string[];
  isHidden?: boolean;
}): Promise<{ success: boolean; sectionId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    // Check if a section already exists for this slot
    let existing = supabase
      .from("history_sections")
      .select("id")
      .eq("season_id", params.seasonId)
      .eq("slot_type", params.slotType)
      .eq("owner_type", params.ownerType);

    if (params.ownerType === "league") {
      existing = existing.is("owner_id", null);
    } else {
      existing = existing.eq("owner_id", params.ownerId!);
    }

    const { data: existingSection } = await existing.maybeSingle();

    if (existingSection) {
      // Update the existing section
      const { error } = await supabase
        .from("history_sections")
        .update({
          title: params.title,
          referenced_team_ids: params.referencedTeamIds ?? [],
          is_hidden: params.isHidden ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSection.id);

      if (error) return { success: false, error: error.message };
      return { success: true, sectionId: existingSection.id };
    }

    // Create a new section for this slot
    const { data, error } = await supabase
      .from("history_sections")
      .insert({
        owner_type: params.ownerType,
        owner_id: params.ownerId,
        era_id: params.eraId,
        season_id: params.seasonId,
        slot_type: params.slotType,
        title: params.title,
        display_order: 0, // Ordering is driven by the slot schema, not this value
        referenced_team_ids: params.referencedTeamIds ?? [],
        is_hidden: params.isHidden ?? false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, sectionId: data.id };
  } catch (error) {
    console.error("Unexpected error in adminUpsertSlotSection:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Toggle is_hidden on any history section. Admin only.
 */
export async function adminToggleSectionHidden(
  sectionId: string,
  isHidden: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_sections")
      .update({ is_hidden: isHidden, updated_at: new Date().toISOString() })
      .eq("id", sectionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in adminToggleSectionHidden:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Toggle is_hidden on any history entry. Admin only.
 */
export async function adminToggleEntryHidden(
  entryId: string,
  isHidden: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_entries")
      .update({ is_hidden: isHidden, updated_at: new Date().toISOString() })
      .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in adminToggleEntryHidden:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Toggle is_hidden on a team. Admin only.
 * Hidden teams do not appear in the team filter dropdown or team entries
 * for non-admin users.
 */
export async function adminToggleTeamHidden(
  teamId: string,
  isHidden: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("teams")
      .update({ is_hidden: isHidden, updated_at: new Date().toISOString() })
      .eq("id", teamId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in adminToggleTeamHidden:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}


// =============================================================================
// BACKWARD COMPATIBILITY
// The functions below are kept exactly as they were in the original file.
// They are used by existing components that have not yet been rewritten.
// DO NOT use these in new code — use getComposedHistory instead.
// =============================================================================

/** @deprecated Use getComposedHistory instead */
export async function getTeamsWithHistory(): Promise<{
  teams: TeamBasic[];
  error?: string;
}> {
  return getTeamsForFilter();
}

/** @deprecated Use getComposedHistory instead */
export async function getHistoryByOwner(
  ownerType: "team" | "league",
  ownerId: string | null
): Promise<{ sections: any[]; error?: string }> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from("history_sections")
      .select(`
        id, owner_type, owner_id, title, display_order, created_by, created_at, updated_at,
        history_entries (
          id, section_id, content, display_order, created_by, created_at, updated_at
        )
      `)
      .eq("owner_type", ownerType)
      .eq("is_hidden", false)
      .order("display_order", { ascending: true });

    if (ownerType === "league") {
      query = query.is("owner_id", null);
    } else {
      query = query.eq("owner_id", ownerId!);
    }

    const { data, error } = await query;
    if (error) return { sections: [], error: error.message };

    const sections = (data ?? []).map((section) => ({
      ...section,
      entries: (section.history_entries ?? []).sort(
        (a: any, b: any) => a.display_order - b.display_order
      ),
    }));

    return { sections };
  } catch {
    return { sections: [], error: "An unexpected error occurred" };
  }
}


// =============================================================================
// HISTORIAN: OWN-TEAM EDITING (unchanged from original)
// =============================================================================

export async function createHistorySection(
  ownerType: "team" | "league",
  ownerId: string | null,
  title: string
): Promise<{ success: boolean; sectionId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    if (ownerType === "team" && ownerId) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, ownerId);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin)
        return { success: false, error: "You must be a historian for this team" };
    } else if (ownerType === "league") {
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin)
        return { success: false, error: "Only admins can create league sections" };
    }

    let orderQuery = supabase
      .from("history_sections")
      .select("display_order")
      .eq("owner_type", ownerType)
      .order("display_order", { ascending: false })
      .limit(1);

    if (ownerType === "league") {
      orderQuery = orderQuery.is("owner_id", null);
    } else {
      orderQuery = orderQuery.eq("owner_id", ownerId!);
    }

    const { data: lastSection } = await orderQuery;
    const nextOrder =
      lastSection && lastSection.length > 0 ? lastSection[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from("history_sections")
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        title,
        display_order: nextOrder,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, sectionId: data.id };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function appendHistoryEntry(
  sectionId: string,
  content: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: section, error: sectionError } = await supabase
      .from("history_sections")
      .select("owner_type, owner_id")
      .eq("id", sectionId)
      .single();

    if (sectionError || !section) return { success: false, error: "Section not found" };

    if (section.owner_type === "team" && section.owner_id) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, section.owner_id);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin)
        return { success: false, error: "You must be a historian for this team" };
    } else if (section.owner_type === "league") {
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin)
        return { success: false, error: "Only admins can add league entries" };
    }

    const { data: lastEntry } = await supabase
      .from("history_entries")
      .select("display_order")
      .eq("section_id", sectionId)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder =
      lastEntry && lastEntry.length > 0 ? lastEntry[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from("history_entries")
      .insert({
        section_id: sectionId,
        content,
        display_order: nextOrder,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entryId: data.id };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}


// =============================================================================
// HISTORIAN: REQUEST SYSTEM (unchanged from original)
// =============================================================================

export async function submitHistoryUpdateRequest(params: {
  requestType: "append_entry" | "new_section";
  targetOwnerType: "team" | "league";
  targetOwnerId: string | null;
  targetSectionId?: string;
  proposedTitle?: string;
  proposedContent: string;
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const historianTeamId = await getUserTeamAsHistorian(supabase, user.id);
    if (!historianTeamId)
      return { success: false, error: "You must be a historian to submit requests" };

    const { data: pendingCount } = await supabase.rpc(
      "get_user_pending_request_count",
      { p_user_id: user.id }
    );
    const { data: maxAllowed } = await supabase.rpc(
      "get_user_max_pending_requests",
      { p_user_id: user.id }
    );

    if ((pendingCount || 0) >= (maxAllowed || 1)) {
      return {
        success: false,
        error: `You have reached your pending request limit (${maxAllowed || 1}). Wait for existing requests to be reviewed.`,
      };
    }

    const { data, error } = await supabase
      .from("history_update_requests")
      .insert({
        requester_id: user.id,
        request_type: params.requestType,
        target_owner_type: params.targetOwnerType,
        target_owner_id: params.targetOwnerId,
        target_section_id: params.targetSectionId || null,
        proposed_title: params.proposedTitle || null,
        proposed_content: params.proposedContent,
        status: "pending",
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, requestId: data.id };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getMyPendingRequests(): Promise<{
  requests: any[];
  pendingCount: number;
  maxAllowed: number;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { requests: [], pendingCount: 0, maxAllowed: 1, error: "Not authenticated" };

    const { data: requests, error } = await supabase
      .from("history_update_requests")
      .select("*")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    if (error)
      return { requests: [], pendingCount: 0, maxAllowed: 1, error: error.message };

    const { data: pendingCount } = await supabase.rpc(
      "get_user_pending_request_count",
      { p_user_id: user.id }
    );
    const { data: maxAllowed } = await supabase.rpc(
      "get_user_max_pending_requests",
      { p_user_id: user.id }
    );

    return {
      requests: requests || [],
      pendingCount: pendingCount || 0,
      maxAllowed: maxAllowed || 1,
    };
  } catch {
    return {
      requests: [],
      pendingCount: 0,
      maxAllowed: 1,
      error: "An unexpected error occurred",
    };
  }
}


// =============================================================================
// ADMIN: DIRECT CONTENT MANAGEMENT (unchanged from original)
// =============================================================================

export async function adminUpdateSectionTitle(
  sectionId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_sections")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", sectionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function adminUpdateEntryContent(
  entryId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_entries")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function adminDeleteSection(
  sectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_sections")
      .delete()
      .eq("id", sectionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function adminDeleteEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_entries")
      .delete()
      .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getAllHistorians(): Promise<{
  historians: any[];
  error?: string;
}> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { historians: [], error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { historians: [], error: "Admin access required" };

    const { data: members, error } = await supabase
      .from("team_members_with_roles")
      .select("user_id, user_display_name, team_id, roles");

    if (error) return { historians: [], error: error.message };

    const historianMembers = (members || []).filter(
      (m) => Array.isArray(m.roles) && m.roles.includes("historian")
    );

    const teamIds = [...new Set(historianMembers.map((m) => m.team_id))];
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .in("id", teamIds);

    const teamMap = new Map((teams || []).map((t) => [t.id, t]));

    return {
      historians: historianMembers.map((m) => {
        const team = teamMap.get(m.team_id);
        return {
          user_id: m.user_id,
          display_name: m.user_display_name || "Unknown",
          team_name: team?.name || "Unknown",
          team_emoji: team?.emoji || "",
        };
      }),
    };
  } catch {
    return { historians: [], error: "An unexpected error occurred" };
  }
}

export async function getAllHistoryRequests(
  statusFilter?: "pending" | "approved" | "rejected"
): Promise<{ requests: any[]; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { requests: [], error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { requests: [], error: "Admin access required" };

    let query = supabase
      .from("history_update_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) return { requests: [], error: error.message };

    const enriched = await Promise.all(
      (data || []).map(async (req) => {
        const { data: requesterUser } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", req.requester_id)
          .single();

        let sectionTitle: string | undefined;
        if (req.target_section_id) {
          const { data: section } = await supabase
            .from("history_sections")
            .select("title")
            .eq("id", req.target_section_id)
            .single();
          sectionTitle = section?.title;
        }

        let teamName: string | undefined;
        if (req.target_owner_id) {
          const { data: team } = await supabase
            .from("teams")
            .select("name")
            .eq("id", req.target_owner_id)
            .single();
          teamName = team?.name;
        }

        return {
          ...req,
          requester_display_name: requesterUser?.display_name || "Unknown",
          target_section_title: sectionTitle,
          target_team_name: teamName,
        };
      })
    );

    return { requests: enriched };
  } catch {
    return { requests: [], error: "An unexpected error occurred" };
  }
}

export async function approveHistoryRequest(
  requestId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { data: request, error: reqError } = await supabase
      .from("history_update_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqError || !request) return { success: false, error: "Request not found" };
    if (request.status !== "pending")
      return { success: false, error: "Request has already been reviewed" };

    if (request.request_type === "new_section") {
      let orderQuery = supabase
        .from("history_sections")
        .select("display_order")
        .eq("owner_type", request.target_owner_type)
        .order("display_order", { ascending: false })
        .limit(1);

      if (request.target_owner_type === "league") {
        orderQuery = orderQuery.is("owner_id", null);
      } else {
        orderQuery = orderQuery.eq("owner_id", request.target_owner_id!);
      }

      const { data: lastSection } = await orderQuery;
      const nextOrder =
        lastSection && lastSection.length > 0 ? lastSection[0].display_order + 1 : 0;

      const { data: newSection, error: sectionError } = await supabase
        .from("history_sections")
        .insert({
          owner_type: request.target_owner_type,
          owner_id: request.target_owner_id,
          title: request.proposed_title!,
          display_order: nextOrder,
          created_by: request.requester_id,
        })
        .select()
        .single();

      if (sectionError)
        return { success: false, error: "Failed to create section: " + sectionError.message };

      await supabase.from("history_entries").insert({
        section_id: newSection.id,
        content: request.proposed_content,
        display_order: 0,
        created_by: request.requester_id,
      });
    } else if (request.request_type === "append_entry") {
      const { data: lastEntry } = await supabase
        .from("history_entries")
        .select("display_order")
        .eq("section_id", request.target_section_id!)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder =
        lastEntry && lastEntry.length > 0 ? lastEntry[0].display_order + 1 : 0;

      const { error: entryError } = await supabase.from("history_entries").insert({
        section_id: request.target_section_id!,
        content: request.proposed_content,
        display_order: nextOrder,
        created_by: request.requester_id,
      });

      if (entryError)
        return { success: false, error: "Failed to add entry: " + entryError.message };
    }

    const { error: updateError } = await supabase
      .from("history_update_requests")
      .update({
        status: "approved",
        admin_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) return { success: false, error: updateError.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function rejectHistoryRequest(
  requestId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("history_update_requests")
      .update({
        status: "rejected",
        admin_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateHistorianRequestLimit(
  userId: string,
  maxPending: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };
    if (!(await isUserAdmin(supabase, user.id)))
      return { success: false, error: "Admin access required" };

    const { error } = await supabase.from("historian_request_limits").upsert({
      user_id: userId,
      max_pending_requests: maxPending,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function reorderHistoryEntry(
  entryId: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: entry, error: entryError } = await supabase
      .from("history_entries")
      .select("id, section_id, display_order")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) return { success: false, error: "Entry not found" };

    const { data: section } = await supabase
      .from("history_sections")
      .select("owner_type, owner_id")
      .eq("id", entry.section_id)
      .single();

    if (!section) return { success: false, error: "Section not found" };

    if (section.owner_type === "team" && section.owner_id) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, section.owner_id);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin)
        return { success: false, error: "You must be a historian for this team" };
    } else {
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin)
        return { success: false, error: "Only admins can reorder league entries" };
    }

    const { data: entries } = await supabase
      .from("history_entries")
      .select("id, display_order")
      .eq("section_id", entry.section_id)
      .order("display_order", { ascending: true });

    if (!entries || entries.length < 2)
      return { success: false, error: "Cannot reorder — not enough entries" };

    const currentIndex = entries.findIndex((e) => e.id === entryId);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= entries.length)
      return { success: false, error: "Cannot move further in that direction" };

    const currentOrder = entries[currentIndex].display_order;
    const swapOrder = entries[swapIndex].display_order;

    await supabase
      .from("history_entries")
      .update({ display_order: swapOrder, updated_at: new Date().toISOString() })
      .eq("id", entryId);

    await supabase
      .from("history_entries")
      .update({ display_order: currentOrder, updated_at: new Date().toISOString() })
      .eq("id", entries[swapIndex].id);

    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}
