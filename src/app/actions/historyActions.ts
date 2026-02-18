// src/app/actions/historyActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Create a Supabase client with cookies support
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
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}

// =============================================================================
// TYPES
// =============================================================================

export interface HistorySection {
  id: string;
  owner_type: "team" | "league";
  owner_id: string | null;
  title: string;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  entries?: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  section_id: string;
  content: string;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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
  // Joined fields
  requester_display_name?: string;
  target_section_title?: string;
  target_team_name?: string;
}

export interface TeamBasic {
  id: string;
  name: string;
  emoji: string;
}

export interface HistorianUser {
  user_id: string;
  display_name: string;
  team_name: string;
  team_emoji: string;
}

// =============================================================================
// HELPER: Check if user is historian for a team
// =============================================================================

async function isUserHistorianForTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  teamId: string
): Promise<boolean> {
  // Get user's team membership
  const { data: membership } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  if (!membership) return false;

  // Check if they have historian role
  const { data: role } = await supabase
    .from("team_member_roles")
    .select("id")
    .eq("team_member_id", membership.id)
    .eq("role", "historian")
    .single();

  return !!role;
}

async function isUserAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return data?.is_admin || false;
}

async function getUserTeamAsHistorian(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  // Find team membership
  const { data: memberships } = await supabase
    .from("team_members")
    .select("id, team_id")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return null;

  // Check each membership for historian role
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
// PUBLIC: Read functions
// =============================================================================

/**
 * Fetch sections + entries for a given owner (team or league)
 */
export async function getHistoryByOwner(
  ownerType: "team" | "league",
  ownerId: string | null
): Promise<{ sections: HistorySection[]; error?: string }> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from("history_sections")
      .select(`
        id,
        owner_type,
        owner_id,
        title,
        display_order,
        created_by,
        created_at,
        updated_at,
        history_entries (
          id,
          section_id,
          content,
          display_order,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq("owner_type", ownerType)
      .order("display_order", { ascending: true });

    if (ownerType === "league") {
      query = query.is("owner_id", null);
    } else {
      query = query.eq("owner_id", ownerId!);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching history:", error);
      return { sections: [], error: error.message };
    }

    // Sort entries within each section
    const sections: HistorySection[] = (data || []).map((section) => ({
      ...section,
      entries: (section.history_entries || []).sort(
        (a: HistoryEntry, b: HistoryEntry) => a.display_order - b.display_order
      ),
    }));

    return { sections };
  } catch (error) {
    console.error("Unexpected error fetching history:", error);
    return { sections: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get teams list for tab navigation
 */
export async function getTeamsWithHistory(): Promise<{
  teams: TeamBasic[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .order("name");

    if (error) {
      console.error("Error fetching teams:", error);
      return { teams: [], error: error.message };
    }

    return { teams: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching teams:", error);
    return { teams: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get all users with the historian role (for admin limit management)
 */
export async function getAllHistorians(): Promise<{
  historians: HistorianUser[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { historians: [], error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { historians: [], error: "Admin access required" };
    }

    // Use the team_members_with_roles view which already joins users
    const { data: members, error } = await supabase
      .from("team_members_with_roles")
      .select("user_id, user_display_name, team_id, roles");

    if (error) {
      console.error("Error fetching historians:", error);
      return { historians: [], error: error.message };
    }

    // Filter to only those with historian role
    const historianMembers = (members || []).filter(
      (m) => Array.isArray(m.roles) && m.roles.includes("historian")
    );

    // Get team details for each historian
    const teamIds = [...new Set(historianMembers.map((m) => m.team_id))];
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, emoji")
      .in("id", teamIds);

    const teamMap = new Map((teams || []).map((t) => [t.id, t]));

    const historians: HistorianUser[] = historianMembers.map((m) => {
      const team = teamMap.get(m.team_id);
      return {
        user_id: m.user_id,
        display_name: m.user_display_name || "Unknown",
        team_name: team?.name || "Unknown",
        team_emoji: team?.emoji || "",
      };
    });

    return { historians };
  } catch (error) {
    console.error("Unexpected error fetching historians:", error);
    return { historians: [], error: "An unexpected error occurred" };
  }
}

/**
 * Get current user's historian info (which team, if any)
 */
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
    console.error("Unexpected error fetching historian info:", error);
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
// HISTORIAN: Own-team editing
// =============================================================================

/**
 * Create a new section for historian's own team
 */
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

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify historian role for the target team
    if (ownerType === "team" && ownerId) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, ownerId);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin) {
        return { success: false, error: "You must be a historian for this team" };
      }
    } else if (ownerType === "league") {
      // Only admins can directly create league sections
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin) {
        return { success: false, error: "Only admins can create league sections" };
      }
    }

    // Get next display_order
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
    const nextOrder = lastSection && lastSection.length > 0 ? lastSection[0].display_order + 1 : 0;

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

    if (error) {
      console.error("Error creating history section:", error);
      return { success: false, error: error.message };
    }

    return { success: true, sectionId: data.id };
  } catch (error) {
    console.error("Unexpected error creating history section:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Add an entry to an existing section
 */
export async function appendHistoryEntry(
  sectionId: string,
  content: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the section to verify ownership
    const { data: section, error: sectionError } = await supabase
      .from("history_sections")
      .select("owner_type, owner_id")
      .eq("id", sectionId)
      .single();

    if (sectionError || !section) {
      return { success: false, error: "Section not found" };
    }

    // Verify permissions
    if (section.owner_type === "team" && section.owner_id) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, section.owner_id);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin) {
        return { success: false, error: "You must be a historian for this team" };
      }
    } else if (section.owner_type === "league") {
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin) {
        return { success: false, error: "Only admins can add league entries" };
      }
    }

    // Get next display_order
    const { data: lastEntry } = await supabase
      .from("history_entries")
      .select("display_order")
      .eq("section_id", sectionId)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = lastEntry && lastEntry.length > 0 ? lastEntry[0].display_order + 1 : 0;

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

    if (error) {
      console.error("Error appending history entry:", error);
      return { success: false, error: error.message };
    }

    return { success: true, entryId: data.id };
  } catch (error) {
    console.error("Unexpected error appending history entry:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Reorder an entry up or down within its section
 */
export async function reorderHistoryEntry(
  entryId: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get the entry and its section
    const { data: entry, error: entryError } = await supabase
      .from("history_entries")
      .select("id, section_id, display_order")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) {
      return { success: false, error: "Entry not found" };
    }

    // Get the section for permission check
    const { data: section } = await supabase
      .from("history_sections")
      .select("owner_type, owner_id")
      .eq("id", entry.section_id)
      .single();

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    // Verify permissions
    if (section.owner_type === "team" && section.owner_id) {
      const isHistorian = await isUserHistorianForTeam(supabase, user.id, section.owner_id);
      const admin = await isUserAdmin(supabase, user.id);
      if (!isHistorian && !admin) {
        return { success: false, error: "You must be a historian for this team" };
      }
    } else {
      const admin = await isUserAdmin(supabase, user.id);
      if (!admin) {
        return { success: false, error: "Only admins can reorder league entries" };
      }
    }

    // Get all entries in the section ordered
    const { data: entries } = await supabase
      .from("history_entries")
      .select("id, display_order")
      .eq("section_id", entry.section_id)
      .order("display_order", { ascending: true });

    if (!entries || entries.length < 2) {
      return { success: false, error: "Cannot reorder - not enough entries" };
    }

    // Find current index
    const currentIndex = entries.findIndex((e) => e.id === entryId);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= entries.length) {
      return { success: false, error: "Cannot move further in that direction" };
    }

    // Swap display_order values
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
  } catch (error) {
    console.error("Unexpected error reordering entry:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// =============================================================================
// HISTORIAN: Request system (cross-team / league)
// =============================================================================

/**
 * Submit a history update request
 */
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

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is a historian on some team
    const historianTeamId = await getUserTeamAsHistorian(supabase, user.id);
    if (!historianTeamId) {
      return { success: false, error: "You must be a historian to submit requests" };
    }

    // Check pending request limit
    const { data: pendingCount } = await supabase.rpc("get_user_pending_request_count", {
      p_user_id: user.id,
    });

    const { data: maxAllowed } = await supabase.rpc("get_user_max_pending_requests", {
      p_user_id: user.id,
    });

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

    if (error) {
      console.error("Error submitting history request:", error);
      return { success: false, error: error.message };
    }

    return { success: true, requestId: data.id };
  } catch (error) {
    console.error("Unexpected error submitting history request:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get historian's own pending requests and limit status
 */
export async function getMyPendingRequests(): Promise<{
  requests: HistoryUpdateRequest[];
  pendingCount: number;
  maxAllowed: number;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { requests: [], pendingCount: 0, maxAllowed: 1, error: "Not authenticated" };
    }

    const { data: requests, error } = await supabase
      .from("history_update_requests")
      .select("*")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching my requests:", error);
      return { requests: [], pendingCount: 0, maxAllowed: 1, error: error.message };
    }

    const { data: pendingCount } = await supabase.rpc("get_user_pending_request_count", {
      p_user_id: user.id,
    });

    const { data: maxAllowed } = await supabase.rpc("get_user_max_pending_requests", {
      p_user_id: user.id,
    });

    return {
      requests: requests || [],
      pendingCount: pendingCount || 0,
      maxAllowed: maxAllowed || 1,
    };
  } catch (error) {
    console.error("Unexpected error fetching my requests:", error);
    return { requests: [], pendingCount: 0, maxAllowed: 1, error: "An unexpected error occurred" };
  }
}

// =============================================================================
// ADMIN: Request management
// =============================================================================

/**
 * Get all history update requests (admin)
 */
export async function getAllHistoryRequests(
  statusFilter?: "pending" | "approved" | "rejected"
): Promise<{ requests: HistoryUpdateRequest[]; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { requests: [], error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { requests: [], error: "Admin access required" };
    }

    let query = supabase
      .from("history_update_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching all requests:", error);
      return { requests: [], error: error.message };
    }

    // Enrich with display names and section/team names
    const enriched: HistoryUpdateRequest[] = await Promise.all(
      (data || []).map(async (req) => {
        // Get requester display name
        const { data: requesterUser } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", req.requester_id)
          .single();

        // Get section title if applicable
        let sectionTitle: string | undefined;
        if (req.target_section_id) {
          const { data: section } = await supabase
            .from("history_sections")
            .select("title")
            .eq("id", req.target_section_id)
            .single();
          sectionTitle = section?.title;
        }

        // Get team name if applicable
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
  } catch (error) {
    console.error("Unexpected error fetching all requests:", error);
    return { requests: [], error: "An unexpected error occurred" };
  }
}

/**
 * Approve a history update request (admin) - applies the content
 */
export async function approveHistoryRequest(
  requestId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    // Get the request
    const { data: request, error: reqError } = await supabase
      .from("history_update_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqError || !request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "pending") {
      return { success: false, error: "Request has already been reviewed" };
    }

    // Apply the content based on request type
    if (request.request_type === "new_section") {
      // Create new section with the proposed content as first entry
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
      const nextOrder = lastSection && lastSection.length > 0 ? lastSection[0].display_order + 1 : 0;

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

      if (sectionError) {
        return { success: false, error: "Failed to create section: " + sectionError.message };
      }

      // Add the entry
      await supabase.from("history_entries").insert({
        section_id: newSection.id,
        content: request.proposed_content,
        display_order: 0,
        created_by: request.requester_id,
      });
    } else if (request.request_type === "append_entry") {
      // Append entry to existing section
      const { data: lastEntry } = await supabase
        .from("history_entries")
        .select("display_order")
        .eq("section_id", request.target_section_id!)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = lastEntry && lastEntry.length > 0 ? lastEntry[0].display_order + 1 : 0;

      const { error: entryError } = await supabase.from("history_entries").insert({
        section_id: request.target_section_id!,
        content: request.proposed_content,
        display_order: nextOrder,
        created_by: request.requester_id,
      });

      if (entryError) {
        return { success: false, error: "Failed to add entry: " + entryError.message };
      }
    }

    // Mark request as approved
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

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error approving request:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Reject a history update request (admin)
 */
export async function rejectHistoryRequest(
  requestId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

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

    if (error) {
      console.error("Error rejecting request:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error rejecting request:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update per-user historian request limit (admin)
 */
export async function updateHistorianRequestLimit(
  userId: string,
  maxPending: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    const { error } = await supabase
      .from("historian_request_limits")
      .upsert({
        user_id: userId,
        max_pending_requests: maxPending,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error updating request limit:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating request limit:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// =============================================================================
// ADMIN: Direct content management
// =============================================================================

/**
 * Edit any section title (admin)
 */
export async function adminUpdateSectionTitle(
  sectionId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    const { error } = await supabase
      .from("history_sections")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", sectionId);

    if (error) {
      console.error("Error updating section title:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating section title:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Edit any entry content (admin)
 */
export async function adminUpdateEntryContent(
  entryId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    const { error } = await supabase
      .from("history_entries")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", entryId);

    if (error) {
      console.error("Error updating entry content:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating entry content:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a section (admin) - cascades to entries
 */
export async function adminDeleteSection(
  sectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    const { error } = await supabase
      .from("history_sections")
      .delete()
      .eq("id", sectionId);

    if (error) {
      console.error("Error deleting section:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting section:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete an entry (admin)
 */
export async function adminDeleteEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return { success: false, error: "Admin access required" };
    }

    const { error } = await supabase
      .from("history_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      console.error("Error deleting entry:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting entry:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
