// src/app/actions/autoDraftActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addSkippedPick } from "@/app/actions/draftActions";
import { getTeamBalance } from "@/app/actions/cubucksActions";
import { getDraftStatus } from "@/app/actions/draftOrderActions";
import { getDuplicateCardIdSet } from "@/lib/draftCache";

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
  id?: string;
  cardPoolId: string;
  cardId: string;
  cardName: string;
  position: number;
  pinned: boolean;
  source?: "manual_queue" | "algorithm" | "skipped";
  cardSet?: string;
  cardType?: string;
  rarity?: string;
  colors?: string[];
  imageUrl?: string;
  manaCost?: string;
  cmc?: number;
  cubucksCost?: number;
  cubecobraElo?: number;
  votes?: string[]; // Array of user IDs who have voted
  voteThreshold?: number;
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

/**
 * Verify current user is a member of the team
 */
async function verifyTeamMembership(
  teamId: string
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "You must be logged in to perform this action" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return { authorized: false, userId: user.id, error: "You must be a member of this team" };
  }

  return { authorized: true, userId: user.id };
}

/**
 * Count the number of drafted cards per color for a team.
 * Multi-color cards count toward each of their colors.
 */
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

// ============================================================================
// TEAM VOTING & MANUAL EXECUTION
// ============================================================================

/**
 * Gets the total number of members in a team to calculate thresholds.
 */
async function getTeamMemberCount(teamId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("team_members")
    .select("*", { count: 'exact', head: true })
    .eq("team_id", teamId);

  if (error) {
    console.error("Error fetching team member count:", error);
    return 1; // Fallback to 1 to prevent division/math errors
  }
  return count || 1;
}

/**
 * Calculates the 51% rounded up threshold based on member count.
 */
function calculateVoteThreshold(memberCount: number): number {
  return Math.ceil(memberCount * 0.51);
}

/**
 * Toggles a user's vote for a specific queued card.
 * If the vote pushes the count over the threshold and the team is on the clock,
 * it immediately executes the draft pick.
 */
export async function toggleQueuePickVote(
  teamId: string,
  cardPoolId: string,
  draftSessionId: string
): Promise<{ success: boolean; pickExecuted: boolean; error?: string }> {
  try {
    const auth = await verifyTeamMembership(teamId);
    if (!auth.authorized || !auth.userId) {
      return { success: false, pickExecuted: false, error: auth.error };
    }

    const supabase = await createServerClient();

    // 1. Get the current queue entry and its votes
    const { data: queueEntry, error: fetchError } = await supabase
      .from("team_draft_queue")
      .select("id, votes, position")
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId)
      .single();

    if (fetchError || !queueEntry) {
      return { success: false, pickExecuted: false, error: "Queue entry not found" };
    }

    // 2. Toggle the user's vote
    let currentVotes: string[] = queueEntry.votes || [];
    const hasVoted = currentVotes.includes(auth.userId);

    if (hasVoted) {
      currentVotes = currentVotes.filter(id => id !== auth.userId);
    } else {
      currentVotes.push(auth.userId);
    }

    // 3. Save the updated votes back to the database
    const { error: updateError } = await supabase
      .from("team_draft_queue")
      .update({ votes: currentVotes })
      .eq("id", queueEntry.id);

    if (updateError) {
      return { success: false, pickExecuted: false, error: "Failed to record vote" };
    }

    // 4. Check Thresholds and trigger execution if met
    const memberCount = await getTeamMemberCount(teamId);
    const threshold = calculateVoteThreshold(memberCount);

    // We only execute if they hit the threshold AND it's the #1 card in their queue
    if (currentVotes.length >= threshold && queueEntry.position === 1) {
      const { status: draftStatus } = await getDraftStatus();

      // Check if it is currently this team's turn to pick
      if (draftStatus?.onTheClock?.teamId === teamId) {
        // Execute the pick using the ATOMIC logic
        const pickResult = await executeConfirmedTeamPick(teamId, cardPoolId, draftSessionId, auth.userId);

        if (!pickResult.success) {
           return { success: true, pickExecuted: false, error: pickResult.error }; // Vote saved, but pick failed
        }
        
        return { success: true, pickExecuted: true };
      }
    }

    return { success: true, pickExecuted: false };
  } catch (error) {
    console.error("Error toggling vote:", error);
    return { success: false, pickExecuted: false, error: "An unexpected error occurred" };
  }
}

