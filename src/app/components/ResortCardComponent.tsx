//src/app/components/ResortCardComponent.tsx

"use client";

import React, { useState } from "react";
import type { ResortCardWithVote } from "@/app/actions/resortActions";
import { useAuth } from "@/contexts/AuthContext";
import { castResortVote } from "@/app/actions/resortActions";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";

interface ResortCardProps {
  card: ResortCardWithVote;
  onVoteSuccess: () => void;
}

export function ResortCardComponent({ card, onVoteSuccess }: ResortCardProps) {
  const { team } = useAuth(); // Assuming your AuthContext provides the user's team info
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVote = async () => {
    if (!team) {
      toast.error("You must be on a team to vote.");
      return;
    }
    if (card.team_has_voted_for) {
        toast.info("Your team has already voted for this card.");
        return;
    }

    setIsSubmitting(true);
    const result = await castResortVote(team.id, card.id);
    if (result.success) {
      toast.success(`Your team has voted for ${card.card_name}!`);
      onVoteSuccess(); // This will trigger a re-fetch on the parent page
    } else {
      toast.error(result.error || "Failed to cast vote.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="group relative border rounded-lg overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
      <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-800">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.card_name}
            className="w-full h-full object-cover"
          />
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

      {/* Voting Button Overlay */}
      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {card.team_has_voted_for ? (
            <div className="text-center text-primary-foreground">
                <CheckCircle className="mx-auto h-10 w-10 text-green-400 mb-2" />
                <p className="font-bold">Your Team Voted</p>
                <p className="text-xs text-green-200">You can change your vote by selecting another card.</p>
            </div>
        ) : (
            <Button onClick={handleVote} disabled={isSubmitting || !team}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vote for this card
            </Button>
        )}
      </div>
    </div>
  );
}
