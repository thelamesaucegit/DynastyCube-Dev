
// src/app/actions/autoDraftActions.ts

"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addSkippedPick, type DraftPick } from "@/app/actions/draftActions";
import { getTeamBalance } from "@/app/actions/cubucksActions";
import { getDraftStatus } from "@/app/actions/draftOrderActions";
import { getDuplicateCardIdSet } from "@/lib/draftCache";
import { applyHatModifier } from "@/app/actions/hatActions"; 
import { logSystemEvent } from "@/lib/systemLogger";



function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

// ============================================================================
// TYPES
// ============================================================================

export interface AlgorithmDetails {
  top50CardIds: string[];
  colorTotals: Record<string, number>;
  colorAffinityModifiers: Record<string, number>;
  bestColoredCard: { cardId: string; cardName: string; elo: number; color: string } | null;
  bestColorlessCard: { cardId: string; cardName: string; elo: number } | null;
  selectedSource: "colored" | "colorless" | "none";
  teamDraftedColorCounts: Record<string, number>;
  dominantColor: string | null;
}

export interface QueueEntry {
  id?: string; cardPoolId: string; cardId: string; cardName: string; position: number; pinned: boolean;
  source?: "manual_queue" | "algorithm" | "skipped"; cardSet?: string; cardType?: string; rarity?: string; colors?: string[];
  imageUrl?: string; oldest_image_url?: string; manaCost?: string; cmc?: number; cubucksCost?: number; cubecobraElo?: number;
  votes?: string[]; voteThreshold?: number;
}

export interface AutoDraftPreviewResult {
  nextPick: CardData | null;
  source?: "manual_queue" | "algorithm" | "skipped";
  queueDepth: number;
  algorithmDetails?: AlgorithmDetails;
  votes?: string[];
  voteThreshold?: number;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

async function verifyTeamMembership(teamId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { authorized: false, error: "You must be logged in to perform this action" };

    const { data: membership, error: membershipError } = await supabase.from("team_members").select("id").eq("team_id", teamId).eq("user_id", user.id).single();
    if (membershipError || !membership) return { authorized: false, userId: user.id, error: "You must be a member of this team" };

    return { authorized: true, userId: user.id };
}

function countDraftedColors(picks: Array<{ colors?: string[] }>): Record<string, number> {
    const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const pick of picks) {
        if (pick.colors && pick.colors.length > 0) {
            for (const color of pick.colors) {
                counts[color] = (counts[color] || 0) + 1;
            }
        }
    }
    return counts;
}

async function getTeamMemberCount(teamId: string, adminClient?: AnySupabaseClient): Promise<number> {
    const supabase = adminClient ?? await createServerClient();
    const { count, error } = await supabase.from("team_members").select("*", { count: 'exact', head: true }).eq("team_id", teamId);
    if (error) {
        console.error("Error fetching team member count:", error);
        return 1;
    }
    return count || 1;
}

function calculateVoteThreshold(memberCount: number): number {
    return Math.ceil(memberCount * 0.51);
}

// ============================================================================
// DRAFT LOGIC
// ============================================================================

export async function toggleQueuePickVote(teamId: string, cardPoolId: string, draftSessionId: string): Promise<{ success: boolean; pickExecuted: boolean; error?: string }> {
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized || !auth.userId) return { success: false, pickExecuted: false, error: auth.error };

        const supabase = await createServerClient();
        const { data: queueEntry, error: fetchError } = await supabase.from("team_draft_queue").select("id, votes, position").eq("team_id", teamId).eq("card_pool_id", cardPoolId).single();
        
        if (fetchError || !queueEntry) return { success: false, pickExecuted: false, error: "Queue entry not found" };

        let currentVotes: string[] = queueEntry.votes || [];
        const hasVoted = currentVotes.includes(auth.userId);

        if (hasVoted) {
            currentVotes = currentVotes.filter(id => id !== auth.userId);
        } else {
            currentVotes.push(auth.userId);
        }

        const { error: updateError } = await supabase.from("team_draft_queue").update({ votes: currentVotes }).eq("id", queueEntry.id);
        if (updateError) return { success: false, pickExecuted: false, error: "Failed to record vote" };

        const memberCount = await getTeamMemberCount(teamId);
        const threshold = calculateVoteThreshold(memberCount);

        if (currentVotes.length >= threshold && queueEntry.position === 1) {
            const { status: draftStatus } = await getDraftStatus(draftSessionId);
            if (draftStatus?.onTheClock?.teamId === teamId) {
                const pickResult = await executeConfirmedTeamPick(teamId, cardPoolId, draftSessionId, auth.userId);
                if (!pickResult.success) return { success: true, pickExecuted: false, error: pickResult.error };
                return { success: true, pickExecuted: true };
            }
        }
        return { success: true, pickExecuted: false };
    } catch (error) {
        return { success: false, pickExecuted: false, error: "An unexpected error occurred" };
    }
}

