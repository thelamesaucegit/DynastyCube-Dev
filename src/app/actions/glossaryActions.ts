// src/app/actions/glossaryActions.ts
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

export interface GlossaryItem {
  id: string;
  term: string;
  definition: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HELPERS
// =============================================================================

async function isUserAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return data?.is_admin === true;
}

// =============================================================================
// PUBLIC FUNCTIONS
// =============================================================================

/**
 * Get all glossary items, sorted alphabetically by term.
 * Public — no auth required.
 */
export async function getGlossaryItems(): Promise<{
  items: GlossaryItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("glossary_items")
      .select("*")
      .order("term", { ascending: true });

    if (error) {
      console.error("Error fetching glossary items:", error);
      return { items: [], error: error.message };
    }

    return { items: data || [] };
  } catch (err) {
    console.error("Unexpected error fetching glossary:", err);
    return { items: [], error: "Failed to load glossary" };
  }
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Create a new glossary item. Admin only.
 */
export async function createGlossaryItem(
  term: string,
  definition: string
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) return { success: false, error: "Admin access required" };

    if (!term.trim() || !definition.trim()) {
      return { success: false, error: "Term and definition are required" };
    }

    const { data, error } = await supabase
      .from("glossary_items")
      .insert({
        term: term.trim(),
        definition: definition.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating glossary item:", error);
      return { success: false, error: error.message };
    }

    return { success: true, itemId: data.id };
  } catch (err) {
    console.error("Unexpected error creating glossary item:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update an existing glossary item. Admin only.
 */
export async function updateGlossaryItem(
  itemId: string,
  term: string,
  definition: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) return { success: false, error: "Admin access required" };

    if (!term.trim() || !definition.trim()) {
      return { success: false, error: "Term and definition are required" };
    }

    const { error } = await supabase
      .from("glossary_items")
      .update({
        term: term.trim(),
        definition: definition.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) {
      console.error("Error updating glossary item:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Unexpected error updating glossary item:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a glossary item. Admin only.
 */
export async function deleteGlossaryItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) return { success: false, error: "Admin access required" };

    const { error } = await supabase
      .from("glossary_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting glossary item:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Unexpected error deleting glossary item:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
