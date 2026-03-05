// src/app/actions/cardActions.ts

"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

export interface CardData {
  name: string;
  // --- FIX: Corrected to match the database schema ---
  card_type: string; 
  image_url: string;
}

/**
 * Fetches data for a list of card names from the card_pools table.
 * This is used by the replay viewer to get card types and image URLs.
 * @param cardNames The list of card names present in the game log.
 * @returns A Map where keys are canonical card names and values are their data.
 */
export async function getCardDataForReplay(cardNames: string[]): Promise<Map<string, CardData>> {
  if (!cardNames || cardNames.length === 0) {
    return new Map();
  }

  const supabase = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  
  try {
    // --- FIX: Corrected column name in select statement ---
    const { data, error } = await supabase
      .from('card_pools')
      .select('card_name, card_type, image_url')
      .in('card_name', cardNames);

    if (error) {
      console.error("Error fetching card data for replay:", error);
      return new Map();
    }

    const cardDataMap = new Map<string, CardData>();
    if (data) {
      for (const card of data) {
        cardDataMap.set(card.card_name, {
          name: card.card_name,
          card_type: card.card_type,
          image_url: card.image_url,
        });
      }
    }
    
    return cardDataMap;

  } catch (err) {
    console.error("Unexpected error in getCardDataForReplay:", err);
    return new Map();
  }
}
