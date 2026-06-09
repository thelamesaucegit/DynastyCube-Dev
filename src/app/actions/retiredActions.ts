// src/app/actions/retiredActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export interface RetiredCard {
  id: string;
  card_id: string;
  card_name: string;
  card_set: string | null;
  card_type: string | null;
  rarity: string | null;
  colors: string[] | null;
  color_identity: string[] | null;
  image_url: string | null;
  oldest_image_url: string | null;
  oracle_id: string | null;
  oracle_text?: string | null;
  mana_cost: string | null;
  cmc: number;
  cubucks_cost: number;
  retired_at: string;
  retired_reason: string | null;
  hidden: boolean;
  is_legendary: boolean;
}

export async function getRetiredCards(): Promise<{ success: boolean; cards: RetiredCard[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("retired_cards")
      .select("*")
      .eq("hidden", false) // <-- THE FIX: Exclude hidden legendary cards!
      .order("retired_at", { ascending: false });

    if (error) {
      console.error("Error fetching retired cards:", error);
      return { success: false, cards: [], error: error.message };
    }

    const cards: RetiredCard[] = (data || []).map((card) => ({
      ...card,
      cmc: Number(card.cmc || 0),
      cubucks_cost: Number(card.cubucks_cost || 1),
    }));

    return { success: true, cards };
  } catch (error) {
    console.error("Unexpected error fetching retired cards:", error);
    return { success: false, cards: [], error: "An unexpected error occurred." };
  }
}
