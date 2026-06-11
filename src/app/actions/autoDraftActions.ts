
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

export interface SmartDraftTarget {
    id: string;
    card_id: string;
    card_name: string;
    card_set?: string;
    card_type?: string;
    rarity?: string;
    colors?: string[];
    image_url?: string;
    oldest_image_url?: string;
    mana_cost?: string;
    cmc?: number;
    cubucks_cost?: number;
    color_identity?: string[];
    cubecobra_elo?: number;
    match_weight?: number;
    smart_elo: number;
    effective_elo?: number; 
}

export interface AlgorithmDetails {
  // --- Legacy Properties (Kept to prevent UI/Frontend TS errors) ---
  top50CardIds?: string[];
  colorTotals?: Record<string, number>;
  colorAffinityModifiers?: Record<string, number>;
  bestColoredCard?: { cardId: string; cardName: string; elo: number; color: string } | null;
  bestColorlessCard?: { cardId: string; cardName: string; elo: number } | null;
  selectedSource?: "colored" | "colorless" | "none";
  teamDraftedColorCounts?: Record<string, number>;
  dominantColor?: string | null;
 // --- New JSON Math Snapshot Properties ---
  base_elo?: number;
  effective_elo?: number;
  affinity_multiplier?: number;
  color_counts?: Record<string, number>;
  color_modifiers?: Record<string, number>;
  is_land?: boolean;
  land_penalty?: number;
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
    } catch (_error) {
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
        p_rarity: card.rarity, p_colors: card.colors, 
        p_color_identity: card.color_identity || card.colors || [], // <-- ADDED MISSING ARGUMENT HERE
        p_image_url: card.image_url,
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

// Updated to accept the exclusion list and use the new Smart ELO + Budget Tax logic
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
    const supabase = adminClient ?? createServiceClient();

    // 1. Get Team Context for Budget Math
    const { picks: teamPicks } = await getTeamDraftPicks(teamId, draftSessionId, supabase);
    const { team: teamBalanceData } = await getTeamBalance(teamId, supabase);
    const balance = teamBalanceData?.cubucks_balance ?? 0;
    
    const totalRounds = 40; 
    const picksMade = teamPicks.length;
    const remainingPicks = Math.max(1, totalRounds - picksMade);
    const targetAvgCost = Math.max(0, balance) / remainingPicks;

    // 2. Fetch the Top 100 Smart Targets
    const { data: rawTargets, error: targetError } = await supabase
        .rpc('get_smart_draft_targets', { p_limit: 100 });

    if (targetError) return { recommendation: null, algorithmDetails: null, error: targetError.message };
    
    // STRICT TYPING FIX: Cast the unknown RPC response to our new interface
    const smartTargets = (rawTargets || []) as SmartDraftTarget[];
    
    if (smartTargets.length === 0) return { recommendation: null, algorithmDetails: null, error: "No available cards in the pool" };

    // STRICT TYPING FIX: explicitly type 'card' in the filter
    const candidatePool = smartTargets.filter((card: SmartDraftTarget) => 
        card.id && 
        !excludedCardPoolIds.includes(card.id) &&
        (card.cubucks_cost || 0) <= balance
    );
      
    if (candidatePool.length === 0) {
        return { recommendation: null, algorithmDetails: null, error: "No valid or affordable cards available." };
    }

    const DEFAULT_ELO = 1000;
    const LAND_ELO_MODIFIER = 0.80; 
    const BASE_BONUS = 0.03; 
    const BONUS_DECAY = 0.90; 
    const colorModifiers: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };
    const allColors = ["W", "U", "B", "R", "G"];
    
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    
    for (const pick of teamPicks) {
      const pickColors = new Set(pick.color_identity || pick.colors || []);
      for (const color of allColors) {
        if (pickColors.has(color)) { 
            colorCounts[color]++;
        }
      }
    }

    for (const color of allColors) { 
        let bonus = 0;
        for (let i = 0; i < colorCounts[color]; i++) {
            bonus += BASE_BONUS * Math.pow(BONUS_DECAY, i);
        }
        colorModifiers[color] = 1 + bonus; 
    }
    const maxTeamAffinity = Math.max(...Object.values(colorModifiers), 1);

    // 4. Evaluate Candidates using BUDGET TAX and AFFINITY
    // STRICT TYPING FIX: explicitly type 'card' in the map
    const sortedCandidates = candidatePool
        .map((card: SmartDraftTarget) => {
            let elo = card.smart_elo; 
            const cost = card.cubucks_cost || 0;

            if (cost < targetAvgCost) {
                elo += (targetAvgCost - cost) * 10;
            } else if (cost > targetAvgCost) {
                elo -= Math.pow(cost - targetAvgCost, 1.5) * 15;
            }

            const fuzzAmount = Math.floor(Math.random() * 101) - 50; 
            elo += fuzzAmount;
            
            const isLand = card.card_type?.toLowerCase().includes('land');
            if (isLand) elo *= LAND_ELO_MODIFIER; 

            const castColors = card.colors || [];
            const identityColors = card.color_identity || castColors;
            let affinity = 1;

            if (isLand) {
                if (identityColors.length > 0) {
                    affinity = 1.0 + identityColors.reduce((sum: number, c: string) => {
                        const mod = colorModifiers[c] || 1;
                        return sum + (mod - 1.0); 
                    }, 0);
                    affinity = Math.max(0.25, affinity);
                } else {
                    affinity = maxTeamAffinity;
                }
            } else {
                if (castColors.length > 1) {
                    affinity = Math.min(...castColors.map((c: string) => colorModifiers[c] || 1));
                } else if (castColors.length === 1) {
                    affinity = colorModifiers[castColors[0]] || 1;
                } else if (identityColors.length > 0) {
                    affinity = Math.max(...identityColors.map((c: string) => colorModifiers[c] || 1));
                } else {
                    affinity = maxTeamAffinity; 
                }
            }

            return { ...card, effective_elo: elo * affinity };
        })
        .sort((a, b) => b.effective_elo - a.effective_elo);

    const bestPick = sortedCandidates[0] || null;
    
    let algoDetails: AlgorithmDetails | null = null;
    if (bestPick) {
        const baseElo = bestPick.cubecobra_elo || DEFAULT_ELO;
        const isLand = bestPick.card_type?.toLowerCase().includes('land') || false;
        const landPenalty = isLand ? LAND_ELO_MODIFIER : 1;
        const affinityMultiplier = bestPick.effective_elo / (baseElo * landPenalty);
        
        algoDetails = {
            base_elo: baseElo,
            effective_elo: bestPick.effective_elo,
            affinity_multiplier: affinityMultiplier,
            color_counts: colorCounts,
            color_modifiers: colorModifiers,
            is_land: isLand,
            land_penalty: landPenalty
        };
    }

    // STRICT TYPING FIX: Safe cast via unknown avoids the 'any' linter error
    return { recommendation: bestPick as unknown as CardData, algorithmDetails: algoDetails };
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
  source?: "manual_queue" | "algorithm" | "skipped" | "drained";
  error?: string;
}> {
  try {
    const supabase = adminClient ?? createServiceClient();

    const { status: draftStatus, error: statusError } = await getDraftStatus(draftSessionId, supabase);
    if (statusError || !draftStatus || draftStatus.onTheClock.teamId !== teamId) {
      await logSystemEvent("ExecuteAutoDraft", "error", `Failed: Team ${teamId} is not on the clock or draft status invalid.`, { draftSessionId, statusError });
      return { success: false, error: statusError || "Team not on the clock." };
    }
   // =========================================================================
    // DRAINLINGS SPECIAL DRAFT LOGIC
    // =========================================================================
    const DRAINLINGS_TEAM_ID = "90177632-f6ab-4501-b235-3590a7e46472";

    if (teamId === DRAINLINGS_TEAM_ID) {
        // 1. Drainlings ignore the queue, budget, and colors.
        const { cards: availableCards } = await getAvailableCardsForDraft("draft", supabase);
        
        const validCards = availableCards.filter(c => c.id && !excludedCardPoolIds.includes(c.id));
        if (validCards.length === 0) {
            return { success: false, error: "No cards available for Drainlings to draft." };
        }

        // 2. Fetch the dynamic meta weights
        const cardIds = validCards.map(c => c.id as string);
        const { data: eloWeights } = await supabase
            .from('card_elo_weights')
            .select('card_pool_id, weight')
            .in('card_pool_id', cardIds);
        
        const weightMap = new Map<string, number>();
        (eloWeights || []).forEach(w => weightMap.set(w.card_pool_id, w.weight || 0));

        // 3. Sort purely by Base ELO + Match Weight
        validCards.sort((a, b) => {
            const eloA = (a.cubecobra_elo || 0) + (weightMap.get(a.id as string) || 0);
            const eloB = (b.cubecobra_elo || 0) + (weightMap.get(b.id as string) || 0);
            return eloB - eloA;
        });

        const cardToAttempt = validCards[0];

        const { picks: existingPicks } = await getTeamDraftPicks(teamId, draftSessionId, supabase);
        const pickNumber = existingPicks.length + 1;
        const effectiveCost = cardToAttempt.cubucks_cost || 1;

        // 4. Force the pick execution
        const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
            p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: cardToAttempt.id,
            p_card_id: cardToAttempt.card_id, p_card_name: cardToAttempt.card_name,
            p_card_set: cardToAttempt.card_set, p_card_type: cardToAttempt.card_type,
            p_rarity: cardToAttempt.rarity, p_colors: cardToAttempt.colors, 
            p_color_identity: cardToAttempt.color_identity || cardToAttempt.colors || [], 
            p_image_url: cardToAttempt.image_url,
            p_oldest_image_url: cardToAttempt.oldest_image_url, p_mana_cost: cardToAttempt.mana_cost,
            p_cmc: cardToAttempt.cmc, p_pick_number: pickNumber, p_cost: effectiveCost,
            p_is_manual_pick: false, p_user_id: null,
        }).single();

        if (rpcError) {
             // Handle exclusions recursively if it was sniped by a race condition
             return executeAutoDraft(teamId, draftSessionId, supabase, [...excludedCardPoolIds, cardToAttempt.id!]);
        }

        const newPick = data as DraftPick;
        
        // 5. Finalize Drainlings metadata & Update Card Pool Location
        if (newPick.id) {
             await supabase.from("team_draft_picks").update({ 
                pick_source: "algorithm",
                scars: ['drained'] 
             }).eq("id", newPick.id);
             
             if (cardToAttempt.id) {
                 await supabase.from("card_pools").update({ pool_name: 'drainlings' }).eq("id", cardToAttempt.id);
             }
        }

        // =========================================================================
        // REWARD THE SACRIFICING TEAM
        // Find the team who originally owned this specific pick slot and reward them!
        // =========================================================================
        
        // Calculate whose slot this actually is globally
        const slotIndex = draftStatus.totalPicks % draftStatus.totalTeams;
        const originalOwnerId = draftStatus.draftOrder[slotIndex].teamId;

        const { data: tradedPick } = await supabase.from('future_draft_picks')
            .select('team_id, original_team_id')
            .eq('season_id', draftStatus.seasonId)
            .eq('round_number', draftStatus.currentRound)
            .eq('original_team_id', originalOwnerId)
            .eq('traded_to_team_id', DRAINLINGS_TEAM_ID)
            .maybeSingle();
        
        // Use team_id if it was passed around, otherwise fallback to original_team_id
        const rewardTeamId = tradedPick?.team_id || tradedPick?.original_team_id;

        if (rewardTeamId) {
             const essenceReward = effectiveCost * 10;
             const { data: teamBankData } = await supabase.from('teams').select('essence_bank').eq('id', rewardTeamId).single();
             
             if (teamBankData) {
                 // Deposit the reward directly into their Team Bank!
                 await supabase.from('teams').update({ essence_bank: teamBankData.essence_bank + essenceReward }).eq('id', rewardTeamId);
                 await logSystemEvent("TheDrain", "info", `Team ${rewardTeamId} received deferred reward of ${essenceReward} Essence to their Team Bank from a Drainlings pick.`);
             }
        }

        await conditionallyCleanupDraftQueues(cardToAttempt.card_id, supabase);
        
        const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
        await supabase.channel(`draft-updates-${draftSessionId}`).send({ 
            type: 'broadcast', 
            event: 'new_pick', 
            payload: { ...newPick, team_id: teamId, team_name: teamData?.name || 'Unknown' }
        });

        await logSystemEvent("ExecuteAutoDraft", "info", `Drainlings sniped ${cardToAttempt.card_name} via Void logic.`);
        return { success: true, pick: { cardId: cardToAttempt.card_id, cardName: cardToAttempt.card_name, cost: effectiveCost }, source: "drained" };
    }
    // =========================================================================
 

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
        p_rarity: cardToAttempt.rarity, p_colors: cardToAttempt.colors, 
        p_color_identity: cardToAttempt.color_identity || cardToAttempt.colors || [], // <-- ADDED MISSING ARGUMENT HERE
        p_image_url: cardToAttempt.image_url,
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
        const calculatedElo = (cardToAttempt as typeof cardToAttempt & { effective_elo?: number }).effective_elo 
                              || cardToAttempt.cubecobra_elo 
                              || null;

        await supabase.from("team_draft_picks").update({ 
            pick_source: pickSource,
            effective_elo: calculatedElo,
            algorithm_details: preview.algorithmDetails || null 
        }).eq("id", newPick.id);
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
        p_color_identity: card.color_identity || card.colors || [], // <-- ADD THIS LINE
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

export async function conditionallyCleanupDraftQueues(
  draftedCardId: string, 
  adminClient?: AnySupabaseClient
): Promise<{ success: boolean; cleaned: boolean; error?: string }> {
  try {
    // FIX 1: Use the safe createServiceClient fallback instead of createServerClient
    const supabase = adminClient ?? createServiceClient();
    
    // FIX 2: Pass adminClient to the cache function
    const duplicateSet = await getDuplicateCardIdSet(adminClient);
    
    if (!duplicateSet.has(draftedCardId)) {
      const { error } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (error) return { success: false, cleaned: false, error: error.message };
      return { success: true, cleaned: true };
    }
    
    // FIX 3: Pass adminClient to the available cards fetcher
    const { cards: availableCards } = await getAvailableCardsForDraft("draft", adminClient);
    
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