async function executeConfirmedTeamPick(teamId: string, cardPoolId: string, draftSessionId: string, userId: string) {
    const supabase = await createServerClient();
    const { cards: availableCards } = await getAvailableCardsForDraft("draft");
    const card = availableCards.find(c => c.id === cardPoolId);

    if (!card) return { success: false, error: "Card is no longer available to be drafted." };

    const { picks: existingPicks } = await getTeamDraftPicks(teamId, draftSessionId);
    const pickNumber = existingPicks.length + 1;

    // --- HAT LOGIC INCORPORATED ---
    let effectiveCost = card.cubucks_cost || 1;
    if (pickNumber === 1) {
        // If this is the very first pick of the season, apply the hat modifiers
        effectiveCost = await applyHatModifier(teamId, effectiveCost);
    }
    // ------------------------------

    const { data, error } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: card.id, p_card_id: card.card_id,
        p_card_name: card.card_name, p_card_set: card.card_set, p_card_type: card.card_type,
        p_rarity: card.rarity, p_colors: card.colors, p_image_url: card.image_url,
        p_oldest_image_url: card.oldest_image_url, p_mana_cost: card.mana_cost, p_cmc: card.cmc,
        p_pick_number: pickNumber, p_cost: effectiveCost,
        p_is_manual_pick: true, p_user_id: userId,
    }).single();

    if (error) { console.error("Atomic draft pick failed (manual):", error); return { success: false, error: error.message }; }

    const newPick = data as DraftPick;
    if (!newPick) return { success: false, error: "Draft pick could not be confirmed in the database." };

    await conditionallyCleanupDraftQueues(card.card_id);

    const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
    const channel = supabase.channel(`draft-updates-${draftSessionId}`);
    await channel.send({ type: 'broadcast', event: 'new_pick', payload: { ...newPick, team_name: teamData?.name || 'Unknown Team' }, });

    return { success: true, pick: newPick };
}

