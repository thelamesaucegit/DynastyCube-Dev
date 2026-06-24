// src/app/actions/marketplaceActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// Typed supabase client strictly using ReturnType rather than any
async function processEssenceTransaction(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  cost: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('essence_balance')
    .eq('id', userId)
    .single();

  if (userError || !userData) return { success: false, error: "Failed to verify Essence balance." };
  if (userData.essence_balance < cost) return { success: false, error: `Insufficient Essence. You need ${cost} €.` };

  const newBalance = userData.essence_balance - cost;
  const { error: updateError } = await supabase.from('users').update({ essence_balance: newBalance }).eq('id', userId);
  if (updateError) return { success: false, error: "Failed to deduct Essence." };

  await supabase.from('essence_transactions').insert({
    user_id: userId, transaction_type: "spend", amount: -cost, balance_after: newBalance, description, created_by: userId
  });

  return { success: true };
}

/**
 * Standard Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * Helper to fetch a properly constructed booster pack from Scryfall
 */
async function generateBoosterFromSet(setCode: string): Promise<Record<string, string | number | string[] | null>[]> {
    let scryfallUrl: string | null = `https://api.scryfall.com/cards/search?q=e:${setCode}+is:firstprint+-is:promo+-is:showcase+-border:borderless+-is:dfc+-is:mdfc`;
    const allSetCards: Record<string, unknown>[] = [];

    while (scryfallUrl) {
        const response: Response = await fetch(scryfallUrl, {
            headers: { 'User-Agent': 'DynastyCube/1.0', 'Accept': 'application/json' }
        });
        
        if (!response.ok) break; 
        
        const data = await response.json();
        if (data.data) allSetCards.push(...(data.data as Record<string, unknown>[]));
        
        scryfallUrl = data.has_more ? data.next_page : null;
        if (scryfallUrl) await new Promise(r => setTimeout(r, 100)); 
    }

    if (allSetCards.length === 0) return [];

    const commons = shuffleArray(allSetCards.filter(c => c.rarity === 'common'));
    const uncommons = shuffleArray(allSetCards.filter(c => c.rarity === 'uncommon'));
    const raresAndMythics = shuffleArray(allSetCards.filter(c => c.rarity === 'rare' || c.rarity === 'mythic'));

    const pack = [
        ...raresAndMythics.slice(0, 1),
        ...uncommons.slice(0, 3),
        ...commons.slice(0, 11)
    ];

    if (pack.length < 15) {
        const remainingNeeded = 15 - pack.length;
        const usedIds = new Set(pack.map(c => c.id as string));
        const unusedCards = shuffleArray(allSetCards.filter(c => !usedIds.has(c.id as string)));
        pack.push(...unusedCards.slice(0, remainingNeeded));
    }

    return pack.map(card => {
        const imageUris = card.image_uris as Record<string, string> | undefined;
        return {
            card_id: String(card.id),
            card_name: String(card.name),
            card_set: String((card.set as string).toUpperCase()),
            card_type: String(card.type_line),
            rarity: String(card.rarity),
            colors: Array.isArray(card.colors) ? (card.colors as string[]) : [],
            color_identity: Array.isArray(card.color_identity) ? (card.color_identity as string[]) : [],
            image_url: imageUris?.normal || imageUris?.large || null,
            oracle_id: String(card.oracle_id),
            mana_cost: card.mana_cost ? String(card.mana_cost) : null,
            cmc: typeof card.cmc === 'number' ? card.cmc : 0,
            cubucks_cost: 0, 
            pool_name: 'chamber' 
        };
    });
}

// ============================================================================
// MARKETPLACE PURCHASES
// ============================================================================

export async function reclaimFromDrain(cardPoolId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Authentication required." };
    
    const COST = 200;

    try {
        // --- Validation checks ---
        const { data: card, error: fetchError } = await supabase
            .from('card_pools')
            .select('id, card_name, pool_name')
            .eq('id', cardPoolId)
            .single();

        if (fetchError || !card) return { success: false, error: "Card not found." };
        if (card.pool_name !== 'drainlings') return { success: false, error: "This card is not in The Drain." };

        const DRAINLINGS_TEAM_ID = '90177632-f6ab-4501-b235-3590a7e46472';
        const { data: activeSubmission } = await supabase
            .from('deck_submissions')
            .select('deck_list')
            .eq('team_id', DRAINLINGS_TEAM_ID)
            .eq('is_current', true)
            .maybeSingle();

        if (activeSubmission?.deck_list?.includes(card.card_name)) {
            return { success: false, error: "This card is part of the Drainlings' active deck and cannot be reclaimed." };
        }

        // --- Process Payment ---
        const payment = await processEssenceTransaction(supabase, user.id, COST, `Reclaimed: ${card.card_name}`);
        if (!payment.success) return { success: false, error: payment.error };

        // --- Perform Update ---
        const { error: updateError } = await supabase
            .from('card_pools')
            .update({ pool_name: 'wire', on_wire_since: new Date().toISOString() })
            .eq('id', cardPoolId);

        if (updateError) throw updateError; // The catch block will handle refund

        return { success: true, message: `Successfully reclaimed ${card.card_name} and placed it on The Wire!` };
    } catch (e) {
        const error = e as Error;
        console.error("Error in reclaimFromDrain:", error.message);

        // --- Refund Logic on Failure ---
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        
        return { success: false, error: `An error occurred: ${error.message}. Your Essence has been refunded.` };
    }
}

export async function reinvigorateFromRetirement(retiredCardId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Authentication required." };

    const COST = 250;

    try {
        // --- Process Payment ---
        const payment = await processEssenceTransaction(supabase, user.id, COST, "Reinvigorated a retired card");
        if (!payment.success) return { success: false, error: payment.error };

        // --- Perform Update via RPC ---
        const { data: rpcData, error: rpcError } = await supabase.rpc('reinvigorate_retired_card', { p_retired_card_id: retiredCardId });
        
        if (rpcError) throw rpcError;

        return { success: true, message: `Successfully reinvigorated ${rpcData.reclaimed_card_name} and placed it on The Wire!` };
    } catch (e) {
        const error = e as Error;
        console.error("Error in reinvigorateFromRetirement:", error.message);
        
        // --- Refund Logic on Failure ---
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').