/**
 * NEW: Uses the atomic SQL function to execute a manual pick.
 * This is the core logic for executing a pick that has met its vote threshold.
 */
async function executeConfirmedTeamPick(
  teamId: string,
  cardPoolId: string,
  draftSessionId: string,
  userId: string
) {
  const supabase = await createServerClient();
  const { cards: availableCards } = await getAvailableCardsForDraft();
  const card = availableCards.find(c => c.id === cardPoolId);

  if (!card) {
    return { success: false, error: "Card is no longer available to be drafted." };
  }

  const { picks: existingPicks } = await getTeamDraftPicks(teamId);

  // Call the new atomic function
  const { data: newPick, error } = await supabase.rpc("execute_atomic_draft_pick", {
    p_team_id: teamId,
    p_draft_session_id: draftSessionId,
    p_card_pool_id: card.id,
    p_card_id: card.card_id,
    p_card_name: card.card_name,
    p_card_set: card.card_set,
    p_card_type: card.card_type,
    p_rarity: card.rarity,
    p_colors: card.colors,
    p_image_url: card.image_url,
    p_mana_cost: card.mana_cost,
    p_cmc: card.cmc,
    p_pick_number: existingPicks.length + 1,
    p_cost: card.cubucks_cost || 1,
    p_is_manual_pick: true,
    p_user_id: userId,
  }).single();

  if (error) {
    console.error("Atomic draft pick failed (manual):", error);
    return { success: false, error: error.message };
  }
  
  if (!newPick) {
    return { success: false, error: "Draft pick could not be confirmed in the database." };
  }
  
  // The atomic function succeeded, now handle post-pick actions.
  await conditionallyCleanupDraftQueues(card.card_id);
  
  const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
  const channel = supabase.channel(`draft-updates-${draftSessionId}`);
  
  await channel.send({
    type: 'broadcast',
    event: 'new_pick',
    payload: { ...newPick, team_name: teamData?.name || 'Unknown Team' },
  });

  return { success: true, pick: newPick };
}

// ============================================================================
// CORE ALGORITHM
// ============================================================================

/**
 * Compute the auto-draft pick for a team using an ELO/color affinity algorithm.
 */
