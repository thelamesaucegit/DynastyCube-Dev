// src/app/actions/cardActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { invalidateDraftCache } from '@/lib/draftCache';

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
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export interface CardData {
  id?: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  mana_cost?: string;
  cmc?: number;
  pool_name?: string;
  cubucks_cost?: number;
  created_at?: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
}

export async function getCardPool(
  poolName: string = "default"
): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("card_pools")
      .select("*")
      .eq("pool_name", poolName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching card pool:", error);
      return { cards: [], error: error.message };
    }
    return { cards: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching card pool:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

export async function getAvailableCardsForDraft(
  poolName: string = "default"
): Promise<{ cards: CardData[]; error?: string }> {
  const supabase = await createClient();
  try {
    const { data: allCards, error: poolError } = await supabase
      .from("card_pools")
      .select("*")
      .eq("pool_name", poolName);

    if (poolError) {
      console.error("Error fetching card pool for draft:", poolError);
      return { cards: [], error: poolError.message };
    }

    const { data: draftedPicks, error: draftError } = await supabase
      .from("team_draft_picks")
      .select("card_pool_id");

    if (draftError) {
      console.error("Error fetching drafted picks:", draftError);
      return { cards: [], error: draftError.message };
    }

    const draftedInsta
