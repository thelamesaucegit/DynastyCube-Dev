// src/app/actions/marketplaceActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// Helper to reliably deduct Essence and log the transaction
async function processEssenceTransaction(
  supabase: any,
  userId: string,
  cost: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch current balance
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('essence_balance')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    return { success: false, error: "Failed to verify Essence balance." };
  }

  if (userData.essence_balance < cost) {
    return { success: false, error: `Insufficient Essence. You need ${cost} €.` };
  }

  const newBalance = userData.essence_balance - cost;

  // 2. Deduct from balance
  const { error: updateError } = await supabase
    .from('users')
    .update({ essence_balance: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: "Failed to deduct Essence." };
  }

  // 3. Log transaction
  const { error: txError } = await supabase.from('essence_transactions').insert({
    user_id: userId,
    transaction_type: "spend",
    amount: -cost,
    balance_after: newBalance,
    description: description,
    created_by: userId
  });

  if (txError) {
    console.error("Failed to log transaction:", txError);
    // Non-fatal, let the transaction succeed
  }

  return { success: true };
}

// ============================================================================
// MARKETPLACE PURCHASES
// ============================================================================

/**
 * €150: Add a Booster Pack to The Chamber (at random).
 * Grabs 15 random cards (excluding un/funny/alchemy/mdfc) and drops them in 'the_chamber'.
 */
export async function purchaseRandomBooster(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const COST = 150;

    // 1. Process the payment
    const payment = await processEssenceTransaction(supabase, user.id, COST, "Purchased: Random Booster to The Chamber");
    if (!payment.success) return { success: false, error: payment.error };

    // 2. Fetch 15 random cards using Scryfall API
    // Using a robust query to filter out un-sets and dual-faced cards just like the escape room!
    const scryfallQuery = "-is:ub -st:funny -is:dfc -is:mdfc";
    const scryfallUrl = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(scryfallQuery)}`;

    const generatedCards = [];

    // Loop to fetch 15 distinct random cards
    // Note: To be kind to Scryfall's rate limits, we should do this with a slight delay, 
    // or fetch fewer if API limits become an issue. 15 rapid calls is okay for rare purchases.
    for (let i = 0; i < 15; i++) {
        const response = await fetch(scryfallUrl, {
            headers: { 'User-Agent': 'DynastyCube/1.0', 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const card = await response.json();
            const imageUris = card.image_uris as Record<string, string> | undefined;
            
            generatedCards.push({
                card_id: String(card.id),
                card_name: String(card.name),
                card_set: String((card.set as string).toUpperCase()),
                card_type: String(card.type_line),
                rarity: String(card.rarity),
                colors: Array.isArray(card.colors) ? card.colors : [],
                color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
                image_url: imageUris?.normal || imageUris?.large || null,
                oracle_id: String(card.oracle_id),
                mana_cost: card.mana_cost ? String(card.mana_cost) : null,
                cmc: typeof card.cmc === 'number' ? card.cmc : 0,
                cubucks_cost: 0, 
                pool_name: 'the_chamber' // Direct to the chamber!
            });
        }
        // Artificial delay of 100ms to respect Scryfall guidelines (max 10 requests per second)
        await new Promise(r => setTimeout(r, 100));
    }

    if (generatedCards.length === 0) {
        // Critical failure rollback
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        return { success: false, error: "Failed to generate booster cards. Essence refunded." };
    }

    // 3. Bulk insert the cards into The Chamber
    const { error: insertError } = await supabase.from('card_pools').insert(generatedCards);

    if (insertError) {
        // Critical failure rollback
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        console.error("Pool Insert Error:", insertError);
        return { success: false, error: "Database error injecting cards. Essence refunded." };
    }

    await logSystemEvent("Marketplace", "info", `User ${user.id} purchased a Random Booster for The Chamber (15 cards added).`);

    return { success: true, message: `Successfully purchased! 15 random cards have materialized in The Chamber.` };

  } catch (error) {
    console.error("Error in purchaseRandomBooster:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