export async function computeAutoDraftPick(
  teamId: string
): Promise<{
  card: CardData | null;
  algorithmDetails: AlgorithmDetails | null;
  error?: string;
}> {
  try {
    const { cards: availableCards, error: cardsError } = await getAvailableCardsForDraft();
    if (cardsError) return { card: null, algorithmDetails: null, error: cardsError };
    if (availableCards.length === 0) return { card: null, algorithmDetails: null, error: "No available cards in the pool" };

    const { picks: teamPicks } = await getTeamDraftPicks(teamId);
    const { team: teamBalance } = await getTeamBalance(teamId);
    const balance = teamBalance?.cubucks_balance ?? 0;

    const LAND_ELO_MODIFIER = 0.8;
    const AFFINITY_BONUS_PER_PICK = 0.1;
    const ANTI_AFFINITY_PENALTY_PER_PICK = 0.05;

    const colorModifiers: Record<string, number> = { W: 1.0, U: 1.0, B: 1.0, R: 1.0, G: 1.0 };
    const allColors = ["W", "U", "B", "R", "G"];
    for (const pick of teamPicks) {
      const pickColors = new Set(pick.colors || []);
      if (pickColors.size === 0) continue;
      for (const color of allColors) {
        if (pickColors.has(color)) {
          colorModifiers[color] += AFFINITY_BONUS_PER_PICK;
        } else {
          colorModifiers[color] -= ANTI_AFFINITY_PENALTY_PER_PICK;
        }
      }
    }

    for (const color of allColors) {
      colorModifiers[color] = Math.max(0.5, colorModifiers[color]);
    }

    const cardsWithElo = availableCards
      .map(card => {
        let elo = card.cubecobra_elo || 0;
        if (card.card_type?.toLowerCase().includes('land')) {
            elo *= LAND_ELO_MODIFIER;
        }
        return { ...card, cubecobra_elo: elo };
      })
      .filter((c) => c.cubecobra_elo > 0)
      .sort((a, b) => b.cubecobra_elo - a.cubecobra_elo);

    const candidatePool = cardsWithElo.length > 0
      ? cardsWithElo
      : [...availableCards].sort((a, b) => a.card_name.localeCompare(b.card_name));
      
    const top50 = candidatePool.slice(0, 50);

    const colorTotals: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const card of top50) {
      const elo = card.cubecobra_elo || 0;
      if (card.colors && card.colors.length > 0) {
        const maxModifier = Math.max(...card.colors.map((c) => colorModifiers[c] || 1));
        const effectiveElo = elo * maxModifier;
        for (const color of card.colors) {
          colorTotals[color] += effectiveElo;
        }
      }
    }

    let dominantColor: string | null = null;
    let highestTotal = 0;
    for (const [color, total] of Object.entries(colorTotals)) {
      if (total > highestTotal) {
        highestTotal = total;
        dominantColor = color;
      }
    }

    let bestColoredCard: CardData | null = null;
    if (dominantColor) {
      const dominantColorCards = top50
        .filter((c) => c.colors && c.colors.includes(dominantColor!))
        .sort((a, b) => (b.cubecobra_elo || 0) - (a.cubecobra_elo || 0));
      bestColoredCard = dominantColorCards[0] || null;
    }

    const colorlessCards = top50
      .filter((c) => !c.colors || c.colors.length === 0)
      .sort((a, b) => (b.cubecobra_elo || 0) - (a.cubecobra_elo || 0));
    const bestColorlessCard = colorlessCards[0] || null;

    let selectedSource: "colored" | "colorless" | "none" = "none";
    let selectedCard: CardData | null = null;

    if (bestColorlessCard && (bestColorlessCard.cubecobra_elo || 0) > (bestColoredCard?.cubecobra_elo || 0)) {
      selectedCard = bestColorlessCard;
      selectedSource = "colorless";
    } else if (bestColoredCard) {
      selectedCard = bestColoredCard;
      selectedSource = "colored";
    } else if (bestColorlessCard) {
      selectedCard = bestColorlessCard;
      selectedSource = "colorless";
    }
    
    // --- AFFORDABILITY LOGIC ---
    if (selectedCard && (selectedCard.cubucks_cost || 1) > balance) {
        // The top pick is unaffordable. Find the best affordable card from the top 50.
        const affordableTop50 = top50.filter(c => (c.cubucks_cost || 1) <= balance);
        
        if (affordableTop50.length > 0) {
            // FIX: The affordable list is a subset of the already-sorted top50,
            // so the first element is guaranteed to be the highest ELO affordable card.
            selectedCard = affordableTop50[0];
        } else {
            // If NO card in the top 50 is affordable, search all available cards.
            const anyAffordable = availableCards
                .filter(c => (c.cubucks_cost || 1) <= balance)
                .sort((a, b) => (b.cubecobra_elo || 0) - (a.cubecobra_elo || 0));
            selectedCard = anyAffordable[0] || null; // Will be null if nothing is affordable
        }
    }

    const draftedColorCounts = countDraftedColors(teamPicks);
    const algorithmDetails: AlgorithmDetails = {
      top50CardIds: top50.map((c) => c.card_id),
      colorTotals,
      colorAffinityModifiers: colorModifiers,
      bestColoredCard: bestColoredCard ? { cardId: bestColoredCard.card_id, cardName: bestColoredCard.card_name, elo: bestColoredCard.cubecobra_elo || 0, color: dominantColor || "" } : null,
      bestColorlessCard: bestColorlessCard ? { cardId: bestColorlessCard.card_id, cardName: bestColorlessCard.card_name, elo: bestColorlessCard.cubecobra_elo || 0 } : null,
      selectedSource,
      teamDraftedColorCounts: draftedColorCounts,
      dominantColor,
    };

    return { card: selectedCard, algorithmDetails };
  } catch (error) {
    console.error("Error computing auto-draft pick:", error);
    return { card: null, algorithmDetails: null, error: "Failed to compute auto-draft pick" };
  }
}

