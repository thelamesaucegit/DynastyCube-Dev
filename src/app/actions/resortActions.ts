//src/app/actions/resortActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";

export interface ResortCard {
  id: string;
  card_id: string;
  card_name: string;
  image_url: string | null;
  vote_count: number;
}

export interface ResortCardWithVote extends ResortCard {
  team_has_voted_for: boolean;
}

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
            .upsert(
                { team_id: teamId, resort_card_id: resortCardId },
                { onConflict: 'team_id' }
            );

        if (error) throw error;
        
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        console.error("Error in castResortVote:", message);
        return { success: false, error: message };
    }
}
