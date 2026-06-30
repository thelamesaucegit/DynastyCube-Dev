// src/app/components/WireCardComponent.tsx

"use client";

import { CardPreview } from "@/app/components/CardPreview";
import React, { useState } from "react";
import Image from "next/image";
import { type WireCard, placeWireBid } from "@/app/actions/wireActions";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Loader2 } from "lucide-react";

interface WireCardProps {
  card: WireCard;
  onBidSuccess: () => void;
}

export const WireCardComponent: React.FC<WireCardProps> = ({ card, onBidSuccess }) => {
  const { useOldestArt } = useSettings();
  const imageUrl = getCardImageUrl(card, useOldestArt);

  const [bidAmount, setBidAmount] = useState<string>(card.currentUserTeamBid?.toString() || "");
  const [isBidding, setIsBidding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePlaceBid = async () => {
    const numericBid = parseInt(bidAmount, 10);
    if (isNaN(numericBid) || numericBid < 1) {
      setError("Bid must be a number greater than or equal to 1.");
      return;
    }

    setIsBidding(true);
    setError(null);
    setSuccess(null);

    const result = await placeWireBid(card.id!, numericBid);

    if (result.success) {
      setSuccess(`Bid of ${numericBid} placed!`);
      onBidSuccess(); // Notify parent to refresh data
    } else {
      setError(result.error || "An unknown error occurred.");
    }

    setIsBidding(false);
    setTimeout(() => { setSuccess(null); setError(null); }, 4000);
  };

  return (
    <div className="border rounded-lg overflow-hidden group relative flex flex-col">
      {/* Card Image */}
      <div className="relative aspect-[5/7]">
        {imageUrl ? (
          <Image src={imageUrl} alt={card.card_name} fill className="object-cover" />
        ) : (
          <div className="bg-muted flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground p-2">{card.card_name}</span>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3 flex-grow flex flex-col bg-card">
        <h4 className="font-semibold text-sm truncate">{card.card_name}</h4>
        <p className="text-xs text-muted-foreground truncate">{card.card_type}</p>
        
        {/* Bidding UI */}
        <div className="mt-auto pt-3">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Bid..."
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              disabled={isBidding}
              min="1"
              className="h-9"
            />
            <Button onClick={handlePlaceBid} disabled={isBidding} size="sm" className="h-9">
              {isBidding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bid"}
            </Button>
          </div>
          {card.currentUserTeamBid && (
            <p className="text-xs text-center mt-1 text-primary font-medium">Your current bid: {card.currentUserTeamBid} Ç</p>
          )}
          {error && <p className="text-xs text-destructive text-center mt-1">{error}</p>}
          {success && <p className="text-xs text-green-600 text-center mt-1">{success}</p>}
        </div>
      </div>
    </div>
  );
};