// ============================================================================
// PREVIEW
// ============================================================================

/**
 * Get the auto-draft preview for a team.
 * Checks manual queue first, then falls back to algorithm.
 */
export async function getAutoDraftPreview(
  teamId: string
): Promise<AutoDraftPreviewResult> {
  try {
    const supabase = await createServerClient();
    const { data: queueEntries, error: queueError } = await supabase
      .from("team_draft_queue")
      .select("id, card_pool_id, card_id, card_name, position, pinned, votes")
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    if (queueError) {
      console.error("Error fetching draft queue:", queueError);
    }

    const queueDepth = (queueEntries || []).length;
    if (queueEntries && queueEntries.length > 0) {
      const { cards: availableCards } = await getAvailableCardsForDraft();
      
      const availableInstanceIds = new Set(availableCards.map((c) => c.id));
      for (const entry of queueEntries) {
        if (entry.card_pool_id && availableInstanceIds.has(entry.card_pool_id)) {
          const card = availableCards.find((c) => c.id === entry.card_pool_id) || null;
          const memberCount = await getTeamMemberCount(teamId);
          return {
            nextPick: card,
            source: "manual_queue",
            queueDepth,
            votes: entry.votes || [],
            voteThreshold: calculateVoteThreshold(memberCount),
          };
        }
      }
    }

    // If no valid manual pick is found, fall back to the algorithm.
    const { card, algorithmDetails, error } = await computeAutoDraftPick(teamId);
    
    // Also check affordability for the algorithm pick in the preview
    if (card) {
        const { team: teamBalance } = await getTeamBalance(teamId);
        const balance = teamBalance?.cubucks_balance ?? 0;
        if ((card.cubucks_cost || 1) > balance) {
            // If the best algorithmic pick isn't affordable, show it as skipped.
            return {
                nextPick: null,
                source: "skipped",
                queueDepth,
                error: `Insufficient Cubucks. Need ${card.cubucks_cost || 1}, have ${balance}`
            };
        }
    }

    return {
      nextPick: card,
      source: card ? "algorithm" : "skipped",
      queueDepth,
      algorithmDetails: algorithmDetails || undefined,
      error: card ? error : (error || "No affordable cards available."),
    };
  } catch (error) {
    console.error("Error getting auto-draft preview:", error);
    return {
      nextPick: null,
      source: "algorithm",
      queueDepth: 0,
      error: "Failed to get auto-draft preview",
    };
  }
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Get the full draft queue for a team.
 */
export async function getTeamDraftQueue(
  teamId: string,
  limit: number = 20
): Promise<{ queue: QueueEntry[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: manualEntries, error: queueError } = await supabase
      .from("team_draft_queue")
      .select("id, card_pool_id, card_id, card_name, position, pinned, votes")
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    const memberCount = await getTeamMemberCount(teamId);
    const voteThreshold = calculateVoteThreshold(memberCount);

    if (queueError) {
      console.error("Error fetching draft queue:", queueError);
      return { queue: [], error: queueError.message };
    }

    const { cards: availableCards, error: availableError } = await getAvailableCardsForDraft();
    if (availableError) {
        console.error("Error fetching available cards for queue:", availableError);
        return { queue: [], error: availableError };
    }

    const availableMap = new Map<string, CardData>();
    for (const card of availableCards) {
      if (card.id) {
          availableMap.set(card.id, card);
      }
    }

    const queue: QueueEntry[] = [];
    const usedInstanceIds = new Set<string>();

    for (const entry of manualEntries || []) {
      if (entry.card_pool_id) {
          const cardData = availableMap.get(entry.card_pool_id);
          if (cardData) {
            queue.push({
              id: entry.id,
              cardPoolId: entry.card_pool_id,
              cardId: entry.card_id,
              cardName: entry.card_name,
              position: queue.length + 1,
              pinned: entry.pinned,
              source: "manual_queue",
              cardSet: cardData.card_set,
              cardType: cardData.card_type,
              rarity: cardData.rarity,
              colors: cardData.colors,
              imageUrl: cardData.image_url,
              manaCost: cardData.mana_cost,
              cmc: cardData.cmc,
              cubucksCost: cardData.cubucks_cost,
              cubecobraElo: cardData.cubecobra_elo,
              votes: entry.votes || [],
              voteThreshold: voteThreshold,
            });
            usedInstanceIds.add(entry.card_pool_id);
          }
      }
    }

    if (queue.length < limit) {
      const { picks: teamPicks } = await getTeamDraftPicks(teamId);
      const draftedColorCounts = countDraftedColors(teamPicks);
      
      const remainingCards = availableCards
        .filter((c) => c.id && !usedInstanceIds.has(c.id) && c.cubecobra_elo != null)
        .map((card) => {
          let modifier = 1;
          if (card.colors && card.colors.length > 0) {
            modifier = Math.max(...card.colors.map((c) => 1 + 0.01 * (draftedColorCounts[c] || 0)));
          }
          return { card, effectiveElo: (card.cubecobra_elo || 0) * modifier };
        })
        .sort((a, b) => b.effectiveElo - a.effectiveElo);

      for (const { card } of remainingCards) {
        if (queue.length >= limit) break;
        queue.push({
          cardPoolId: card.id || "",
          cardId: card.card_id,
          cardName: card.card_name,
          position: queue.length + 1,
          pinned: false,
          source: "algorithm",
          cardSet: card.card_set,
          cardType: card.card_type,
          rarity: card.rarity,
          colors: card.colors,
          imageUrl: card.image_url,
          manaCost: card.mana_cost,
          cmc: card.cmc,
          cubucksCost: card.cubucks_cost,
          cubecobraElo: card.cubecobra_elo,
        });
      }
    }

    return { queue };
  } catch (error) {
    console.error("Error getting team draft queue:", error);
    return { queue: [], error: "Failed to get draft queue" };
  }
}

