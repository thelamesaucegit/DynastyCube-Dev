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
async function generateBoosterFromSet(setCode: string): Promise<any[]> {
    // We strictly filter for first printings (no reprints), removing variants and double-sided cards
    let scryfallUrl: string | null = `https://api.scryfall.com/cards/search?q=e:${setCode}+is:firstprint+-is:promo+-is:showcase+-border:borderless+-is:dfc+-is:mdfc`;
    let allSetCards: any[] = [];

    // Fetch all pages of the set
    while (scryfallUrl) {
        const response = await fetch(scryfallUrl, {
            headers: { 'User-Agent': 'DynastyCube/1.0', 'Accept': 'application/json' }
        });
        
        if (!response.ok) break; // End of pages or error
        
        const data = await response.json();
        if (data.data) allSetCards.push(...data.data);
        
        scryfallUrl = data.has_more ? data.next_page : null;
        if (scryfallUrl) await new Promise(r => setTimeout(r, 100)); // Respect Scryfall Rate Limits
    }

    if (allSetCards.length === 0) return [];

    // Sort into rarities
    const commons = shuffleArray(allSetCards.filter(c => c.rarity === 'common'));
    const uncommons = shuffleArray(allSetCards.filter(c => c.rarity === 'uncommon'));
    const raresAndMythics = shuffleArray(allSetCards.filter(c => c.rarity === 'rare' || c.rarity === 'mythic'));

    // Construct the Pack: 1 R/M, 3 U, 11 C (with safety fallbacks if set is unusually small)
    const pack = [
        ...raresAndMythics.slice(0, 1),
        ...uncommons.slice(0, 3),
        ...commons.slice(0, 11)
    ];

    // If the set didn't have enough specific rarities (very rare, e.g. mini sets), 
    // pad the rest of the 15 cards randomly from whatever is left.
    if (pack.length < 15) {
        const remainingNeeded = 15 - pack.length;
        const usedIds = new Set(pack.map(c => c.id));
        const unusedCards = shuffleArray(allSetCards.filter(c => !usedIds.has(c.id)));
        pack.push(...unusedCards.slice(0, remainingNeeded));
    }

    // Map to DB Schema
    return pack.map(card => {
        const imageUris = card.image_uris as Record<string, string> | undefined;
        return {
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
            pool_name: 'the_chamber' 
        };
    });
}


// ============================================================================
// MARKETPLACE PURCHASES
// ============================================================================

export async function purchaseRandomBooster(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const COST = 150;

    // 1. Fetch an eligible random set
    const { data: eligibleSets, error: setErr } = await supabase
        .from('chamber_records')
        .select('set_code, set_name')
        .eq('added', false)
        .eq('in_chamber', false);

    if (setErr || !eligibleSets || eligibleSets.length === 0) {
        return { success: false, error: "No eligible sets remain in the repository." };
    }

    // 2. Charge the user
    const payment = await processEssenceTransaction(supabase, user.id, COST, "Purchased: Random Booster");
    if (!payment.success) return { success: false, error: payment.error };

    // 3. Generate the Booster
    const randomSet = eligibleSets[Math.floor(Math.random() * eligibleSets.length)];
    const packCards = await generateBoosterFromSet(randomSet.set_code);

    if (packCards.length === 0) {
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        return { success: false, error: `Failed to extract cards from ${randomSet.set_name}. Essence refunded.` };
    }

    // 4. Insert into the Chamber
    const { error: insertError } = await supabase.from('card_pools').insert(packCards);
    if (insertError) {
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        return { success: false, error: "Database error injecting cards. Essence refunded." };
    }

    await logSystemEvent("Marketplace", "info", `User ${user.id} purchased a Random Booster (${randomSet.set_name}).`);
    return { success: true, message: `Purchased a ${randomSet.set_name} Booster! 15 new cards added to The Chamber.` };

  } catch (error) {
    console.error("Error in purchaseRandomBooster:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function purchaseHomePlaneBooster(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };
  
      const COST = 100;
  
      // 1. Identify User's Team & Home Plane
      const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
      if (!teamMember) return { success: false, error: "You must be on a team to purchase this item." };

      const { data: team } = await supabase.from('teams').select('plane, name').eq('id', teamMember.team_id).single();
      if (!team || !team.plane) return { success: false, error: "Your team has no designated Home Plane." };
  
      // 2. Fetch eligible sets restricted by Plane
      const { data: eligibleSets, error: setErr } = await supabase
          .from('chamber_records')
          .select('set_code, set_name')
          .eq('added', false)
          .eq('in_chamber', false)
          .ilike('plane', `%${team.plane}%`);
  
      if (setErr || !eligibleSets || eligibleSets.length === 0) {
          return { success: false, error: `No unreleased sets remain for the plane of ${team.plane}.` };
      }
  
      // 3. Charge the user
      const payment = await processEssenceTransaction(supabase, user.id, COST, `Purchased: Home Plane Booster (${team.plane})`);
      if (!payment.success) return { success: false, error: payment.error };
  
      // 4. Generate the Booster
      const randomSet = eligibleSets[Math.floor(Math.random() * eligibleSets.length)];
      const packCards = await generateBoosterFromSet(randomSet.set_code);
  
      if (packCards.length === 0) {
          await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
          return { success: false, error: `Failed to extract cards from ${randomSet.set_name}. Essence refunded.` };
      }
  
      // 5. Insert into the Chamber
      const { error: insertError } = await supabase.from('card_pools').insert(packCards);
      if (insertError) {
          await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
          return { success: false, error: "Database error injecting cards. Essence refunded." };
      }
  
      await logSystemEvent("Marketplace", "info", `User ${user.id} purchased a Home Plane Booster (${randomSet.set_name}).`);
      return { success: true, message: `Purchased a ${randomSet.set_name} Booster! 15 cards from ${team.plane} added to The Chamber.` };
  
    } catch (error) {
      console.error("Error in purchaseHomePlaneBooster:", error);
      return { success: false, error: "An unexpected error occurred." };
    }
  }
