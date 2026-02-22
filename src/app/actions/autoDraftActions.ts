// src/app/actions/autoDraftActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addDraftPick } from "@/app/actions/draftActions";
import { spendCubucksOnDraft, getTeamBalance } from "@/app/actions/cubucksActions";
import { getDraftStatus } from "@/app/actions/draftOrderActions";
import { getDuplicateCardIdSet } from '@/lib/draftCache'; 

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
  source: "manual" | "algorithm";
  // Card data fields
  cardSet?: string;
  cardType?: string;
  rarity?: string;
  colors?: string[];
  imageUrl?: string;
  manaCost?: string;
  cmc?: number;
  cubucksCost?: number;
  cubecobraElo?: number;
}

export interface AutoDraftPreviewResult {
  nextPick: CardData | null;
  source: "manual_queue" | "algorithm";
  queueDepth: number;
  algorithmDetails?: AlgorithmDetails;
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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
// CORE ALGORITHM
// ============================================================================

/**
 * Compute the auto-draft pick for a team using the ELO/color affinity algorithm.
 *
 * Algorithm:
 * 1. Get available cards, filter to those with ELO, take top 50
 * 2. Count team's drafted cards per color
 * 3. Compute effective ELO per card (with color affinity modifier)
 * 4. Sum effective ELO per color to find dominant color
 * 5. Best colored pick = highest raw ELO card of dominant color
 * 6. Best colorless pick = highest raw ELO card with empty colors
 * 7. If colorless ELO > colored ELO, pick colorless; otherwise colored
 * 8. Check cubucks affordability; skip unaffordable cards
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

    // --- ALGORITHM IMPROVEMENTS ---
    const LAND_ELO_MODIFIER = 0.8;
    const AFFINITY_BONUS_PER_PICK = 0.1; // x1.1 for one pick, x1.2 for two, etc.
    const ANTI_AFFINITY_PENALTY_PER_PICK = 0.05; // x0.95 for one off-color pick
    
    // --- 1. Compute new Color Affinity Modifiers ---
    // Start all colors at a neutral 1.0 modifier.
    const colorModifiers: Record<string, number> = { W: 1.0, U: 1.0, B: 1.0, R: 1.0, G: 1.0 };
    const allColors = ["W", "U", "B", "R", "G"];

    // For each card the team has drafted...
    for (const pick of teamPicks) {
      const pickColors = new Set(pick.colors || []);
      // If the pick has no colors, it doesn't affect affinity.
      if (pickColors.size === 0) continue;

      // Apply bonuses and penalties
      for (const color of allColors) {
        if (pickColors.has(color)) {
          // Add a bonus for each on-color pip
          colorModifiers[color] += AFFINITY_BONUS_PER_PICK;
        } else {
          // Apply a penalty for each color not in the picked card
          colorModifiers[color] -= ANTI_AFFINITY_PENALTY_PER_PICK;
        }
      }
    }
    
    // Ensure modifiers don't go below a certain floor (e.g., 0.5) to avoid extreme negative weights
    for (const color of allColors) {
        colorModifiers[color] = Math.max(0.5, colorModifiers[color]);
    }

    // --- 2. Create the candidate pool with modified ELOs ---
    const cardsWithElo = availableCards
      .map(card => {
        let elo = card.cubecobra_elo || 0;
        // --- FIX: Reduce ELO for lands ---
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

    // --- 3. Recalculate Color Totals & Dominant Color with new modifiers ---
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

    // --- 4. The rest of the picking logic remains the same, but uses the improved data ---
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

    // Affordability check (remains the same)
    if (selectedCard && (selectedCard.cubucks_cost || 1) > balance) {
        const affordableCards = top50.filter(c => (c.cubucks_cost || 1) <= balance);
        if (affordableCards.length > 0) {
            selectedCard = affordableCards[0]; // Already sorted by ELO
        } else {
            const anyAffordable = availableCards.filter(c => (c.cubucks_cost || 1) <= balance).sort((a, b) => (b.cubecobra_elo || 0) - (a.cubecobra_elo || 0));
            selectedCard = anyAffordable[0] || null;
        }
    }
    
    // --- (The rest of the function: creating algorithmDetails and returning, remains the same) ---
    const algorithmDetails: AlgorithmDetails = {
      // ...
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
    const { data: queueEntries } = await supabase
      .from("team_draft_queue")
      .select("card_pool_id")
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    if (queueEntries && queueEntries.length > 0) {
      const { cards: availableCards } = await getAvailableCardsForDraft();
      const availableInstanceIds = new Set(availableCards.map((c) => c.id));

      for (const entry of queueEntries) {
        if (entry.card_pool_id && availableInstanceIds.has(entry.card_pool_id)) {
          const card = availableCards.find((c) => c.id === entry.card_pool_id) || null;
          return { nextPick: card, source: "manual_queue", queueDepth: queueEntries.length };
        }
      }
    }

    // Fall back to algorithm
    const { card, algorithmDetails, error } = await computeAutoDraftPick(teamId);
    return { nextPick: card, source: "algorithm", queueDepth: (queueEntries || []).length, algorithmDetails: algorithmDetails || undefined, error };
  } catch (error) {
    return { nextPick: null, source: "algorithm", queueDepth: 0, error: "Failed to get auto-draft preview" };
  }
}



// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Get the full draft queue for a team.
 * Returns manual overrides first, then algorithm-computed cards.
 */
export async function getTeamDraftQueue(
  teamId: string,
  limit: number = 20
): Promise<{ queue: QueueEntry[]; error?: string }> {
  try {
    const supabase = await createServerClient();

    // Get manual queue entries
    const { data: manualEntries, error: queueError } = await supabase
      .from("team_draft_queue")
      .select("id, card_pool_id, card_id, card_name, position, pinned")
      .eq("team_id", teamId)
      .order("position", { ascending: true });

    if (queueError) {
      console.error("Error fetching draft queue:", queueError);
      return { queue: [], error: queueError.message };
    }

    // Get available cards for full card data
    // FIX: Use the unique card.id as the key to support duplicates
    const availableMap = new Map<string, CardData>();
    for (const card of availableCards) {
      if (card.id) { // Ensure card.id exists
          availableMap.set(card.id, card);
      }
    }


    const queue: QueueEntry[] = [];
    const usedCardIds = new Set<string>();

    // Add valid manual entries first
    for (const entry of manualEntries || []) {
      const cardData = availableMap.get(entry.cardPoolId);
      if (cardData) {
        queue.push({
          id: entry.id,
          cardPoolId: entry.card_pool_id,
          cardId: entry.card_id,
          cardName: entry.card_name,
          position: queue.length + 1,
          pinned: entry.pinned,
          source: "manual",
          cardSet: cardData.card_set,
          cardType: cardData.card_type,
          rarity: cardData.rarity,
          colors: cardData.colors,
          imageUrl: cardData.image_url,
          manaCost: cardData.mana_cost,
          cmc: cardData.cmc,
          cubucksCost: cardData.cubucks_cost,
          cubecobraElo: cardData.cubecobra_elo,
        });
        usedCardIds.add(entry.cardPoolId);
      }
    }

    // Fill remaining slots with algorithm-computed order
    if (queue.length < limit) {
      // Get team's drafted colors for affinity
      const { picks: teamPicks } = await getTeamDraftPicks(teamId);
      const draftedColorCounts = countDraftedColors(teamPicks);

      // Sort remaining available cards by ELO (with affinity) descending
      const remainingCards = availableCards
        .filter((c) => !usedCardIds.has(c.id) && c.cubecobra_elo != null)
        .map((card) => {
          // Apply color affinity modifier for sorting
          let modifier = 1;
          if (card.colors && card.colors.length > 0) {
            modifier = Math.max(
              ...card.colors.map((c) => 1 + 0.01 * (draftedColorCounts[c] || 0))
            );
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
 * Replaces the entire manual queue with the provided entries.
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
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const supabase = await createServerClient();

    // Delete all existing queue entries for this team
    const { error: deleteError } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId);

    if (deleteError) {
      console.error("Error clearing draft queue:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Insert new entries if any
    if (entries.length > 0) {
      const rows = entries.map((entry, index) => ({
        team_id: teamId,
        card_pool_id: entry.cardPoolId,
        card_id: entry.cardId,
        card_name: entry.cardName,
        position: index + 1,
        pinned: entry.pinned || false,
        added_by: auth.userId,
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
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const supabase = await createServerClient();

    // Remove existing entry for this card if any
    await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId);

    // Shift existing entries at this position and after
    const { data: existingEntries } = await supabase
      .from("team_draft_queue")
      .select("id, position")
      .eq("team_id", teamId)
      .gte("position", position)
      .order("position", { ascending: false });

    // Shift positions up by 1 (starting from the end to avoid unique constraint violations)
    for (const entry of existingEntries || []) {
      await supabase
        .from("team_draft_queue")
        .update({ position: entry.position + 1 })
        .eq("id", entry.id);
    }

    // Insert the new entry at the desired position
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

    // Get the position being removed
    const { data: entry } = await supabase
      .from("team_draft_queue")
      .select("position")
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId)
      .single();

    if (!entry) {
      return { success: true }; // Already not in queue
    }

    // Delete the entry
    const { error: deleteError } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("team_id", teamId)
      .eq("card_pool_id", cardPoolId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Re-sequence remaining entries
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
// EXECUTION
// ============================================================================

/**
 * Execute the auto-draft for a team.
 * Verifies the team is on the clock, computes the pick, and executes it.
 */
export async function executeAutoDraft(
  teamId: string
): Promise<{
  success: boolean;
  pick?: { cardId: string; cardName: string; cost: number };
  source?: "manual_queue" | "algorithm";
  error?: string;
}> {
  try {
    // Verify the team is on the clock
    const { status: draftStatus } = await getDraftStatus();
    if (!draftStatus) {
      return { success: false, error: "No active draft" };
    }
    if (draftStatus.onTheClock.teamId !== teamId) {
      return { success: false, error: "This team is not on the clock" };
    }

    // Get the auto-draft preview to determine what to pick
    const preview = await getAutoDraftPreview(teamId);
    if (!preview.nextPick) {
      return { success: false, error: preview.error || "No card available to auto-draft" };
    }

    const card = preview.nextPick;
    const cost = card.cubucks_cost || 1;

    // Check team balance
    const { team: teamBalance } = await getTeamBalance(teamId);
    if (!teamBalance || teamBalance.cubucks_balance < cost) {
      return { success: false, error: `Insufficient Cubucks. Need ${cost}, have ${teamBalance?.cubucks_balance || 0}` };
    }

    // Execute the draft: spend cubucks
    const cubucksResult = await spendCubucksOnDraft(
      teamId,
      card.card_id,
      card.card_name,
      cost,
      card.id, // card_pool_id
      undefined
    );

    if (!cubucksResult.success) {
      return { success: false, error: cubucksResult.error || "Failed to spend Cubucks" };
    }

    // Get current pick count for this team
    const { picks: existingPicks } = await getTeamDraftPicks(teamId);

    // Add the draft pick
    const pickResult = await addDraftPick({
      team_id: teamId,
      card_pool_id: card.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors,
      image_url: card.image_url,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      pick_number: existingPicks.length + 1,
    });

    if (!pickResult.success) {
      await conditionallyCleanupDraftQueues(card.card_id);
      return { success: false, error: pickResult.error || "Failed to add draft pick" };
    }
/**
 * Conditionally cleans up draft queues using a high-performance caching strategy.
 */
export async function conditionallyCleanupDraftQueues(
  draftedCardId: string
): Promise<{ success: boolean; cleaned: boolean; error?: string }> {
  try {
    const duplicateSet = await getDuplicateCardIdSet();

    if (!duplicateSet.has(draftedCardId)) {
      console.log(`Unique card ${draftedCardId} drafted. Cleaning queues immediately.`);
      const supabase = await createServerClient();
      const { error: deleteError } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
      if (deleteError) return { success: false, cleaned: false, error: deleteError.message };
      return { success: true, cleaned: true };
    }

    console.log(`Duplicate card ${draftedCardId} drafted. Checking for remaining copies...`);
    const { cards: availableCards } = await getAvailableCardsForDraft();
    const isMoreAvailable = availableCards.some(card => card.card_id === draftedCardId);

    if (isMoreAvailable) {
      return { success: true, cleaned: false };
    }

    console.log(`Last copy of ${draftedCardId} drafted. Cleaning all team queues.`);
    const supabase = await createServerClient();
    const { error: deleteError } = await supabase.from("team_draft_queue").delete().eq("card_id", draftedCardId);
    if (deleteError) return { success: false, cleaned: false, error: deleteError.message };
    
    return { success: true, cleaned: true };
  } catch (error) {
    console.error("Unexpected error in conditional queue cleanup:", error);
    return { success: false, cleaned: false, error: "Failed to clean up draft queues" };
  }
}
    // Log the auto-draft
    const supabase = await createServerClient();
    await supabase.from("auto_draft_log").insert({
      team_id: teamId,
      card_id: card.card_id,
      card_name: card.card_name,
      card_pool_id: card.id,
      pick_source: preview.source === "manual_queue" ? "manual_queue" : "algorithm",
      algorithm_details: preview.algorithmDetails || null,
      round_number: draftStatus.currentRound,
    });

    // Clean up: remove this card from all teams' queues
    await cleanupDraftQueues(card.card_id);

    return {
      success: true,
      pick: { cardId: card.card_id, cardName: card.card_name, cost },
      source: preview.source,
    };
 } catch (error) {
    console.error("Error executing auto-draft:", error);
    
    // Check if the error is the specific "Failed to find Server Action" error
    // This is a bit of a hack, but it's a common pattern for this issue.
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Failed to find Server Action")) {
      return { 
        success: false, 
        error: "Deployment has changed. Please refresh the page.",
        // Add a specific flag the UI can check for
        staleDeployment: true 
      };
    }

    return { success: false, error: "Failed to execute auto-draft" };
  }
}

/**
 * Remove a drafted card from ALL teams' draft queues.
 * Called after any card is drafted (manually or via auto-draft).
 */
export async function cleanupDraftQueues(
  cardId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("team_draft_queue")
      .delete()
      .eq("card_id", cardId);

    if (error) {
      console.error("Error cleaning up draft queues:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error cleaning up draft queues:", error);
    return { success: false, error: "Failed to clean up draft queues" };
  }
}
