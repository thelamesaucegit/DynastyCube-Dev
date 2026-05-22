// src/app/actions/draftActions.ts

"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {  createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

function createServiceClient() {
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
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
  oldest_image_url?: string;
  mana_cost?: string;
  cmc?: number;
  drafted_at?: string;
  pick_number?: number;
  cubecobra_elo?: number;
  rating_updated_at?: string;
  acquisition_method?: 'draft' | 'wire' | 'free_agent' | 'trade' | 'skipped';
  acquired_at?: string;
  is_keeper?: boolean;
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
export async function updateDeckDetails(
  deckId: string,
  updates: { deck_name?: string; description?: string; format?: string; is_public?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const teamId = await getDeckTeamId(deckId);
    if (!teamId) return { success: false, error: "Deck not found" };

    const authCheck = await verifyTeamMembership(teamId, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };

    // 1. Update the deck
    const { error } = await supabase
      .from("team_decks")
      .update({
        ...(updates.deck_name && { deck_name: updates.deck_name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.format && { format: updates.format }),
        ...(updates.is_public !== undefined && { is_public: updates.is_public }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId);

    if (error) return { success: false, error: error.message };

    // 2. Sync with active polls: If the name changed, update any poll options linked to this deck
    if (updates.deck_name) {
        const { error: syncError } = await supabase
            .from('poll_options')
            .update({ option_text: updates.deck_name })
            .eq('deck_id', deckId);
            
        if (syncError) console.error("Failed to sync poll option text on deck rename:", syncError);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "An unexpected error occurred" };
  }
}

async function verifyTeamMembership(
  teamId: string,
  client: AnySupabaseClient
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  console.log("=== verifyTeamMembership LOGGING ===");
  console.log("teamId passed:", teamId, "length:", teamId?.length);
  
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return { authorized: false, error: "You must be logged in to perform this action" };
  }

  const { data: membership, error: membershipError } = await client
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (membershipError) {
      console.error("Membership check error:", membershipError);
  }

  if (membershipError || !membership) {
    return { authorized: false, userId: user.id, error: "You must be a member of this team to perform this action" };
  }

  return { authorized: true, userId: user.id };
}

async function getDeckTeamId(deckId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("team_decks").select("team_id").eq("id", deckId).single();
  return data?.team_id || null;
}

async function getDeckCardTeamId(cardId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: cardData } = await supabase.from("deck_cards").select("deck_id").eq("id", cardId).single();
  if (!cardData?.deck_id) return null;
  return getDeckTeamId(cardData.deck_id);
}

async function getDraftPickTeamId(pickId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("team_draft_picks").select("team_id").eq("id", pickId).single();
  return data?.team_id || null;
}

export async function addSkippedPick(
  teamId: string,
  pickNumber: number,
  draftSessionId: string,
  adminClient?: AnySupabaseClient
): Promise<{ success: boolean; pick?: DraftPick; error?: string }> {
    const supabase = adminClient ?? createServiceClient();
  try {
    const { data: newPick, error } = await supabase
      .from("team_draft_picks")
      .insert({
        team_id: teamId,
        draft_session_id: draftSessionId,
        card_id: "skipped-pick",
        card_name: "SKIPPED",
        pick_number: pickNumber,
        drafted_by: null,
        pick_source: "skipped",    // ← added
      })
      .select()
      .single();
    if (error) {
        // Log database insertion failures
        await logSystemEvent("AddSkippedPick", "error", `Failed to insert skipped pick for team ${teamId}`, { error: error.message });
        return { success: false, error: error.message };
    }

    // Log the successful skip action

    return { success: true, pick: newPick };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function addDraftPick(pick: DraftPick): Promise<{ success: boolean; error?: string }> {
  console.log("=== addDraftPick LOGGING ===");
  console.log("Pick Payload:", JSON.stringify(pick, null, 2));
  
  const supabase = await createServerClient();
  try {
    const authCheck = await verifyTeamMembership(pick.team_id, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };

    if (pick.card_pool_id) {
        console.log("Checking for existing pick with card_pool_id:", pick.card_pool_id);
        const { data: existingPick, error: checkError } = await supabase.from("team_draft_picks").select("id").eq("card_pool_id", pick.card_pool_id).single();
        if (checkError && checkError.code !== "PGRST116") {
            console.error("Error checking for existing draft pick:", checkError);
            return { success: false, error: "Database error checking card availability." };
        }
        if (existingPick) {
            return { success: false, error: "This specific card has already been drafted." };
        }
    }
    
    console.log("Inserting new draft pick...");
    const insertPayload = {
      team_id: pick.team_id,
      card_pool_id: pick.card_pool_id, 
      draft_session_id: pick.draft_session_id || null, // Force undefined/empty to true null
      card_id: pick.card_id,
      card_name: pick.card_name,
      card_set: pick.card_set,
      card_type: pick.card_type,
      rarity: pick.rarity,
      colors: pick.colors || [],
      image_url: pick.image_url,
      oldest_image_url: pick.oldest_image_url,
      mana_cost: pick.mana_cost,
      cmc: pick.cmc,
      pick_number: pick.pick_number,
      drafted_by: authCheck.userId,
      acquisition_method: pick.acquisition_method || 'draft',
      acquired_at: new Date().toISOString(), 
    };
    
    console.log("Insert Payload:", JSON.stringify(insertPayload, null, 2));

    const { error } = await supabase.from("team_draft_picks").insert(insertPayload);
    
    if (error) {
      console.error("Error adding draft pick:", error);
      return { success: false, error: error.message };
    }
    
    console.log("addDraftPick SUCCESS");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error adding draft pick:", message);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getTeamDraftPicks(
  teamId: string,
  draftSessionId?: string,
  adminClient?: AnySupabaseClient
): Promise<{ picks: DraftPick[]; error?: string }> {
    const supabase = adminClient ?? createServiceClient();
  try {
    let query = supabase.from("team_draft_picks").select("*").eq("team_id", teamId);
    if (draftSessionId) {
      query = query.eq("draft_session_id", draftSessionId);
    }
    const { data, error } = await query.order("pick_number", { ascending: true });
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

export async function addDraftPickInternal(pick: DraftPick, _isAutoDraft?: boolean): Promise<{ success: boolean; pick?: DraftPick; error?: string }> {
  const supabase = await createServerClient();
  try {
    if (pick.card_pool_id) {
        const { data: existingPick, error: checkError } = await supabase.from("team_draft_picks").select("id").eq("card_pool_id", pick.card_pool_id).single();
        if (checkError && checkError.code !== "PGRST116") {
            console.error("Error checking for existing auto-draft pick:", checkError);
            return { success: false, error: "Database error checking card availability for auto-draft." };
        }
        if (existingPick) {
            return { success: false, error: "This specific card has already been drafted by another process." };
        }
    }
    const { data: newPick, error } = await supabase.from("team_draft_picks").insert({
        team_id: pick.team_id, draft_session_id: pick.draft_session_id, card_pool_id: pick.card_pool_id, card_id: pick.card_id,
        card_name: pick.card_name, card_set: pick.card_set, card_type: pick.card_type, rarity: pick.rarity,
        colors: pick.colors || [], image_url: pick.image_url, oldest_image_url: pick.oldest_image_url, mana_cost: pick.mana_cost,
        cmc: pick.cmc, pick_number: pick.pick_number, drafted_by: null,
      }).select().single();
    if (error) {
      console.error("Error adding auto-draft pick:", error);
      return { success: false, error: error.message };
    }
    return { success: true, pick: newPick };
  } catch (error) {
    console.error("Unexpected error adding auto-draft pick:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function removeDraftPick(pickId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const { data: pick, error: pickError } = await supabase
      .from("team_draft_picks")
      .select("id, team_id, card_id, card_pool_id, acquisition_method, acquired_at, draft_session_id")
      .eq("id", pickId)
      .single();

    if (pickError || !pick) {
      return { success: false, error: "Draft pick not found." };
    }

    const authCheck = await verifyTeamMembership(pick.team_id, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };

    if (pick.acquisition_method === 'wire') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (pick.acquired_at && new Date(pick.acquired_at) > oneWeekAgo) {
        return { success: false, error: "Cannot cut a card won on The Wire for 7 days after acquisition." };
      }
    }

    // --- NEW LOGIC: ADD TO OWNERSHIP HISTORY ---
    if (pick.draft_session_id) {
      const { data: session } = await supabase.from('draft_sessions').select('season_id').eq('id', pick.draft_session_id).single();
      if (session?.season_id) {
        
        // --- THIS IS THE CORRECT FIX ---
        // Use .upsert() with the onConflict option, not .insert().onConflict()
        const { error: historyError } = await supabase
          .from('card_ownership_history')
          .upsert(
            {
              card_id: pick.card_id,
              team_id: pick.team_id,
              season_id: session.season_id,
            },
            {
              onConflict: 'card_id,team_id,season_id', // The unique constraint columns
              ignoreDuplicates: true, // This performs the "ignore" action
            }
          );
        // --- END OF FIX ---

        if (historyError) {
            console.error("Error upserting into card_ownership_history:", historyError);
            // Non-fatal error, but log it. The cut can still proceed.
        }
      }
    }

    // Delete the pick from the team's roster
    const { error: deleteError } = await supabase.from("team_draft_picks").delete().eq("id", pickId);
    if (deleteError) {
        console.error("Error removing pick from team roster:", deleteError);
        return { success: false, error: "Failed to remove card from roster." };
    }

    // Update the card in card_pools to move it to The Wire
    if (pick.card_pool_id) {
        const { error: updateError } = await supabase
            .from("card_pools")
            .update({ 
                pool_name: 'wire', 
                on_wire_since: new Date().toISOString() 
            })
            .eq("id", pick.card_pool_id);

        if (updateError) {
            console.error("Critical error: Roster pick deleted but failed to move card to Wire:", updateError);
            return { success: false, error: "Card removed from team but failed to place on The Wire. Please contact an admin." };
        }
    }

    return { success: true };
  } catch (error) { 
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Unexpected error in removeDraftPick:", message)
    return { success: false, error: message }; 
  }
}

export async function getTeamDecks(teamId: string): Promise<{ decks: Deck[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    const { data, error } = await supabase.from("team_decks").select("*").eq("team_id", teamId).order("updated_at", { ascending: false });
    if (error) return { decks: [], error: error.message };
    if (!data || data.length === 0) return { decks: [] };
    const creatorIds = [...new Set(data.map((d) => d.created_by).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase.from("users").select("id, display_name").in("id", creatorIds);
      if (profiles) {
        creatorMap = profiles.reduce((acc, p) => { acc[p.id] = p.display_name; return acc; }, {} as Record<string, string>);
      }
    }
    const decks: Deck[] = data.map((deck) => ({ ...deck, created_by_name: deck.created_by ? creatorMap[deck.created_by] : undefined }));
    return { decks };
  } catch (error) { return { decks: [], error: "An unexpected error occurred" }; }
}

export async function createDeck(deck: Deck): Promise<{ success: boolean; deckId?: string; error?: string }> {
  const supabase = await createServerClient();
  try {
    const authCheck = await verifyTeamMembership(deck.team_id, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };

    // Enforce 3-deck-per-user-per-team limit (excludes system-generated decks where created_by is null)
    const { count, error: countError } = await supabase
      .from('team_decks')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', deck.team_id)
      .eq('created_by', authCheck.userId);

    if (countError) return { success: false, error: 'Failed to check deck limit' };
    if ((count ?? 0) >= 3) return { success: false, error: 'You have reached the maximum of 3 decks per team. Please delete a deck before creating a new one.' };

    const { data, error } = await supabase.from("team_decks").insert({ team_id: deck.team_id, deck_name: deck.deck_name, description: deck.description, format: deck.format || "standard", is_public: deck.is_public || false, created_by: authCheck.userId }).select().single();
    if (error) return { success: false, error: `Database error: ${error.message}` };
    return { success: true, deckId: data.id };
  } catch (error) { return { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` }; }
}

export async function deleteDeck(deckId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const teamId = await getDeckTeamId(deckId);
    if (!teamId) return { success: false, error: "Deck not found" };
    const authCheck = await verifyTeamMembership(teamId, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };
    const { error } = await supabase.from("team_decks").delete().eq("id", deckId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) { return { success: false, error: "An unexpected error occurred" }; }
}

export async function getDeckCards(deckId: string): Promise<{ cards: DeckCard[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    const { data, error } = await supabase.from("deck_cards").select("*").eq("deck_id", deckId).order("category", { ascending: true });
    if (error) return { cards: [], error: error.message };
    return { cards: data || [] };
  } catch (error) { return { cards: [], error: "An unexpected error occurred" }; }
}

export async function addCardToDeck(deckCard: DeckCard): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const teamId = await getDeckTeamId(deckCard.deck_id);
    if (!teamId) return { success: false, error: "Deck not found" };
    const authCheck = await verifyTeamMembership(teamId, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };
    if (deckCard.draft_pick_id) {
        const { data: existingCard, error: checkError } = await supabase.from("deck_cards").select("id").eq("deck_id", deckCard.deck_id).eq("draft_pick_id", deckCard.draft_pick_id).single();
        if (checkError && checkError.code !== 'PGRST116') return { success: false, error: "Database error." };
        if (existingCard) return { success: false, error: "This card is already in the deck." };
    }
    const { error } = await supabase.from("deck_cards").insert({ ...deckCard });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) { return { success: false, error: "An unexpected error occurred" }; }
}

export async function updateDeckCardQuantity(cardId: string, newQuantity: number): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const teamId = await getDeckCardTeamId(cardId);
    if (!teamId) return { success: false, error: "Card not found" };
    const authCheck = await verifyTeamMembership(teamId, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };
    const { error } = await supabase.from("deck_cards").update({ quantity: newQuantity }).eq("id", cardId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) { return { success: false, error: "An unexpected error occurred" }; }
}

export async function removeCardFromDeck(cardId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const teamId = await getDeckCardTeamId(cardId);
    if (!teamId) return { success: false, error: "Card not found" };
    const authCheck = await verifyTeamMembership(teamId, supabase);
    if (!authCheck.authorized) return { success: false, error: authCheck.error };
    const { error } = await supabase.from("deck_cards").delete().eq("id", cardId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) { return { success: false, error: "An unexpected error occurred" }; }
}

export async function toggleKeeperStatus(pickId: string, isKeeper: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  try {
    const { error } = await supabase
      .from('team_draft_picks')
      .update({ is_keeper: isKeeper })
      .eq('id', pickId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

