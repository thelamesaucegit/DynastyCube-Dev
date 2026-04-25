//src/app/actions/resortActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";

export interface ResortCard {
  id: string; // This is the card's unique ID in the resort_pool table
  card_id: string; // This is the Scryfall card_id
  card_name: string;
  image_url: string | null;
  vote_count: number;
}

export interface ResortCardWithVote extends ResortCard {
  team_has_voted_for: boolean;
}

// Gets all cards from the resort_pool
export async function getResortCards(teamId?: string): Promise<{ cards: ResortCardWithVote[]; error?: string }> {
  const supabase = await createServerClient();
  try {
    const { data: cards, error: cardsError } = await supabase
      .from("resort_pool")
      .select("id, card_id, card_name, image_url, vote_count")
      .order("card_name", { ascending: true });

    if (cardsError) throw cardsError;

    let teamVoteId: string | null = null;
    if (teamId) {
      const { data: voteData, error: voteError } = await supabase
        .from("resort_pool_votes")
        .select("resort_card_id")
        .eq("team_id", teamId)
        .single();
      
      if (voteError && voteError.code !== 'PGRST116') { // Ignore 'no rows' error
          console.error("Error fetching team vote:", voteError.message);
      }
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

// Action for a team to cast or change their vote
export async function castResortVote(teamId: string, resortCardId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        // This is an "upsert" operation. It will insert a new vote or update the existing one for the team.
        const { error } = await supabase
            .from("resort_pool_votes")
            .upsert(
                { team_id: teamId, resort_card_id: resortCardId },
                { onConflict: 'team_id' } // This is the crucial part for upserting
            );

        if (error) throw error;
        
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        console.error("Error in castResortVote:", message);
        return { success: false, error: message };
    }
}
