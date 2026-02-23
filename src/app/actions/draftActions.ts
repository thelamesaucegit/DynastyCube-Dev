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
  card_pool_id?: string;
  team_id: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  draft_session_id?: string; 
  colors?: string[];
  image_url?: string;
  mana_cost?: string;
  cmc?: number;
  drafted_at?: string;
  pick_number?: number;
  cubecobra_elo?: number;
  rating_updated_at?: string;
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
  created_by?: string;
  created_by_name?: string;
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
 * Internal: Adds a "skipped" pick to the draft history.
 * This is used when a team fails to auto-draft, allowing the draft to advance.
 */
export async function addSkippedPick(
  teamId: string,
  pickNumber: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("team_draft_picks").insert({
      team_id: teamId,
      card_id: "skipped-pick", // Special identifier for skipped picks
      card_name: "SKIPPED",
      pick_number: pickNumber,
      drafted_by: null, // auto-drafted
    });

    if (error) {
      console.error("Error adding skipped pick:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error adding skipped pick:", error);
    return { success: false, error: "An unexpected error occurred" };
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
    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(pick.team_id);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    // --- FIX: Check if the card instance has already been drafted ---
    // This prevents race conditions where two users draft the same instance at the same time.
    if (pick.card_pool_id) {
        const { data: existingPick, error: checkError } = await supabase
            .from("team_draft_picks")
            .select("id")
            .eq("card_pool_id", pick.card_pool_id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // Ignore "not found" error
            console.error("Error checking for existing draft pick:", checkError);
            return { success: false, error: "Database error checking card availability." };
        }
        if (existingPick) {
            return { success: false, error: "This specific card has already been drafted." };
        }
    }
    
    const { error } = await supabase.from("team_draft_picks").insert({
      team_id: pick.team_id,
      card_pool_id: pick.card_pool_id, 
      draft_session_id: pick.draft_session_id, 
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
      drafted_by: authCheck.userId,
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
 * Verify that the current user is authenticated and is a member of the specified team
 */
async function verifyTeamMembership(
  teamId: string
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "You must be logged in to perform this action" };
  }

  // Check team membership
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return { authorized: false, userId: user.id, error: "You must be a member of this team to perform this action" };
  }

  return { authorized: true, userId: user.id };
}

/**
 * Get the team_id for a deck
 */
async function getDeckTeamId(deckId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("team_decks")
    .select("team_id")
    .eq("id", deckId)
    .single();

  return data?.team_id || null;
}

/**
 * Get the team_id for a deck card (via deck lookup)
 */
async function getDeckCardTeamId(cardId: string): Promise<string | null> {
  const supabase = await createClient();

  // Get the deck_id for this card
  const { data: cardData } = await supabase
    .from("deck_cards")
    .select("deck_id")
    .eq("id", cardId)
    .single();

  if (!cardData?.deck_id) {
    return null;
  }

  // Get the team_id for this deck
  return getDeckTeamId(cardData.deck_id);
}

/**
 * Get the team_id for a draft pick
 */
async function getDraftPickTeamId(pickId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("team_draft_picks")
    .select("team_id")
    .eq("id", pickId)
    .single();

  return data?.team_id || null;
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
 * Internal: Add a draft pick without user session check.
 * Only for use by server-side auto-draft logic.
 */
// FIX: Added the second argument to match the function call.
// FIX: Added a race condition check to prevent duplicate drafts.

export async function addDraftPickInternal(
  pick: DraftPick,
  isAutoDraft?: boolean
): Promise<{ success: boolean; pick?: DraftPick; error?: string }> {
  const supabase = await createClient();
  try {
    // Prevent race conditions where two processes draft the same instance.
    if (pick.card_pool_id) {
        const { data: existingPick, error: checkError } = await supabase
            .from("team_draft_picks")
            .select("id")
            .eq("card_pool_id", pick.card_pool_id)
            .single();
        if (checkError && checkError.code !== 'PGRST116') { // Ignore "not found" error
            console.error("Error checking for existing auto-draft pick:", checkError);
            return { success: false, error: "Database error checking card availability for auto-draft." };
        }
        if (existingPick) {
            return { success: false, error: "This specific card has already been drafted by another process." };
        }
    }

    // Chain .select().single() to get the inserted row back
    const { data: newPick, error } = await supabase
      .from("team_draft_picks")
      .insert({
        team_id: pick.team_id,
        draft_session_id: pick.draft_session_id, // Now a valid property
        card_pool_id: pick.card_pool_id,
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
        drafted_by: null, // auto-drafted — no user session
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding auto-draft pick:", error);
      return { success: false, error: error.message };
    }

    // Return the newly created pick object on success
    return { success: true, pick: newPick };
    
  } catch (error) {
    console.error("Unexpected error adding auto-draft pick:", error);
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
    // Get the team_id for this draft pick
    const teamId = await getDraftPickTeamId(pickId);
    if (!teamId) {
      return { success: false, error: "Draft pick not found" };
    }

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

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
    // Fetch decks
    const { data, error } = await supabase
      .from("team_decks")
      .select("*")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching decks:", error);
      return { decks: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { decks: [] };
    }

    // Get unique creator IDs
    const creatorIds = [...new Set(data.map((d) => d.created_by).filter(Boolean))];

    // Fetch creator names if there are any
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", creatorIds);

      if (profiles) {
        creatorMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.display_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Transform data to include created_by_name
    const decks: Deck[] = data.map((deck) => ({
      id: deck.id,
      team_id: deck.team_id,
      deck_name: deck.deck_name,
      description: deck.description,
      format: deck.format,
      is_public: deck.is_public,
      created_at: deck.created_at,
      updated_at: deck.updated_at,
      created_by: deck.created_by,
      created_by_name: deck.created_by ? creatorMap[deck.created_by] : undefined,
    }));

    return { decks };
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
    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(deck.team_id);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    const { data, error } = await supabase
      .from("team_decks")
      .insert({
        team_id: deck.team_id,
        deck_name: deck.deck_name,
        description: deck.description,
        format: deck.format || "standard",
        is_public: deck.is_public || false,
        created_by: authCheck.userId,
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
    // Get the team_id for this deck
    const teamId = await getDeckTeamId(deckId);
    if (!teamId) {
      return { success: false, error: "Deck not found" };
    }

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

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
    const teamId = await getDeckTeamId(deckCard.deck_id);
    if (!teamId) return { success: false, error: "Deck not found" };

    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };

    // --- FIX: Prevent adding the same DRAFT PICK instance twice ---
    if (deckCard.draft_pick_id) {
        const { data: existingCard, error: checkError } = await supabase
            .from("deck_cards")
            .select("id")
            .eq("deck_id", deckCard.deck_id)
            .eq("draft_pick_id", deckCard.draft_pick_id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            return { success: false, error: "Database error checking for card." };
        }
        if (existingCard) {
            return { success: false, error: "This specific drafted card is already in the deck." };
        }
    }

    const { error } = await supabase.from("deck_cards").insert({
      deck_id: deckCard.deck_id,
      draft_pick_id: deckCard.draft_pick_id, // This is the key link
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
    // Get the team_id for this deck card
    const teamId = await getDeckCardTeamId(cardId);
    if (!teamId) {
      return { success: false, error: "Card not found" };
    }

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

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
    // Get the team_id for this deck card
    const teamId = await getDeckCardTeamId(cardId);
    if (!teamId) {
      return { success: false, error: "Card not found" };
    }

    // Verify user is authenticated and is a member of the team
    const authCheck = await verifyTeamMembership(teamId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

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