// Updated to accept the exclusion list
export async function computeAutoDraftPick(
  teamId: string,
  draftSessionId: string,
  adminClient?: AnySupabaseClient,
  excludedCardPoolIds: string[] = []
): Promise<{
  recommendation: CardData | null;
  algorithmDetails: AlgorithmDetails | null;
  error?: string;
}> {
  try {
    const { cards: availableCards, error: cardsError } = await getAvailableCardsForDraft("draft", adminClient);
    if (cardsError) return { recommendation: null, algorithmDetails: null, error: cardsError };
    if (availableCards.length === 0) return { recommendation: null, algorithmDetails: null, error: "No available cards in the pool" };

    const { picks: teamPicks } = await getTeamDraftPicks(teamId, draftSessionId, adminClient);
    const { team: teamBalance } = await getTeamBalance(teamId, adminClient);
    const balance = teamBalance?.cubucks_balance ?? 0;

    const alreadyDraftedCardConcepts = new Set(teamPicks.map(p => p.card_id));

    // Wait to apply hat modifier here since we are just checking affordability, we can safely 
    // estimate using base affordability unless we want the algorithm to know the exact cost.
    // For simplicity, the algorithm filters based on base affordability.

    const candidatePool = availableCards
      .filter(card => 
        card.id && 
        !excludedCardPoolIds.includes(card.id) &&
        !alreadyDraftedCardConcepts.has(card.card_id) &&
        (card.cubucks_cost || 0) <= balance
      );
      
    if (candidatePool.length === 0) {
        return { recommendation: null, algorithmDetails: null, error: "No valid or affordable cards available." };
    }

    const LAND_ELO_MODIFIER = 0.8;
    const AFFINITY_BONUS_PER_PICK = 0.1;
    const ANTI_AFFINITY_PENALTY_PER_PICK = 0.05;

    const colorModifiers: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };
    const allColors = ["W", "U", "B", "R", "G"];

    for (const pick of teamPicks) {
      const pickColors = new Set(pick.colors || []);
      if (pickColors.size === 0) continue;
      for (const color of allColors) {
        if (pickColors.has(color)) { colorModifiers[color] += AFFINITY_BONUS_PER_PICK; } else { colorModifiers[color] -= ANTI_AFFINITY_PENALTY_PER_PICK; }
      }
    }

    for (const color of allColors) { colorModifiers[color] = Math.max(0.5, colorModifiers[color]); }

    const sortedCandidates = candidatePool
        .map(card => {
            let elo = card.cubecobra_elo || 1200;
            if (card.card_type?.toLowerCase().includes('land')) elo *= LAND_ELO_MODIFIER;
            const affinity = card.colors && card.colors.length > 0 ? Math.max(...card.colors.map(c => colorModifiers[c] || 1)) : 1;
            return { ...card, effective_elo: elo * affinity };
        })
        .sort((a, b) => b.effective_elo - a.effective_elo);

    const bestPick = sortedCandidates[0] || null;

    return { recommendation: bestPick, algorithmDetails: null };
  } catch (error) {
    console.error("Error computing auto-draft pick:", error);
    return { recommendation: null, algorithmDetails: null, error: "Failed to compute auto-draft pick" };
  }
}

export async function getAutoDraftPreview(
  teamId: string,
  draftSessionId: string,
  adminClient?: AnySupabaseClient,
  excludedCardPoolIds: string[] = []
): Promise<AutoDraftPreviewResult> {
  try {
    const supabase = adminClient ?? createServiceClient(); 
    const { data: queueEntries } = await supabase.from("team_draft_queue").select("*").eq("team_id", teamId).order("position", { ascending: true });
    
    if (queueEntries && queueEntries.length > 0) {
      const { cards: availableCards } = await getAvailableCardsForDraft("draft", adminClient);
      const availableInstanceIds = new Set(availableCards.map(c => c.id));

      for (const entry of queueEntries) {
        if (entry.card_pool_id && availableInstanceIds.has(entry.card_pool_id) && !excludedCardPoolIds.includes(entry.card_pool_id)) {
          const card = availableCards.find(c => c.id === entry.card_pool_id) || null;
          const memberCount = await getTeamMemberCount(teamId, adminClient);
          return { nextPick: card, source: "manual_queue", queueDepth: queueEntries.length, votes: entry.votes || [], voteThreshold: calculateVoteThreshold(memberCount) };
        }
      }
    }

    const { recommendation, algorithmDetails, error } = await computeAutoDraftPick(teamId, draftSessionId, adminClient, excludedCardPoolIds);
    
    return { 
      nextPick: recommendation, 
      source: recommendation ? "algorithm" : "skipped", 
      queueDepth: 0, 
      algorithmDetails: algorithmDetails || undefined, 
      error: error 
    };
  } catch (error) {
    console.error("Error in getAutoDraftPreview:", error);
    return { nextPick: null, source: "algorithm", queueDepth: 0, error: "Failed to get auto-draft preview" };
  }
}

