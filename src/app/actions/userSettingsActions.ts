// src/app/actions/userSettingsActions.ts
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
/**
 * Gets the user's preference for using oldest card art.
 */
export async function getUserArtPreference(): Promise<{ use_oldest_art: boolean; error?: string; }> {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { use_oldest_art: false, error: "Not authenticated" };

        const { data, error } = await supabase
            .from("users")
            .select("use_oldest_card_art")
            .eq("id", user.id)
            .single();
        
        if (error) throw error;

        return { use_oldest_art: data?.use_oldest_card_art || false };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error fetching art preference:", message);
        return { use_oldest_art: false, error: message };
    }
}

// --- NEW FUNCTION ---
/**
 * Updates the user's preference for using oldest card art.
 */
export async function updateUserArtPreference(useOldestArt: boolean): Promise<{ success: boolean; error?: string; }> {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const { error } = await supabase
            .from("users")
            .update({ use_oldest_card_art: useOldestArt })
            .eq("id", user.id);

        if (error) throw error;

        return { success: true };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error updating art preference:", message);
        return { success: false, error: message };
    }
}


/**
 * Get user's timezone preference
 */
export async function getUserTimezone(): Promise<{
  timezone: string | null;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { timezone: null, error: "Not authenticated" };
    }

    // Get user's timezone from profile
    const { data, error } = await supabase
      .from("users")
      .select("timezone")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user timezone:", error);
      return { timezone: "UTC", error: error.message };
    }

    return { timezone: data?.timezone || "UTC" };
  } catch (error) {
    console.error("Unexpected error fetching user timezone:", error);
    return { timezone: "UTC", error: "An unexpected error occurred" };
  }
}

/**
 * Update user's timezone preference
 */
export async function updateUserTimezone(
  timezone: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate timezone format (basic check)
    if (!timezone || timezone.trim() === "") {
      return { success: false, error: "Timezone cannot be empty" };
    }

    // Update user's timezone
    const { error } = await supabase
      .from("users")
      .update({ timezone: timezone.trim() })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating user timezone:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating user timezone:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get user's full profile including timezone
 */
export async function getUserProfile(): Promise<{
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    timezone: string;
    is_admin: boolean;
  } | null;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { profile: null, error: "Not authenticated" };
    }

    // Get user profile
    const { data, error } = await supabase
      .from("users")
      .select("id, email, display_name, timezone, is_admin")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return { profile: null, error: error.message };
    }

    return { profile: data };
  } catch (error) {
    console.error("Unexpected error fetching user profile:", error);
    return { profile: null, error: "An unexpected error occurred" };
  }
}
