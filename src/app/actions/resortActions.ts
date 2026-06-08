// src/app/actions/resortActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export interface ResortCard {
  id?: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  color_identity?: string[];
  image_url?: string | null;
  oldest_image_url?: string | null;
  oracle_id?: string | null;
  oracle_text?: string | null; 
  hidden?: boolean; // <-- THE FIX 1: Made optional with '?' so partial selects don't fail!
  mana_cost?: string;
  cmc?: number;
  pool_name?: string;
  cubucks_cost?: number;
  created_at?: string;
  cubecobra_elo?: number;
  rating_updated_at?: string;
  vote_count: number; 
}

export interface ResortCardWithVote extends ResortCard {
  team_has_voted_for: boolean;
}

// This function will find the correct poll for a team and add a card as an option.
export async function nominateResortCard(
  resortCardId: string,
  teamId: string,
  cardName: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createServerClient();
  try {
    // 1. Find the active "Resort Pool Vote" poll for the given team.
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("id")
      .eq("team_id", teamId)
      .like("title", "Resort Pool Vote%") // Find the right poll by its title
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pollError || !poll) {
      return { success: false, error: "Could not find an active resort poll for your team." };
    }

    // 2. Check if this card is already an option in this poll.
    const { data: existingOption, error: checkError } = await supabase
      .from("poll_options")
      .select("id")
      .eq("poll_id", poll.id)
      .eq("resort_card_id", resortCardId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // Ignore 'no rows' error
        throw checkError;
    }

    if (existingOption) {
      return { success: true, message: `${cardName} has already been nominated.` };
    }

    // 3. If not, add the card as a new poll option.
    const { error: insertError } = await supabase
      .from("poll_options")
      .insert({
        poll_id: poll.id,
        option_text: cardName, // The display text for the option is the card's name.
        resort_card_id: resortCardId, // This links the option back to the card.
      });

    if (insertError) throw insertError;
    return { success: true, message: `Successfully nominated ${cardName} for your team!` };

  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("Error in nominateResortCard:", message);
    return { success: false, error: message };
  }
}

export async function getResortCards(teamId?: string): Promise<{ cards: ResortCardWithVote[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    // THE FIX 2: Selecting '*' allows us to load all the metrics for the search filters securely
    const { data: cards, error: cardsError } = await supabase
      .from("resort_pool")
      .select("*") 
      .eq('hidden', false)
      .order("card_name", { ascending: true });

    if (cardsError) throw cardsError;

    let teamVoteId: string | null = null;
    if (teamId) {
      const { data: voteData } = await supabase
        .from("resort_pool_votes")
        .select("resort_card_id")
        .eq("team_id", teamId)
        .single();
      
      if (voteData) {
        teamVoteId = voteData.resort_card_id;
      }
    }

    const cardsWithVoteStatus: ResortCardWithVote[] = (cards || []).map(card => ({
        ...card,
        team_has_voted_for: card.id === teamVoteId,
    }));
    return { cards: cardsWithVoteStatus };

  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("Error in getResortCards:", message);
    return { cards: [], error: message };
  }
}

export async function castResortVote(teamId: string, resortCardId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { error } = await supabase
            .from("resort_pool_votes")
            .upsert({ team_id: teamId, resort_card_id: resortCardId }, { onConflict: 'team_id' });

        if (error) throw error;
        
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        console.error("Error in castResortVote:", message);
        return { success: false, error: message };
    }
}