/**
 * Set a team's manual draft queue (bulk operation for drag-and-drop reorder).
 */
export async function setTeamDraftQueue(
  teamId: string,
  entries: Array<{
    cardPoolId: string;
    cardId: string;
    cardName: string;
    position: number;
    pinned?: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeamMembership(teamId);
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: auth.error };
    }

    const supabase = await createServerClient();

    const { data: existingQueue } = await supabase
      .from("team_draft_queue")
      .select("card_pool_id, votes")
      .eq("team_id", teamId);
      
    const voteMap = new Map<string, string[]>();
    existingQueue?.forEach(e => voteMap.set(e.card_pool_id, e.votes || []));

    const { error: deleteError } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId);

    if (deleteError) {
      console.error("Error clearing draft queue:", deleteError);
      return { success: false, error: deleteError.message };
    }

    if (entries.length > 0) {
      const rows = entries.map((entry, index) => ({
        team_id: teamId,
        card_pool_id: entry.cardPoolId,
        card_id: entry.cardId,
        card_name: entry.cardName,
        position: index + 1,
        pinned: entry.pinned || false,
        added_by: auth.userId,
        votes: voteMap.get(entry.cardPoolId) || [],
      }));

      const { error: insertError } = await supabase
        .from("team_draft_queue")
        .insert(rows);

      if (insertError) {
        console.error("Error setting draft queue:", insertError);
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting team draft queue:", error);
    return { success: false, error: "Failed to update draft queue" };
  }
}

