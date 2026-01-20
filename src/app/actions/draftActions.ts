// src/app/actions/draftActions.ts
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

export interface DraftPick {
  id?: string;
  team_id: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  mana_cost?: string;
  cmc?: number;
  drafted_at?: string;
  pick_number?: number;
}

export interface Deck {
  id?: string;
  team_id: string;
  deck_name: string;
  description?: string;
  format?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeckCard {
  id?: string;
  deck_id: string;
  draft_pick_id?: string;
  card_id: string;
  card_name: string;
  quantity?: number;
  is_commander?: boolean;
  category?: string;
}

/**
 * Get all draft picks for a team
 */
export async function getTeamDraftPicks(
  teamId: string
): Promise<{ picks: DraftPick[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_draft_picks")
      .select("*")
      .eq("team_id", teamId)
      .order("pick_number", { ascending: true });

    if (error) {
      console.error("Error fetching draft picks:", error);
      return { picks: [], error: error.message };
    }

    return { picks: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching draft picks:", error);
    return { picks: [], error: "An unexpected error occurred" };
  }
}

/**
 * Add a card to team's draft picks
 */
export async function addDraftPick(
  pick: DraftPick
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("team_draft_picks").insert({
      team_id: pick.team_id,
      card_id: pick.card_id,
      card_name: pick.card_name,
      card_set: pick.card_set,
      card_type: pick.card_type,
      rarity: pick.rarity,
      colors: pick.colors || [],
      image_url: pick.image_url,
      mana_cost: pick.mana_cost,
      cmc: pick.cmc,
      pick_number: pick.pick_number,
      drafted_by: user?.id || null,
    });

    if (error) {
      console.error("Error adding draft pick:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding draft pick:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove a card from team's draft picks
 */
export async function removeDraftPick(
  pickId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("team_draft_picks")
      .delete()
      .eq("id", pickId);

    if (error) {
      console.error("Error removing draft pick:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing draft pick:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get all decks for a team
 */
export async function getTeamDecks(
  teamId: string
): Promise<{ decks: Deck[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("team_decks")
      .select("*")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching decks:", error);
      return { decks: [], error: error.message };
    }

    return { decks: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching decks:", error);
    return { decks: [], error: "An unexpected error occurred" };
  }
}

/**
 * Create a new deck
 */
export async function createDeck(
  deck: Deck
): Promise<{ success: boolean; deckId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    // Get user for audit purposes - gracefully handle auth errors
    let user = null;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    } catch {
      // Auth errors are non-blocking - we'll just create without user attribution
      console.log("Note: Creating deck without auth session (user attribution unavailable)");
    }

    console.log("Creating deck with data:", {
      team_id: deck.team_id,
      deck_name: deck.deck_name,
      user_id: user?.id || 'no user',
    });

    const { data, error } = await supabase
      .from("team_decks")
      .insert({
        team_id: deck.team_id,
        deck_name: deck.deck_name,
        description: deck.description,
        format: deck.format || "standard",
        is_public: deck.is_public || false,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating deck:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return {
        success: false,
        error: `Database error: ${error.message}${error.hint ? ` (${error.hint})` : ''}`
      };
    }

    return { success: true, deckId: data.id };
  } catch (error) {
    console.error("Unexpected error creating deck:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Delete a deck
 */
export async function deleteDeck(
  deckId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("team_decks")
      .delete()
      .eq("id", deckId);

    if (error) {
      console.error("Error deleting deck:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting deck:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get cards in a deck
 */
export async function getDeckCards(
  deckId: string
): Promise<{ cards: DeckCard[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("deck_cards")
      .select("*")
      .eq("deck_id", deckId)
      .order("category", { ascending: true });

    if (error) {
      console.error("Error fetching deck cards:", error);
      return { cards: [], error: error.message };
    }

    return { cards: data || [] };
  } catch (error) {
    console.error("Unexpected error fetching deck cards:", error);
    return { cards: [], error: "An unexpected error occurred" };
  }
}

/**
 * Add a card to a deck
 */
export async function addCardToDeck(
  deckCard: DeckCard
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("deck_cards").insert({
      deck_id: deckCard.deck_id,
      draft_pick_id: deckCard.draft_pick_id,
      card_id: deckCard.card_id,
      card_name: deckCard.card_name,
      quantity: deckCard.quantity || 1,
      is_commander: deckCard.is_commander || false,
      category: deckCard.category || "mainboard",
    });

    if (error) {
      console.error("Error adding card to deck:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding card to deck:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update a deck card's quantity
 */
export async function updateDeckCardQuantity(
  cardId: string,
  newQuantity: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("deck_cards")
      .update({ quantity: newQuantity })
      .eq("id", cardId);

    if (error) {
      console.error("Error updating deck card quantity:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error updating deck card quantity:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Remove a card from a deck
 */
export async function removeCardFromDeck(
  cardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("deck_cards")
      .delete()
      .eq("id", cardId);

    if (error) {
      console.error("Error removing card from deck:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing card from deck:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
