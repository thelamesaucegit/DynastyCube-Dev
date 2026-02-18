// src/app/actions/adminNewsActions.ts
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

export interface AdminNewsPost {
  id?: string;
  title: string;
  content: string;
  author_id?: string;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get all admin news posts (published and unpublished)
 */
export async function getAllAdminNews(): Promise<{
  news: AdminNewsPost[];
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("admin_news")
      .select(`
        id,
        title,
        content,
        author_id,
        is_published,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin news:", error);
      return { news: [], error: error.message };
    }

    const news: AdminNewsPost[] = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      author_id: item.author_id,
      is_published: item.is_published,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return { news };
  } catch (error) {
    console.error("Unexpected error fetching admin news:", error);
    return { news: [], error: "An unexpected error occurred" };
  }
}

/**
 * Create a new admin news post
 */
export async function createAdminNews(
  post: AdminNewsPost
): Promise<{ success: boolean; newsId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    // Get the current user (admin)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "You must be logged in to create news" };
    }

    const { data, error } = await supabase
      .from("admin_news")
      .insert({
        title: post.title,
        content: post.content,
        author_id: user.id,
        is_published: post.is_published || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating admin news:", error);
      return { success: false, error: error.message };
    }

    return { success: true, newsId: data.id };
  } catch (error) {
    console.error("Unexpected error creating admin news:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update an existing admin news post
 */
export async function updateAdminNews(
  newsId: string,
  updates: Partial<AdminNewsPost>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("admin_news")
      .update({
        title: updates.title,
        content: updates.content,
        is_published: updates.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsId);

    if (error) {
      console.error("Error updating admin news:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating admin news:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete an admin news post
 */
export async function deleteAdminNews(
  newsId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("admin_news")
      .delete()
      .eq("id", newsId);

    if (error) {
      console.error("Error deleting admin news:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting admin news:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Publish an admin news post
 */
export async function publishAdminNews(
  newsId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("admin_news")
      .update({
        is_published: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsId);

    if (error) {
      console.error("Error publishing admin news:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error publishing admin news:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Unpublish an admin news post
 */
export async function unpublishAdminNews(
  newsId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("admin_news")
      .update({
        is_published: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsId);

    if (error) {
      console.error("Error unpublishing admin news:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error unpublishing admin news:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