/**
 * Add/move a card to a specific position in the manual queue.
 */
export async function pinCardToQueue(
  teamId: string,
  cardPoolId: string,
  cardId: string,
  cardName: string,
  position: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeamMembership(teamId);
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: auth.error };
    }
    const supabase = await createServerClient();
    
    await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId);

    const { data: existingEntries } = await supabase
      .from("team_draft_queue")
      .select("id, position")
      .eq("team_id", teamId)
      .gte("position", position)
      .order("position", { ascending: false });

    for (const entry of existingEntries || []) {
      await supabase
        .from("team_draft_queue")
        .update({ position: entry.position + 1 })
        .eq("id", entry.id);
    }

    const { error: insertError } = await supabase
      .from("team_draft_queue")
      .insert({
        team_id: teamId,
        card_pool_id: cardPoolId,
        card_id: cardId,
        card_name: cardName,
        position,
        pinned: true,
        added_by: auth.userId,
      });

    if (insertError) {
      console.error("Error pinning card to queue:", insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error pinning card to queue:", error);
    return { success: false, error: "Failed to pin card to queue" };
  }
}

/**
 * Remove a card from the manual queue.
 */
export async function removeFromQueue(
  teamId: string,
  cardPoolId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeamMembership(teamId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const supabase = await createServerClient();

    const { data: entry } = await supabase
      .from("team_draft_queue")
      .select("position")
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId)
      .single();

    if (!entry) {
      return { success: true }; // Already not in queue
    }

    const { error: deleteError } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    const { data: remaining } = await supabase
      .from("team_draft_queue")
      .select("id, position")
      .eq("team_id", teamId)
      .gt("position", entry.position)
      .order("position", { ascending: true });

    for (const item of remaining || []) {
      await supabase
        .from("team_draft_queue")
        .update({ position: item.position - 1 })
        .eq("id", item.id);
    }
    return { success: true };
  } catch (error) {
    console.error("Error removing from queue:", error);
    return { success: false, error: "Failed to remove from queue" };
  }
}

/**
 * Clear the entire manual queue for a team (revert to algorithm).
 */
export async function clearTeamDraftQueue(
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeamMembership(teamId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error("Error clearing draft queue:", error);
    return { success: false, error: "Failed to clear draft queue" };
  }
}

// ============================================================================
// EXECUTION & CLEANUP
// ============================================================================

/**
 * Cleans up team queues after a card has been drafted.
 * Removes the specific card_id from all team queues unless it's a duplicate that still has available instances.
 */
export async function conditionallyCleanupDraftQueues(
  draftedCardId: string
): Promise<{ success: boolean; cleaned: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const duplicateSet = await getDuplicateCardIdSet();

    // If the card is not a duplicate, it's safe to remove all queue entries for it.
    if (!duplicateSet.has(draftedCardId)) {
      const { error } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (error) return { success: false, cleaned: false, error: error.message };
      return { success: true, cleaned: true };
    }

    // If it is a duplicate, check if any instances are still available.
    const { cards: availableCards } = await getAvailableCardsForDraft();
    if (!availableCards.some(card => card.card_id === draftedCardId)) {
      // No more instances are available, so clean it from the queues.
      const { error } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (error) return { success: false, cleaned: false, error: error.message };
      return { success: true, cleaned: true };
    }

    // Duplicates exist and are available, so do not clean the queues.
    return { success: true, cleaned: false };
  } catch (error) {
    console.error("Unexpected error in conditional queue cleanup:", error);
    return { success: false, cleaned: false, error: "Failed to clean up draft queues" };
  }
}

/**
 * NEW: Executes the auto-draft for a team using an atomic transaction.
 * Verifies the team is on the clock, computes the pick, and executes it.
 */
