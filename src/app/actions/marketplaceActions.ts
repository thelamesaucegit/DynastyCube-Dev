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
 * THE FIX: Explicit Response type annotation added to fix implicit any circular inference loops
 */
async function generateBoosterFromSet(setCode: string): Promise<Record<string, string | number | string[] | null>[]> {
    let scryfallUrl: string | null = `https://api.scryfall.com/cards/search?q=e:${setCode}+is:firstprint+-is:promo+-is:showcase+-border:borderless+-is:dfc+-is:mdfc`;
    const allSetCards: Record<string, unknown>[] = [];

    while (scryfallUrl) {
        // THE FIX: Explicitly typed as Response
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

// --- Action to move a card from The Drain to The Wire ---
export async function reclaimFromDrain(cardPoolId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Authentication required." };

        // 1. Verify the card is actually in the drain
        const { data: card, error: fetchError } = await supabase
            .from('card_pools')
            .select('id, pool_name')
            .eq('id', cardPoolId)
            .single();

        if (fetchError || !card || card.pool_name !== 'drainlings') {
            return { success: false, error: "Card is not in The Drain or does not exist." };
        }
        
        // (This is a simplified check. You may need a more robust way to identify the active season's Drainlings roster)
        const { data: drainPick } = await supabase.from('team_draft_picks').select('id').eq('card_pool_id', cardPoolId).maybeSingle();
        if (drainPick) {
             return { success: false, error: "This card is part of an active roster and cannot be reclaimed." };
        }

        // 2. Perform the update
        const { error: updateError } = await supabase
            .from('card_pools')
            .update({ 
                pool_name: 'wire',
                on_wire_since: new Date().toISOString()
            })
            .eq('id', cardPoolId);

        if (updateError) throw updateError;

        // 3. TODO: Deduct Essence cost from the user's balance
        // await supabase.rpc('decrement_essence', { p_user_id: user.id, p_amount: 100 });

        return { success: true };
    } catch (e) {
        const error = e as Error;
        console.error("Error in reclaimFromDrain:", error.message);
        return { success: false, error: error.message };
    }
}

export async function purchaseRandomBooster(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const COST = 150;

    const { data: eligibleSets, error: setErr } = await supabase
        .from('chamber_records')
        .select('set_code, set_name')
        .eq('added', false)
        .eq('in_chamber', false);

    if (setErr || !eligibleSets || eligibleSets.length === 0) {
        return { success: false, error: "No eligible sets remain in the repository." };
    }

    const payment = await processEssenceTransaction(supabase, user.id, COST, "Purchased: Random Booster");
    if (!payment.success) return { success: false, error: payment.error };

    const randomSet = eligibleSets[Math.floor(Math.random() * eligibleSets.length)];
    const packCards = await generateBoosterFromSet(randomSet.set_code);

    if (packCards.length === 0) {
        await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
        return { success: false, error: `Failed to extract cards from ${randomSet.set_name}. Essence refunded.` };
    }

    const { error: insertError } = await supabase.from('the_chamber').insert(packCards);
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
  
      const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
      if (!teamMember) return { success: false, error: "You must be on a team to purchase this item." };

      const { data: team } = await supabase.from('teams').select('plane, name').eq('id', teamMember.team_id).single();
      if (!team || !team.plane) return { success: false, error: "Your team has no designated Home Plane." };
  
      const { data: eligibleSets, error: setErr } = await supabase
          .from('chamber_records')
          .select('set_code, set_name')
          .eq('added', false)
          .eq('in_chamber', false)
          .ilike('plane', `%${team.plane}%`);
  
      if (setErr || !eligibleSets || eligibleSets.length === 0) {
          return { success: false, error: `No unreleased sets remain for the plane of ${team.plane}.` };
      }
  
      const payment = await processEssenceTransaction(supabase, user.id, COST, `Purchased: Home Plane Booster (${team.plane})`);
      if (!payment.success) return { success: false, error: payment.error };
  
      const randomSet = eligibleSets[Math.floor(Math.random() * eligibleSets.length)];
      const packCards = await generateBoosterFromSet(randomSet.set_code);
  
      if (packCards.length === 0) {
          await supabase.from('users').update({ essence_balance: (await supabase.from('users').select('essence_balance').eq('id', user.id).single()).data?.essence_balance + COST }).eq('id', user.id);
          return { success: false, error: `Failed to extract cards from ${randomSet.set_name}. Essence refunded.` };
      }
  
      const { error: insertError } = await supabase.from('the_chamber').insert(packCards);
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

// ============================================================================
// MARKET MANIPULATION
// ============================================================================

export async function searchCardsForManipulation(query: string) {
    try {
        const supabase = await createServerClient();

        const { data: activeDraft } = await supabase
            .from('draft_sessions')
            .select('id')
            .eq('status', 'active')
            .maybeSingle();
        const isActiveDraft = !!activeDraft;

        // Query card_pools
        let poolQuery = supabase
            .from('card_pools')
            .select('id, card_name, card_set, cubucks_cost, image_url, pool_name')
            .ilike('card_name', `%${query}%`)
            .eq('hidden', false)
            .limit(30);

        // Only exclude draft pool cards if a draft is active
        if (isActiveDraft) {
            poolQuery = poolQuery.neq('pool_name', 'draft');
        }

        // Query the_chamber (no draft restriction applies here)
        const chamberQuery = supabase
            .from('the_chamber')
            .select('id, card_name, card_set, cubucks_cost, image_url, pool_name')
            .ilike('card_name', `%${query}%`)
            .eq('hidden', false)
            .limit(30);

        const [{ data: poolCards, error: poolError }, { data: chamberCards, error: chamberError }] =
            await Promise.all([poolQuery, chamberQuery]);

        if (poolError || chamberError) return { success: false, cards: [] };

        const cards = [...(poolCards || []), ...(chamberCards || [])];
        if (cards.length === 0) return { success: true, cards: [] };

        // Filter out cards already drafted (only relevant for card_pools, but safe to run across all ids)
        const cardIds = cards.map(c => c.id);
        const { data: drafted } = await supabase
            .from('team_draft_picks')
            .select('card_pool_id')
            .in('card_pool_id', cardIds);

        const draftedIds = new Set(drafted?.map(d => d.card_pool_id) || []);
        const eligibleCards = cards.filter(c => !draftedIds.has(c.id)).slice(0, 10);

        return { success: true, cards: eligibleCards };
    } catch (e) {
        console.error("Error searching cards:", e);
        return { success: false, cards: [] };
    }
}

export async function purchaseMarketManipulation(
    cardPoolId: string,
    direction: 'increase' | 'decrease'
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const COST = 100;

        // Check card_pools first, then fall back to the_chamber
        let card: { id: string; card_name: string; cubucks_cost: number; pool_name: string; source: 'card_pools' | 'the_chamber' } | null = null;

        const { data: poolCard } = await supabase
            .from('card_pools')
            .select('id, card_name, cubucks_cost, pool_name')
            .eq('id', cardPoolId)
            .maybeSingle();

        if (poolCard) {
            card = { ...poolCard, source: 'card_pools' };
        } else {
            const { data: chamberCard } = await supabase
                .from('the_chamber')
                .select('id, card_name, cubucks_cost, pool_name')
                .eq('id', cardPoolId)
                .maybeSingle();

            if (chamberCard) {
                card = { ...chamberCard, source: 'the_chamber' };
            }
        }

        if (!card) return { success: false, error: "Card not found." };

        // Draft pick check (only meaningful for card_pools, but harmless to run universally)
        const { data: drafted } = await supabase
            .from('team_draft_picks')
            .select('id')
            .eq('card_pool_id', cardPoolId)
            .maybeSingle();
        if (drafted) return { success: false, error: "This card was just acquired by a team and is no longer eligible." };

        // Draft session restriction: only block card_pools cards with pool_name='draft'
        const { data: activeDraft } = await supabase
            .from('draft_sessions')
            .select('id')
            .eq('status', 'active')
            .maybeSingle();
        if (activeDraft && card.source === 'card_pools' && card.pool_name === 'draft') {
            return { success: false, error: "Cards in the Draft Pool are ineligible during an active draft." };
        }

        const currentCost = card.cubucks_cost || 1;
        const newCost = direction === 'increase' ? currentCost + 1 : currentCost - 1;

        if (newCost < 1) {
            return { success: false, error: "Market failure: A card's cost cannot be reduced below Ç1." };
        }

        const payment = await processEssenceTransaction(
            supabase,
            user.id,
            COST,
            `Market Manipulation: ${direction}d cost of ${card.card_name}`
        );
        if (!payment.success) return { success: false, error: payment.error };

        const table = card.source;
        const { error: updateError } = await supabase
            .from(table)
            .update({ cubucks_cost: newCost })
            .eq('id', cardPoolId);

        if (updateError) {
            await supabase
                .from('users')
                .update({
                    essence_balance:
                        (await supabase.from('users').select('essence_balance').eq('id', user.id).single())
                            .data?.essence_balance + COST
                })
                .eq('id', user.id);
            return { success: false, error: "Database error altering market. Essence refunded." };
        }

        await logSystemEvent(
            "Marketplace",
            "info",
            `User ${user.id} manipulated market: ${card.card_name} changed from ${currentCost} to ${newCost}.`
        );

        return { success: true, message: `Successfully ${direction}d the cost of ${card.card_name} to Ç${newCost}!` };
    } catch (e) {
        console.error("Error manipulating market:", e);
        return { success: false, error: "An unexpected error occurred." };
    }
}
