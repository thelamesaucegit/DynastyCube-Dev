//src/app/components/ResortNominationCard.tsx

"use client";

import React, { useState } from "react";
import type { ResortCard } from "@/app/actions/resortActions"; // We'll define/get this next
import { nominateResortCard } from "@/app/actions/resortActions";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Loader2, PlusCircle } from "lucide-react";

interface ResortNominationCardProps {
  card: ResortCard;
  teamId: string | undefined;
  isPostseason: boolean; // Control nomination availability by season phase
}

export function ResortNominationCard({ card, teamId, isPostseason }: ResortNominationCardProps) {
  const [isNominating, setIsNominating] = useState(false);

  const handleNominate = async () => {
    if (!teamId) {
      toast.error("You must be on a team to nominate a card.");
      return;
    }
    if (!isPostseason) {
      toast.info("Card nominations are only open during the Post-Season.");
      return;
    }

    setIsNominating(true);
    const result = await nominateResortCard(card.id, teamId, card.card_name);

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error || "Failed to nominate card.");
    }
    setIsNominating(false);
  };

  return (
    <div className="group relative border rounded-lg overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
      <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-800">
        {card.image_url ? (
          <img src={card.image_url} alt={card.card_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-center p-4">
            <p className="text-muted-foreground text-sm">{card.card_name}</p>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button onClick={handleNominate} disabled={isNominating || !teamId || !isPostseason}>
          {isNominating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          Nominate for Team
        </Button>
      </div>
    </div>
  );
}
