
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

async function verifyTeamMembership(teamIdOrShortName: string): Promise<{ authorized: boolean; userId?: string; teamIdResolved?: string; error?: string }> {
    if (!teamIdOrShortName) return { authorized: false, error: "Team ID is missing." };

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return { authorized: false, error: "You must be logged in to perform this action." };

    let resolvedTeamId = teamIdOrShortName;

    // THE FIX: If the input is not a UUID (like "mimics"), resolve it to the UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamIdOrShortName)) {
        const { data: teamLookup } = await supabase
            .from("teams")
            .select("id")
            .eq("short_name", teamIdOrShortName)
            .maybeSingle();
            
        if (!teamLookup) return { authorized: false, error: "Invalid Team format." };
        resolvedTeamId = teamLookup.id;
    }

    // 1. Allow Admins to bypass the strict team membership check
    const { data: userData } = await supabase.from("users").select("is_admin").eq("id", user.id).maybeSingle();
    if (userData?.is_admin) {
        return { authorized: true, userId: user.id, teamIdResolved: resolvedTeamId };
    }

    // 2. Safely check standard team membership using the resolved UUID
    const { data: membership, error: membershipError } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", resolvedTeamId)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(); 

    if (membershipError || !membership) {
        return { authorized: false, userId: user.id, error: "You must be a member of this team." };
    }

    return { authorized: true, userId: user.id, teamIdResolved: resolvedTeamId };
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
    console.log(`\n[toggleQueuePickVote] START - Team Input: ${teamId} | Input cardPoolId: ${cardPoolId}`);
    try {
        const auth = await verifyTeamMembership(teamId);
        if (!auth.authorized || !auth.userId || !auth.teamIdResolved) {
            console.error(`[toggleQueuePickVote] Auth failed:`, auth.error);
            return { success: false, pickExecuted: false, error: auth.error };
        }
        
        // Use the resolved UUID going forward
        const trueTeamId = auth.teamIdResolved; 
        console.log(`[toggleQueuePickVote] Auth Success - User: ${auth.userId}`);

        const supabase = createServiceClient(); // Use service client to bypass RLS

        // 1. Get the generic card_id from the unique card_pool_id that was passed in
        console.log(`[toggleQueuePickVote] Looking up card in card_pools by ID: ${cardPoolId}`);
        
        // THE FIX: Assign to a const first, then pull 'card' out into a let variable
        const primaryLookup = await supabase
            .from('card_pools')
            .select('card_id, id, card_name')
            .eq('id', cardPoolId)
            .single();

        let card = primaryLookup.data;

        // FALLBACK: If the frontend accidentally passed the Scryfall card_id instead of the primary key id
        if (primaryLookup.error || !card) {
            console.warn(`[toggleQueuePickVote] Failed to find by primary key. Trying fallback lookup by card_id...`);
            const fallbackLookup = await supabase
                .from('card_pools')
                .select('card_id, id, card_name')
                .eq('card_id', cardPoolId)
                .limit(1)
                .maybeSingle();

            if (fallbackLookup.error || !fallbackLookup.data) {
                console.error(`[toggleQueuePickVote] Fallback failed too. Card truly not found.`);
                return { success: false, pickExecuted: false, error: "Card not found in main pool." };
            }
            console.log(`[toggleQueuePickVote] Fallback succeeded! Found card: ${fallbackLookup.data.card_name}`);
            card = fallbackLookup.data;
        }

        const resolvedCardId = card.card_id;
        console.log(`[toggleQueuePickVote] Resolved generic card_id: ${resolvedCardId} for ${card.card_name}`);

        // 2. Look up the queue entry using the generic card_id
        console.log(`[toggleQueuePickVote] Looking up team_draft_queue for Team: ${teamId} and card_id: ${resolvedCardId}`);
        const { data: queueEntry, error: fetchError } = await supabase
            .from("team_draft_queue")
            .select("id, votes, position, card_pool_id")
            .eq("team_id", trueTeamId)  // <-- Change this
            .eq("card_id", resolvedCardId) // Query by the generic Scryfall ID
            .limit(1)
            .maybeSingle();
        
        if (fetchError) {
            console.error(`[toggleQueuePickVote] DB Error fetching queue entry:`, fetchError);
            return { success: false, pickExecuted: false, error: "Database error checking queue." };
        }

        if (!queueEntry) {
            console.error(`[toggleQueuePickVote] Queue entry not found! Doing a debug dump of this team's queue...`);
            const { data: debugQueue } = await supabase.from("team_draft_queue").select("id, card_id, card_pool_id, card_name").eq("team_id", teamId);
            console.log(`[toggleQueuePickVote] DEBUG DUMP:`, JSON.stringify(debugQueue, null, 2));
            return { success: false, pickExecuted: false, error: "Queue entry not found." };
        }

        console.log(`[toggleQueuePickVote] Found Queue Entry! Position: ${queueEntry.position}, Current Votes:`, queueEntry.votes);

        let currentVotes: string[] = queueEntry.votes || [];
        const hasVoted = currentVotes.includes(auth.userId);

        if (hasVoted) {
            console.log(`[toggleQueuePickVote] User already voted. Removing vote.`);
            currentVotes = currentVotes.filter(id => id !== auth.userId);
        } else {
            console.log(`[toggleQueuePickVote] Adding user vote.`);
            currentVotes.push(auth.userId);
        }

        const { error: updateError } = await supabase
            .from("team_draft_queue")
            .update({ votes: currentVotes })
            .eq("id", queueEntry.id);

        if (updateError) {
            console.error(`[toggleQueuePickVote] Failed to update votes in DB:`, updateError);
            return { success: false, pickExecuted: false, error: "Failed to record vote." };
        }

        const memberCount = await getTeamMemberCount(teamId);
        const threshold = calculateVoteThreshold(memberCount);
        
        console.log(`[toggleQueuePickVote] Vote recorded. Target Threshold: ${threshold}, Current Votes: ${currentVotes.length}`);

        // 3. Check for draft execution
        if (currentVotes.length >= threshold && queueEntry.position === 1) {
            console.log(`[toggleQueuePickVote] Threshold reached for top card! Checking draft status...`);
            const { status: draftStatus } = await getDraftStatus(draftSessionId);
            
        if (draftStatus?.onTheClock?.teamId === trueTeamId) { // <-- Change this
                console.log(`[toggleQueuePickVote] Team is on the clock. Executing atomic pick...`);
                // IMPORTANT: Pass the queue's specific card_pool_id to the execution function
                const pickResult = await executeConfirmedTeamPick(teamId, queueEntry.card_pool_id, draftSessionId, auth.userId);
                
                if (!pickResult.success) {
                    console.error(`[toggleQueuePickVote] Execution failed:`, pickResult.error);
                    return { success: true, pickExecuted: false, error: pickResult.error };
                }

                console.log(`[toggleQueuePickVote] Pick executed successfully!`);
                return { success: true, pickExecuted: true };
            } else {
                console.log(`[toggleQueuePickVote] Execution skipped: Team is NOT on the clock.`);
            }
        }

        console.log(`[toggleQueuePickVote] END - Success\n`);
        return { success: true, pickExecuted: false };
    } catch (error) {
        console.error("[toggleQueuePickVote] FATAL CATCH BLOCK:", error);
        return { 
            success: false, 
            pickExecuted: false, 
            error: error instanceof Error ? error.message : "An unexpected error occurred" 
        };
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
    
    // Total picks required to complete a roster
    const totalRounds = 30; // THE FIX: Changed from 40 to 30 based on your requirement
    const picksMade = teamPicks.length;
    const remainingPicks = Math.max(1, totalRounds - picksMade);
    const targetAvgCost = Math.max(0, balance) / remainingPicks;

    // 2. Fetch the Top 100 Smart Targets
    const { data: rawTargets, error: targetError } = await supabase
        .rpc('get_smart_draft_targets', { p_limit: 100 });

    if (targetError) return { recommendation: null, algorithmDetails: null, error: targetError.message };
    
    const smartTargets = (rawTargets || []) as SmartDraftTarget[];
    if (smartTargets.length === 0) return { recommendation: null, algorithmDetails: null, error: "No available cards in the pool" };

    // =========================================================================
    // THE FIX: POVERTY HARD CAP LOGIC
    // =========================================================================
    // If the team has exactly enough (or fewer) Cubucks to finish the draft with 1-cost cards,
    // they enter Poverty Mode. They can ONLY draft cards that cost exactly 1 (or 0).
    const isPovertyMode = balance <= remainingPicks;
    const isApproachingPoverty = balance <= (remainingPicks + 10);

    const candidatePool = smartTargets.filter((card: SmartDraftTarget) => {
        if (!card.id || excludedCardPoolIds.includes(card.id)) return false;
        
        const cost = card.cubucks_cost || 1;
        
        // Ensure they can technically afford it right now
        if (cost > balance) return false;

        // The Hard Cap: Strip out all expensive cards if in poverty
        if (isPovertyMode && cost > 1) return false;

        return true;
    });
      
    if (candidatePool.length === 0) {
        return { recommendation: null, algorithmDetails: null, error: "No valid or affordable cards available." };
    }

    const DEFAULT_ELO = 1000;
    const LAND_ELO_MODIFIER = 0.85; 
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

    // 4. Evaluate Candidates using PROGRESSIVE BUDGET TAX and AFFINITY
    const sortedCandidates = candidatePool
        .map((card: SmartDraftTarget) => {
            let elo = card.smart_elo; 
            const cost = card.cubucks_cost || 1;

            // THE FIX: Progressive Value Shifting
            if (cost < targetAvgCost) {
                // Reward cheap cards
                elo += (targetAvgCost - cost) * 10;
            } else if (cost > targetAvgCost) {
                // Penalize expensive cards. 
                // If approaching poverty, drastically increase the penalty so the AI avoids them!
                const penaltyMultiplier = isApproachingPoverty ? 35 : 15;
                elo -= Math.pow(cost - targetAvgCost, 1.5) * penaltyMultiplier;
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
    
    // 1. Fetch the team's manual queue entries ordered by position
    const { data: queueEntries, error: queueErr } = await supabase
      .from("team_draft_queue")
      .select("*")
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    if (queueErr) throw queueErr;

    if (queueEntries && queueEntries.length > 0) {
      // 2. Fetch the actual available cards for the ACTIVE draft pool
      const { cards: availableCards, error: cardsErr } = await getAvailableCardsForDraft("draft", adminClient);
      if (cardsErr) throw cardsErr;

      const availableInstanceIds = new Set(availableCards.map(c => c.id));
      
      // 3. Find the first card in the queue that is still active and available
      for (const entry of queueEntries) {
        if (
          entry.card_pool_id && 
          availableInstanceIds.has(entry.card_pool_id) && 
          !excludedCardPoolIds.includes(entry.card_pool_id)
        ) {
          const card = availableCards.find(c => c.id === entry.card_pool_id) || null;
          const memberCount = await getTeamMemberCount(teamId, adminClient);
          
          return { 
            nextPick: card, 
            source: "manual_queue", 
            queueDepth: queueEntries.length, 
            votes: entry.votes || [], 
            voteThreshold: calculateVoteThreshold(memberCount) 
          };
        }
      }
    }

    // 4. Fallback to algorithm prediction if queue is empty or exhausted
    const { recommendation, algorithmDetails, error } = await computeAutoDraftPick(
      teamId, 
      draftSessionId, 
      adminClient, 
      excludedCardPoolIds
    );
    
    return { 
      nextPick: recommendation, 
      source: recommendation ? "algorithm" : "skipped", 
      queueDepth: queueEntries ? queueEntries.length : 0, 
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

   
  const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: cardToAttempt.id,
        p_card_id: cardToAttempt.card_id, p_card_name: cardToAttempt.card_name,
        p_card_set: cardToAttempt.card_set, p_card_type: cardToAttempt.card_type,
        p_rarity: cardToAttempt.rarity, p_colors: cardToAttempt.colors, 
        p_color_identity: cardToAttempt.color_identity || cardToAttempt.colors || [],
        p_image_url: cardToAttempt.image_url,
        p_oldest_image_url: cardToAttempt.oldest_image_url, p_mana_cost: cardToAttempt.mana_cost,
        p_cmc: cardToAttempt.cmc, p_pick_number: pickNumber, p_cost: effectiveCost,
        p_is_manual_pick: true, p_user_id: null, // <-- FIXED
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
            .eq('season_id', draftStatus.season_id)
            .eq('round_number', draftStatus.currentRound)
            .eq('original_team_id', originalOwnerId)
            .eq('traded_to_team_id', DRAINLINGS_TEAM_ID)
            .maybeSingle();
        
        // Use team_id if it was passed around, otherwise fallback to original_team_id
        const rewardTeamId = tradedPick?.team_id || tradedPick?.original_team_id;

        if (rewardTeamId) {
             const essenceReward = effectiveCost * 10;
             
             // Fetch current bank
             const { data: teamBankData } = await supabase.from('teams').select('essence_bank').eq('id', rewardTeamId).single();
             
             if (teamBankData) {
                 // Deposit the reward directly into their Team Bank!
                 await supabase.from('teams').update({ essence_bank: teamBankData.essence_bank + essenceReward }).eq('id', rewardTeamId);
                 
                 // Explicitly log the transaction to the system (No 'any' typing, and bypassing users table since it's a team reward)
                 const descriptionText = `Deferred Drain Sacrifice Reward (Round ${draftStatus.currentRound}): "${cardToAttempt.card_name}"`;
                 
                 // Assuming you want the transaction visible to team members, we just tie it to a system ID or leave user_id null if allowed
                 await logSystemEvent("TheDrain", "info", `Team ${rewardTeamId} received deferred reward of ${essenceReward} Essence to their Team Bank from a Drainlings pick (${cardToAttempt.card_name}).`);
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
    // STANDARD AUTO-DRAFT LOGIC
    // =========================================================================
    
    // 1. Fetch the preview first so that the 'preview' variable is defined!
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
    
    const effectiveCost = baseCost;

    // 2. Perform the poverty check securely using the declared 'preview' variable.
    // This allows manual queue picks to bypass this block and go negative.
    if (preview.source === "algorithm" && balance < effectiveCost) {
        await logSystemEvent("ExecuteAutoDraft", "warn", `Team ${teamId} lacks funds (${balance}) for algorithm card cost (${effectiveCost}). Skipped.`);
        await addSkippedPick(teamId, pickNumber, draftSessionId, supabase);
        return { success: true, source: "skipped", pick: { cardId: "skipped-pick", cardName: "SKIPPED", cost: 0 }};
    }
      
    // 3. Proceed with the atomic database pick.
    const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: cardToAttempt.id,
        p_card_id: cardToAttempt.card_id, p_card_name: cardToAttempt.card_name,
        p_card_set: cardToAttempt.card_set, p_card_type: cardToAttempt.card_type,
        p_rarity: cardToAttempt.rarity, p_colors: cardToAttempt.colors, 
        p_color_identity: cardToAttempt.color_identity || cardToAttempt.colors || [],
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

    // FIX: Query the view and check the array
    const { data: roleData } = await supabase
      .from("team_members_with_roles")
      .select("roles")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();

    const memberRoles: string[] = roleData?.roles || [];
    if (!memberRoles.includes("captain") && !memberRoles.includes("pilot")) {
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
    const effectiveCost = baseCost;
    // ------------------------------

    const { data, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId, p_draft_session_id: draftSessionId, p_card_pool_id: card.id,
        p_card_id: card.card_id, p_card_name: card.card_name, p_card_set: card.card_set,
        p_card_type: card.card_type, p_rarity: card.rarity, p_colors: card.colors,
        p_color_identity: card.color_identity || card.colors || [], 
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