// The main recursive function
export async function executeAutoDraft(
  teamId: string,
  draftSessionId: string,
  adminClient?: AnySupabaseClient,
  excludedCardPoolIds: string[] = []
): Promise<{
  success: boolean;
  pick?: { cardId: string; cardName: string; cost: number };
  source?: "manual_queue" | "algorithm" | "skipped";
  error?: string;
}> {
  try {
    const supabase = adminClient ?? createServiceClient();

    const { status: draftStatus, error: statusError } = await getDraftStatus(draftSessionId, supabase);
    if (statusError || !draftStatus || draftStatus.onTheClock.teamId !== teamId) {
      await logSystemEvent("ExecuteAutoDraft", "error", `Failed: Team ${teamId} is not on the clock or draft status invalid.`, { draftSessionId, statusError });
      return { success: false, error: statusError || "Team not on the clock." };
    }

    const preview = await getAutoDraftPreview(teamId, draftSessionId, supabase, excludedCardPoolIds);
    const cardToAttempt = preview.nextPick;

    if (!cardToAttempt) {
      await logSystemEvent("ExecuteAutoDraft", "warn", `No valid affordable card found for team ${teamId}. Pick will be skipped.`, { excludedCount: excludedCardPoolIds.length });
      
      const { picks: existingPicks } = await getTeamDraftPicks(teamId, draftSessionId, supabase);
      const pickNumber = existingPicks.length + 1;
      
      await addSkippedPick(teamId, pickNumber, draftSessionId, supabase);
      return { success: true, source: "skipped", pick: { cardId: "skipped-pick", cardName: "SKIPPED", cost: 0 }};
    }
    
    const { team: teamBalance } = await getTeamBalance(teamId, supabase);
    const balance = teamBalance?.cubucks_balance ?? 0;
    const { picks: existingPicks } = await getTeamDraftPicks(teamId, draftSessionId, supabase);
    const pickNumber = existingPicks.length + 1;

    let baseCost = cardToAttempt.cubucks_cost || 1;
    if (pickNumber === 1) {
        baseCost = await applyHatModifier(teamId, baseCost, supabase);
    }
    
    const effectiveCost = (preview.source === "manual_queue" && balance <= 0) ? 0 : baseCost;

    const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: cardToAttempt.id,
        p_card_id: cardToAttempt.card_id, p_card_name: cardToAttempt.card_name,
        p_card_set: cardToAttempt.card_set, p_card_type: cardToAttempt.card_type,
        p_rarity: cardToAttempt.rarity, p_colors: cardToAttempt.colors, p_image_url: cardToAttempt.image_url,
        p_oldest_image_url: cardToAttempt.oldest_image_url, p_mana_cost: cardToAttempt.mana_cost,
        p_cmc: cardToAttempt.cmc, p_pick_number: pickNumber, p_cost: effectiveCost,
        p_is_manual_pick: preview.source === "manual_queue", p_user_id: null,
    }).single();
    
    if (rpcError) {
      const isAlreadyDrafted = 
        (rpcError.code === '23505' && rpcError.message.includes('unique_drafted_card_instance')) ||
        (rpcError.code === 'P0001' && rpcError.message.toLowerCase().includes('already been drafted'));

      if (isAlreadyDrafted) {
        await logSystemEvent("ExecuteAutoDraft", "warn", `Card taken: "${cardToAttempt.card_name}". Adding to exclusion list and retrying.`, { cardId: cardToAttempt.id });
        return executeAutoDraft(teamId, draftSessionId, supabase, [...excludedCardPoolIds, cardToAttempt.id!]);
      } else {
        await logSystemEvent("ExecuteAutoDraft", "error", `Atomic auto-draft failed with non-retryable error for team ${teamId}`, { error: rpcError });
        return { success: false, error: `Draft failed: ${rpcError.message}` };
      }
    }

    const newPick = data as DraftPick;
    if (!newPick) {
        await logSystemEvent("ExecuteAutoDraft", "error", "Database returned null after successful RPC draft execution.");
        return { success: false, error: "Draft pick could not be confirmed in the database." };
    }

    const pickSource = preview.source === "manual_queue" ? "manual_queue" : "algorithm";
    
    if (newPick.id) {
        await supabase.from("team_draft_picks").update({ pick_source: pickSource }).eq("id", newPick.id);
    }
    
    await conditionallyCleanupDraftQueues(cardToAttempt.card_id, supabase);
    
    // --- BROADCAST THE AUTODRAFT PICK TO THE UI ---
    const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
    await supabase.channel(`draft-updates-${draftSessionId}`).send({ 
        type: 'broadcast', 
        event: 'new_pick', 
        payload: { 
            ...newPick, 
            team_id: teamId,       
            team_name: teamData?.name || 'Unknown' 
        }
    });

    await logSystemEvent("ExecuteAutoDraft", "info", `Successfully auto-drafted ${cardToAttempt.card_name} for team ${teamId} via ${pickSource}.`);

    return {
      success: true,
      pick: { cardId: cardToAttempt.card_id, cardName: cardToAttempt.card_name, cost: effectiveCost },
      source: preview.source,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    await logSystemEvent("ExecuteAutoDraft", "error", `Unhandled exception in executeAutoDraft for team ${teamId}.`, { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
export async function captainForcePick(teamId: string, cardPoolId: string, draftSessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: "Not authenticated" };

    const { data: roleData } = await supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
    if (!roleData || !["captain", "pilot"].includes(roleData.role ?? "")) {
      return { success: false, error: "Only Captains and Pilots can force a pick." };
    }

    const { status: draftStatus } = await getDraftStatus(draftSessionId);
    if (draftStatus?.onTheClock?.teamId !== teamId) {
      return { success: false, error: "It is not this team's turn to pick." };
    }

    const { cards: availableCards } = await getAvailableCardsForDraft("draft");
    const card = availableCards.find(c => c.id === cardPoolId);
    if (!card) return { success: false, error: "Card is no longer available." };

    const { picks: existingPicks } = await getTeamDraftPicks(teamId, draftSessionId);
    const pickNumber = existingPicks.length + 1;

    const { team: teamBalance } = await getTeamBalance(teamId);
    const balance = teamBalance?.cubucks_balance ?? 0;

    // --- HAT LOGIC INCORPORATED ---
    let baseCost = card.cubucks_cost || 1;
    if (pickNumber === 1) {
        baseCost = await applyHatModifier(teamId, baseCost);
    }
    const effectiveCost = balance >= baseCost ? baseCost : 0;
    // ------------------------------

    const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: card.id,
        p_card_id: card.card_id, p_card_name: card.card_name, p_card_set: card.card_set,
        p_card_type: card.card_type, p_rarity: card.rarity, p_colors: card.colors,
        p_image_url: card.image_url, p_oldest_image_url: card.oldest_image_url,
        p_mana_cost: card.mana_cost, p_cmc: card.cmc, p_pick_number: pickNumber,
        p_cost: effectiveCost, p_is_manual_pick: true, p_user_id: user.id,
    }).single();

    if (rpcError) return { success: false, error: rpcError.message };

    const newPick = data as DraftPick;
    if (!newPick) return { success: false, error: "Pick could not be confirmed." };

    if (newPick.id) {
      await supabase.from("team_draft_picks").update({ pick_source: "captain_force" }).eq("id", newPick.id);
    }
    await conditionallyCleanupDraftQueues(card.card_id);

    const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
    supabase.channel(`draft-updates-${draftSessionId}`).send({
      type: 'broadcast', event: 'new_pick',
      payload: { ...newPick, team_name: teamData?.name || 'Unknown' },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function getTeamDraftQueue(teamId: string, draftSessionId: string, limit: number = 20): Promise<{ queue: QueueEntry[]; error?: string }> {
    try {
        const supabase = await createServerClient();
        const { data: manualEntries, error: queueError } = await supabase.from("team_draft_queue").select("id, card_pool_id, card_id, card_name, position, pinned, votes").eq("team_id", teamId).order("position", { ascending: true });
        
        const memberCount = await getTeamMemberCount(teamId);
        const voteThreshold = calculateVoteThreshold(memberCount);

        if (queueError) { console.error("Error fetching draft queue:", queueError); return { queue: [], error: queueError.message }; }

        const { cards: availableCards, error: availableError } = await getAvailableCardsForDraft("draft");
        if (availableError) { console.error("Error fetching available cards for queue:", availableError); return { queue: [], error: availableError }; }

        const availableMap = new Map<string, CardData>();
        for (const card of availableCards) { if (card.id) { availableMap.set(card.id, card); } }

        const queue: QueueEntry[] = [];
        const usedInstanceIds = new Set<string>();

        for (const entry of manualEntries || []) {
            if (entry.card_pool_id) {
                const cardData = availableMap.get(entry.card_pool_id);
                if (cardData) {
                    queue.push({ id: entry.id, cardPoolId: entry.card_pool_id, cardId: entry.card_id, cardName: entry.card_name, position: queue.length + 1, pinned: entry.pinned, source: "manual_queue", cardSet: cardData.card_set, cardType: cardData.card_type, rarity: cardData.rarity, colors: cardData.colors, imageUrl: cardData.image_url ?? undefined, oldest_image_url: cardData.oldest_image_url ?? undefined, manaCost: cardData.mana_cost, cmc: cardData.cmc, cubucksCost: cardData.cubucks_cost, cubecobraElo: cardData.cubecobra_elo, votes: entry.votes || [], voteThreshold: voteThreshold, });
                    usedInstanceIds.add(entry.card_pool_id);
                }
            }
        }

        if (queue.length < limit) {
            const { picks: teamPicks } = await getTeamDraftPicks(teamId, draftSessionId);
            const draftedColorCounts = countDraftedColors(teamPicks);

            const remainingCards = availableCards.filter((c) => c.id && !usedInstanceIds.has(c.id) && c.cubecobra_elo != null).map((card) => { let modifier = 1; if (card.colors && card.colors.length > 0) { modifier = Math.max(...card.colors.map((c) => 1 + 0.01 * (draftedColorCounts[c] || 0))); } return { card, effectiveElo: (card.cubecobra_elo || 0) * modifier }; }).sort((a, b) => b.effectiveElo - a.effectiveElo);

            for (const { card } of remainingCards) {
                if (queue.length >= limit) break;
                queue.push({ cardPoolId: card.id || "", cardId: card.card_id, cardName: card.card_name, position: queue.length + 1, pinned: false, source: "algorithm", cardSet: card.card_set, cardType: card.card_type, rarity: card.rarity, colors: card.colors, imageUrl: card.image_url ?? undefined, oldest_image_url: card.oldest_image_url ?? undefined, manaCost: card.mana_cost ?? undefined, cmc: card.cmc ?? undefined, cubucksCost: card.cubucks_cost ?? undefined, cubecobraElo: card.cubecobra_elo ?? undefined, });
            }
        }
        return { queue };
    } catch (error) {
        console.error("Error getting team draft queue:", error);
        return { queue: [], error: "Failed to get draft queue" };
    }
}

export async function setTeamDraftQueue(teamId: string, entries: Array<{ cardPoolId: string; cardId: string; cardName: string; position: number; pinned?: boolean; }>): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized || !auth.userId) return { success: false, error: auth.error };

        const supabase = await createServerClient();
        const { data: existingQueue } = await supabase.from("team_draft_queue").select("card_pool_id, votes").eq("team_id", teamId);
        
        const voteMap = new Map<string, string[]>();
        existingQueue?.forEach(e => voteMap.set(e.card_pool_id, e.votes || []));

        const { error: deleteError } = await supabase.from("team_draft_queue").delete().eq("team_id", teamId);
        if (deleteError) { console.error("Error clearing draft queue:", deleteError); return { success: false, error: deleteError.message }; }

        if (entries.length > 0) {
            const rows = entries.map((entry, index) => ({ team_id: teamId, card_pool_id: entry.cardPoolId, card_id: entry.cardId, card_name: entry.cardName, position: index + 1, pinned: entry.pinned || false, added_by: auth.userId, votes: voteMap.get(entry.cardPoolId) || [], }));
            const { error: insertError } = await supabase.from("team_draft_queue").insert(rows);
            if (insertError) { console.error("Error setting draft queue:", insertError); return { success: false, error: insertError.message }; }
        }
        return { success: true };
    } catch (error) { console.error("Error setting team draft queue:", error); return { success: false, error: "Failed to update draft queue" }; }
}

