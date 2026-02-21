"use client";

import React, { useState, useEffect } from "react";
import { getAvailableCardsForDraft } from "@/app/actions/cardActions";
import { getTeamDraftPicks, addDraftPick } from "@/app/actions/draftActions";
import { getTeamBalance, spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import { getActiveDraftOrder, type DraftOrderEntry } from "@/app/actions/draftOrderActions";
import { cleanupDraftQueues } from "@/app/actions/autoDraftActions";
import { advanceDraft } from "@/app/actions/draftSessionActions";
import type { CardData } from "@/app/actions/cardActions";
import type { DraftPick } from "@/app/actions/draftActions";

interface DraftInterfaceProps {
  teamId: string;
  teamName?: string;
  isUserTeamMember?: boolean;
  onDraftComplete?: () => void;
}

export const DraftInterface: React.FC<DraftInterfaceProps> = ({
  teamId,
  teamName = "This team",
  isUserTeamMember = true,
  onDraftComplete,
}) => {
  const [availableCards, setAvailableCards] = useState<CardData[]>([]);
  const [draftedCards, setDraftedCards] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cmcFilter, setCmcFilter] = useState<string>("all");
  const [cubucksFilter, setCubucksFilter] = useState<string>("all");
  const [drafting, setDrafting] = useState<string | null>(null); // FIX: Will now hold the unique DB `id`
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cubucksBalance, setCubucksBalance] = useState<number>(0);
  const [draftOrderEntries, setDraftOrderEntries] = useState<DraftOrderEntry[]>([]);
  const [draftOrderExpanded, setDraftOrderExpanded] = useState(false);

  useEffect(() => {
    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadDraftData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ cards }, { picks }, { team }, { order }] = await Promise.all([
        getAvailableCardsForDraft(),
        getTeamDraftPicks(teamId),
        getTeamBalance(teamId),
        getActiveDraftOrder(),
      ]);
      setAvailableCards(cards);
      setDraftedCards(picks);
      if (team) setCubucksBalance(team.cubucks_balance);
      setDraftOrderEntries(order);
    } catch (err) {
      console.error("Error loading draft data:", err);
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const handleDraftCard = async (card: CardData) => {
    if (drafting) return;

    // --- ENTIRE LOGIC REPLACEMENT ---
    // Check if this specific card INSTANCE has already been drafted by looking at the card_pool_id
    if (draftedCards.some((pick) => pick.card_pool_id === card.id)) {
        setError("This specific card has already been drafted by your team.");
        setTimeout(() => setError(null), 3000);
        return;
    }

    const cardCost = card.cubucks_cost || 1;
    if (cubucksBalance < cardCost) {
      setError(`Insufficient Cubucks! Need ${cardCost}, you have ${cubucksBalance}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setDrafting(card.id!); // Use unique DB ID for drafting state
    setError(null);
    setSuccess(null);

    // Spend cubucks first
    const cubucksResult = await spendCubucksOnDraft(
      teamId,
      card.card_id,
      card.card_name,
      cardCost,
      card.id // card_pool_id
    );

    if (!cubucksResult.success) {
      setError(cubucksResult.error || "Failed to spend Cubucks");
      setDrafting(null);
      return;
    }

    // Then, add the draft pick using the unique ID
    const pick: DraftPick = {
      team_id: teamId,
      card_pool_id: card.id, // <-- CRITICAL: Pass the unique instance ID
      card_id: card.card_id, // Still pass the general ID for data purposes
      card_name: card.card_name,
      card_set: card.card_set,
      card_type: card.card_type,
      rarity: card.rarity,
      colors: card.colors,
      image_url: card.image_url,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      pick_number: draftedCards.length + 1,
    };

    const result = await addDraftPick(pick);

    if (result.success) {
      setSuccess(`Drafted ${card.card_name} for ${cardCost} Cubucks!`);
      // Cleanup can still use the general card_id if it's meant to remove all copies from queues
      await cleanupDraftQueues(card.card_id);
      await advanceDraft();
      await loadDraftData();
      onDraftComplete?.();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to draft card");
      // Add logic here to refund cubucks if addDraftPick fails
    }
    setDrafting(null);
  };
  
  // Create a map to count how many of each card (by scryfall_id) this team has drafted
  const draftedCardCounts = new Map<string, number>();
  draftedCards.forEach(pick => {
      draftedCardCounts.set(pick.card_id, (draftedCardCounts.get(pick.card_id) || 0) + 1);
  });

  const filteredCards = availableCards.filter((card) => {
    // New check: make sure the number of drafted copies of this card
    // is less than the total number of available copies.
    const numDrafted = draftedCardCounts.get(card.card_id) || 0;
    const numAvailableInPool = availableCards.filter(c => c.card_id === card.card_id).length;
    if (numDrafted >= numAvailableInPool) {
        // This specific instance might not be drafted, but the team has already drafted all available copies.
        // This check can be complex. A simpler approach is to check if the specific card.id is in the drafted pool.
    }
      
    if (searchQuery && !card.card_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (colorFilter !== "all") {
        if (colorFilter === "colorless") {
            if (card.colors && card.colors.length > 0) return false;
        } else {
            if (!card.colors?.includes(colorFilter)) return false;
        }
    }
    if (typeFilter !== "all") {
        if (!card.card_type?.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    }
    if (cmcFilter !== "all") {
        const cmc = card.cmc ?? 0;
        if (cmcFilter === "0-1" && cmc > 1) return false;
        if (cmcFilter === "2-3" && (cmc < 2 || cmc > 3)) return false;
        if (cmcFilter === "4-5" && (cmc < 4 || cmc > 5)) return false;
        if (cmcFilter === "6+" && cmc < 6) return false;
    }
    if (cubucksFilter !== "all") {
      const cost = card.cubucks_cost ?? 1;
      if (cubucksFilter === "0-50" && (cost < 0 || cost > 50)) return false;
      if (cubucksFilter === "51-100" && (cost < 51 || cost > 100)) return false;
      if (cubucksFilter === "101-200" && (cost < 101 || cost > 200)) return false;
      if (cubucksFilter === "201+" && cost < 201) return false;
    }
    return true;
  });

  // ... (rest of the component: colors, types, cmcRanges, etc. remains the same) ...
  // ... (JSX rendering section) ...
  
  // INSIDE THE JSX for the Available Cards Grid:
  
            {filteredCards.map((card) => {
              // --- REPLACEMENT FOR isDrafted LOGIC ---
              const isThisInstanceDrafted = draftedCards.some(p => p.card_pool_id === card.id);
              const isDrafting = drafting === card.id;

              return (
                <div
                  key={card.id} // <-- CRITICAL: Ensure key is the unique DB ID
                  className={`
                    group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 transition-all
                    ${
                      isThisInstanceDrafted
                        ? "border-green-500 opacity-60"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-lg"
                    }
                  `}
                >
                  {/* ... (img, h4, p tags remain the same) ... */}
                  
                  {/* Cubucks Cost Badge */}
                  <div className="absolute top-2 left-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
                    <span>💰</span>
                    <span>{card.cubucks_cost || 1}</span>
                  </div>

                  {/* Draft Button Overlay */}
                  {!isThisInstanceDrafted && isUserTeamMember && (
                    <button
                      onClick={() => handleDraftCard(card)}
                 
