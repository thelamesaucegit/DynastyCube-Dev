// src/app/actions/countdownTimerActions.ts
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

export interface CountdownTimerRecord {
  id?: string;
  title: string;
  end_time: string;
  link_url: string;
  link_text: string;
  is_active?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get all countdown timers (for admin panel)
 */
export async function getAllCountdownTimers(): Promise<{
  timers: CountdownTimerRecord[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("countdown_timers")
      .select(`
        id,
        title,
        end_time,
        link_url,
        link_text,
        is_active,
        created_by,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching countdown timers:", error);
      return { timers: [], error: error.message };
    }

    return { timers: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching countdown timers:", error);
    return { timers: [], error: "An unexpected error occurred" };
  }
}

/**
 * Create a new countdown timer
 */
export async function createCountdownTimer(
  timer: CountdownTimerRecord
): Promise<{ success: boolean; timerId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "You must be logged in to create timers" };
    }

    // If this timer should be active, deactivate all others first
    if (timer.is_active) {
      await supabase
        .from("countdown_timers")
        .update({ is_active: false })
        .eq("is_active", true);
    }

    const { data, error } = await supabase
      .from("countdown_timers")
      .insert({
        title: timer.title,
        end_time: timer.end_time,
        link_url: timer.link_url,
        link_text: timer.link_text,
        is_active: timer.is_active || false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating countdown timer:", error);
      return { success: false, error: error.message };
    }

    return { success: true, timerId: data.id };
  } catch (error) {
    console.error("Unexpected error creating countdown timer:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update an existing countdown timer
 */
export async function updateCountdownTimer(
  timerId: string,
  updates: Partial<CountdownTimerRecord>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("countdown_timers")
      .update({
        title: updates.title,
        end_time: updates.end_time,
        link_url: updates.link_url,
        link_text: updates.link_text,
        is_active: updates.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", timerId);

    if (error) {
      console.error("Error updating countdown timer:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating countdown timer:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a countdown timer
 */
export async function deleteCountdownTimer(
  timerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("countdown_timers")
      .delete()
      .eq("id", timerId);

    if (error) {
      console.error("Error deleting countdown timer:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting countdown timer:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Activate a countdown timer (deactivates all others first)
 */
export async function activateCountdownTimer(
  timerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Deactivate all timers first
    await supabase
      .from("countdown_timers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);

    // Activate the target timer
    const { error } = await supabase
      .from("countdown_timers")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", timerId);

    if (error) {
      console.error("Error activating countdown timer:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error activating countdown timer:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Deactivate a countdown timer
 */
export async function deactivateCountdownTimer(
  timerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("countdown_timers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", timerId);

    if (error) {
      console.error("Error deactivating countdown timer:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deactivating countdown timer:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