export async function executeAutoDraft(
  teamId: string,
  draftSessionId: string
): Promise<{
  success: boolean;
  pick?: { cardId: string; cardName: string; cost: number };
  source?: "manual_queue" | "algorithm" | "skipped";
  error?: string;
  staleDeployment?: boolean;
}> {
  try {
    const supabase = await createServerClient();
    const { status: draftStatus, error: statusError } = await getDraftStatus();

    if (statusError || !draftStatus || !draftSessionId) {
      return { success: false, error: statusError || "No active draft or draft ID is missing" };
    }

    if (draftStatus.onTheClock.teamId !== teamId) {
      return { success: false, error: "This team is not on the clock" };
    }

    const { picks: existingPicks } = await getTeamDraftPicks(teamId);
    const pickNumber = existingPicks.length + 1;

    // Determine the pick from the queue or algorithm.
    const preview = await getAutoDraftPreview(teamId);
    const card = preview.nextPick;

    // --- NEW: Handle SKIPPED picks explicitly ---
    // If there's no card from the preview (either unaffordable or none available),
    // log a SKIPPED pick and exit successfully.
    if (!card) {
      const { pick: skippedPick, error: skipError } = await addSkippedPick(teamId, pickNumber, draftSessionId);
      if (skipError) {
        return { success: false, source: "skipped", error: `Failed to record skipped pick: ${skipError}` };
      }

      // Broadcast the skipped pick so the UI can update
      const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
      const channel = supabase.channel(`draft-updates-${draftSessionId}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_pick',
        payload: { ...skippedPick, team_name: teamData?.name || 'Unknown Team' },
      });

      return { success: true, source: "skipped", pick: { cardId: "skipped", cardName: "SKIPPED", cost: 0 } };
    }

    // --- NEW: ATOMIC DRAFT EXECUTION ---
    // A card is available and affordable, execute the draft using the atomic function.
    const { data: newPick, error: rpcError } = await supabase.rpc("execute_atomic_draft_pick", {
        p_team_id: teamId,
        p_draft_session_id: draftSessionId,
        p_card_pool_id: card.id,
        p_card_id: card.card_id,
        p_card_name: card.card_name,
        p_card_set: card.card_set,
        p_card_type: card.card_type,
        p_rarity: card.rarity,
        p_colors: card.colors,
        p_image_url: card.image_url,
        p_mana_cost: card.mana_cost,
        p_cmc: card.cmc,
        p_pick_number: pickNumber,
        p_cost: card.cubucks_cost || 1,
        p_is_manual_pick: preview.source === "manual_queue",
        p_user_id: null, // This is an auto-draft, so no specific user actioned it.
      }).single();

    if (rpcError) {
      console.error("Atomic auto-draft failed:", rpcError);
      return { success: false, error: `Draft failed: ${rpcError.message}` };
    }

    if (!newPick) {
      return { success: false, error: "Draft pick could not be confirmed in the database." };
    }

    // --- Post-Pick Actions (only run after successful atomic transaction) ---
    await supabase.from("auto_draft_log").insert({
      team_id: teamId,
      card_id: card.card_id,
      card_name: card.card_name,
      card_pool_id: card.id,
      pick_source: preview.source,
      algorithm_details: preview.algorithmDetails || null,
      round_number: draftStatus.currentRound,
    });
    
    await conditionallyCleanupDraftQueues(card.card_id);
    
    const { data: teamData } = await supabase.from('teams').select('name').eq('id', teamId).single();
    
    const broadcastPayload = {
      ...newPick,
      team_name: teamData?.name || 'Unknown Team',
    };
    
    const channel = supabase.channel(`draft-updates-${draftSessionId}`);
    
    await channel.send({
        type: 'broadcast',
        event: 'new_pick',
        payload: broadcastPayload,
    });

    return {
      success: true,
      pick: { cardId: card.card_id, cardName: card.card_name, cost: card.cubucks_cost || 1 },
      source: preview.source,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Failed to find Server Action")) {
      return { success: false, error: "Deployment has changed. Please refresh the page.", staleDeployment: true };
    }
    console.error("Unhandled error in executeAutoDraft:", error);
    return { success: false, error: "An unexpected error occurred during the auto-draft process." };
  }
}
