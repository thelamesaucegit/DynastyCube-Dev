
// src/app/pools/free-agents/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { addDraftPick } from "@/app/actions/draftActions";
import { spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { Button } from "@/app/components/ui/button";
import { Loader2 } from "lucide-react";

export default function FreeAgentsPage() {
  const { user } = useAuth();
  const { useOldestArt } = useSettings();
  const [freeAgents, setFreeAgents] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFreeAgents = async () => {
    setLoading(true);
    setError(null);
    // Fetch cards specifically from the 'free' pool
    const { cards, error: fetchError } = await getAvailableCardsForDraft("free");
    if (fetchError) {
      setError(fetchError);
    } else {
      setFreeAgents(cards || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFreeAgents();
  }, []);

  const handleClaimCard = async (card: CardData) => {
    if (!user) {
      setError("You must be logged in and on a team to claim a free agent.");
      return;
    }
    setClaiming(card.id!);
    setError(null);
    setSuccess(null);

    // This logic mimics the DraftInterface but is simplified for free agents
    const cardCost = 1; // Free agents always cost 1 Cubuck

    // You need to get the user's teamId. This logic may need to live in a server action.
    // For now, we'll assume a placeholder action `getUserTeamId(userId)` exists.
    // const userTeamId = await getUserTeamId(user.id); 
    // if (!userTeamId) { setError("Could not find your team."); setClaiming(null); return; }

    // This should be a single, atomic server action for safety.
    // Let's create a new action: claimFreeAgent(cardId, teamId)
    // const result = await claimFreeAgent(card.id, userTeamId);

    // Placeholder until the action is written:
    const result = { success: false, error: "Claiming function not yet implemented." };

    if (result.success) {
      setSuccess(`Successfully claimed ${card.card_name}!`);
      loadFreeAgents(); // Refresh the list
    } else {
      setError(result.error || "Failed to claim card.");
    }

    setClaiming(null);
  };

  if (loading) return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Free Agents</h1>
        <p className="text-muted-foreground text-lg">
          Claim un-bid on cards for a flat cost of 1 Çubuck. First come, first served.
        </p>
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}
      {success && <p className="text-green-600 mb-4">{success}</p>}

      {freeAgents.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">There are no Free Agents available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {freeAgents.map((card) => {
            const isClaiming = claiming === card.id;
            const imageUrl = getCardImageUrl(card, useOldestArt);
            return (
              <div key={card.id} className="border rounded-lg overflow-hidden group relative">
                <div className="relative aspect-[5/7]">
                  {imageUrl && <Image src={imageUrl} alt={card.card_name} fill className="object-cover" />}
                </div>
                <div className="p-2">
                  <h4 className="font-semibold text-sm truncate">{card.card_name}</h4>
                  <p className="text-xs text-muted-foreground">1 Ç</p>
                </div>
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button onClick={() => handleClaimCard(card)} disabled={isClaiming}>
                    {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim Card"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