export async function pinCardToQueue(teamId: string, cardPoolId: string, cardId: string, cardName: string, _position?: number): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized || !auth.userId) return { success: false, error: auth.error };

        const supabase = await createServerClient();

        // 1. Remove it if it's already in the queue to avoid duplicates
        await supabase.from("team_draft_queue").delete().eq("team_id", teamId).eq("card_pool_id", cardPoolId);

        // 2. Find the current highest position in the queue
        const { data: maxEntry } = await supabase
            .from("team_draft_queue")
            .select("position")
            .eq("team_id", teamId)
            .order("position", { ascending: false })
            .limit(1)
            .single();

        // 3. Set the new position to be the highest existing position + 1 (or 1 if queue is empty)
        const newPosition = maxEntry && typeof maxEntry.position === 'number' ? maxEntry.position + 1 : 1;

        // 4. Insert at the bottom of the list
        const { error: insertError } = await supabase.from("team_draft_queue").insert({ 
            team_id: teamId, 
            card_pool_id: cardPoolId, 
            card_id: cardId, 
            card_name: cardName, 
            position: newPosition, 
            pinned: true, 
            added_by: auth.userId, 
        });

        if (insertError) { console.error("Error pinning card to queue:", insertError); return { success: false, error: insertError.message }; }
        return { success: true };
    } catch (error) { console.error("Error pinning card to queue:", error); return { success: false, error: "Failed to pin card to queue" }; }
}
export async function removeFromQueue(teamId: string, cardPoolId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized) return { success: false, error: auth.error };

        const supabase = await createServerClient();
        const { data: entry } = await supabase.from("team_draft_queue").select("position").eq("team_id", teamId).eq("card_pool_id", cardPoolId).single();
        if (!entry) return { success: true };

        const { error: deleteError } = await supabase.from("team_draft_queue").delete().eq("team_id", teamId).eq("card_pool_id", cardPoolId);
        if (deleteError) return { success: false, error: deleteError.message };

        const { data: remaining } = await supabase.from("team_draft_queue").select("id, position").eq("team_id", teamId).gt("position", entry.position).order("position", { ascending: true });
        for (const item of remaining || []) { await supabase.from("team_draft_queue").update({ position: item.position - 1 }).eq("id", item.id); }

        return { success: true };
    } catch (error) { console.error("Error removing from queue:", error); return { success: false, error: "Failed to remove from queue" }; }
}

