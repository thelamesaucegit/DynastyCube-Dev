// src/app/actions/replayActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export async function fetchReplayMetadata(cardNames: string[]) {
    if (!cardNames || cardNames.length === 0) return { success: true, cards: [] };

    const supabase = await createServerClient();
    
    // Fetch all matching cards from the pool
    const { data, error } = await supabase
        .from('card_pools')
        .select('card_id, card_name, card_type, image_url, oldest_image_url, colors')
        .in('card_name', cardNames);

    if (error) {
        console.error("Error fetching replay metadata:", error);
        return { success: false, error: error.message, cards: [] };
    }

    return { success: true, cards: data || [] };
}
