// src/app/components/ResortCardComponent.tsx
"use client";

import React, { useState } from "react";
import type { ResortCardWithVote } from "@/app/actions/resortActions";
import { castResortVote } from "@/app/actions/resortActions";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";

interface ResortCardProps {
  card: ResortCardWithVote;
  teamId: string | undefined; // Accepts teamId from the parent page
  onVoteSuccess: () => void;
}

export function ResortCardComponent({ card, teamId, onVoteSuccess }: ResortCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVote = async () => {
    if (!teamId) {
      toast.error("You must be on a team to vote.");
      return;
    }
    
    // THE FIX: Assign to a strict, immutable constant.
    // This tells TypeScript that this exact string cannot mutate during the async "await" tick.
    const activeTeamId: string = teamId;

    setIsSubmitting(true);
    
    // Pass the strictly typed 'activeTeamId' instead of the prop 'teamId'
    const result = await castResortVote(activeTeamId, card.id);
    
    if (result.success) {
      toast.success(`Your team's vote for ${card.card_name} has been recorded!`);
      onVoteSuccess();
    } else {
      toast.error(result.error || "Failed to cast vote.");
    }
    setIsSubmitting(false);
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
      <div className="p-3 bg-card">
        <h3 className="font-semibold text-sm truncate">{card.card_name}</h3>
        <p className="text-xs text-muted-foreground">Votes: {card.vote_count}</p>
      </div>
      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {card.team_has_voted_for ? (
            <div className="text-center text-primary-foreground">
                <CheckCircle className="mx-auto h-10 w-10 text-green-400 mb-2" />
                <p className="font-bold">Your Team Voted</p>
                <p className="text-xs text-green-200">You can change your vote by selecting another card.</p>
            </div>
        ) : (
            <Button onClick={handleVote} disabled={isSubmitting || !teamId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vote for this card
            </Button>
        )}
      </div>
    </div>
  );
}
