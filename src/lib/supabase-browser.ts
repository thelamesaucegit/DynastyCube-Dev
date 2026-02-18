// src/lib/supabase-browser.ts
// Client-side Supabase client for browser usage
// Uses cookies for auth state so server can also read it
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton client instance
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient() {
  if (typeof window === "undefined") {
    // Server-side: create new client
    return createClient();
  }

  // Client-side: use singleton
  if (!client) {
    client = createClient();
  }
  return client;
}