export async function clearTeamDraftQueue(teamId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized) return { success: false, error: auth.error };

        const supabase = await createServerClient();
        const { error } = await supabase.from("team_draft_queue").delete().eq("team_id", teamId);
        if (error) return { success: false, error: error.message };

        return { success: true };
    } catch (error) { console.error("Error clearing draft queue:", error); return { success: false, error: "Failed to clear draft queue" }; }
}

export async function conditionallyCleanupDraftQueues(draftedCardId: string, adminClient?: AnySupabaseClient): Promise<{ success: boolean; cleaned: boolean; error?: string }> {
  try {
    const supabase = adminClient ?? await createServerClient();
    const duplicateSet = await getDuplicateCardIdSet();

    if (!duplicateSet.has(draftedCardId)) {
      const { error } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (error) return { success: false, cleaned: false, error: error.message };
      return { success: true, cleaned: true };
    }

    const { cards: availableCards } = await getAvailableCardsForDraft("draft");
    if (!availableCards.some(card => card.card_id === draftedCardId)) {
      const { error } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (error) return { success: false, cleaned: false, error: error.message };
      return { success: true, cleaned: true };
    }

    return { success: true, cleaned: false };
  } catch (error) {
    console.error("Unexpected error in conditional queue cleanup:", error);
    return { success: false, cleaned: false, error: "Failed to clean up draft queues" };
  }
}
