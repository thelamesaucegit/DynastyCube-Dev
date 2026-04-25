//src/app/pools/resort/page.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getResortCards, type ResortCardWithVote } from "@/app/actions/resortActions";
import { getUserTeam } from "@/app/actions/teamActions"; 
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { ResortCardComponent } from "@/app/components/ResortCardComponent";

// Define the Team type locally for state management
interface Team {
  id: string;
  name: string;
  emoji: string;
}

export default function ResortPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [resortCards, setResortCards] = useState<ResortCardWithVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This effect fetches the user's team data once the user object is available.
  useEffect(() => {
    // CORRECTED: Capture the email in a constant.
    const userEmail = user?.email;

    // Check the constant. This makes the type guard explicit.
    if (userEmail) {
      const fetchUserTeam = async () => {
        try {
          // Now we pass the constant 'userEmail', which is guaranteed to be a string.
          const { team: userTeam, error: teamError } = await getUserTeam(userEmail);
          if (teamError) {
            setError(teamError);
          }
          setTeam(userTeam);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch team data.";
            setError(message);
        }
      };
      fetchUserTeam();
    } else {
      // If there's no user, there's no team.
      setTeam(null);
    }
  }, [user]); // This effect correctly depends on the user object.

  const loadResortData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { cards, error: fetchError } = await getResortCards(team?.id);
      if (fetchError) {
        setError(fetchError);
      } else {
        setResortCards(cards);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [team]);

  // This effect loads the main page data after the user and their team have been loaded.
  useEffect(() => {
    // This logic ensures we don't try to load cards until we know if there is a team or not.
    if (user) {
        loadResortData();
    } else if (user === null) { // Explicitly check for when auth has resolved to no user
        setLoading(false);
    }
  }, [user, team, loadResortData]); // Depend on team state as well

  const handleVoteSuccess = () => {
    loadResortData(); 
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading The Resort Pool...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="mt-4 font-bold text-destructive">Error Loading The Resort Pool</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">The Resort Pool</h1>
        <p className="text-muted-foreground text-lg">
          During the Post-Season, each team may cast one vote for a card to be added to The Chamber.
        </p>
      </div>

      {resortCards.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">The Resort Pool is currently empty.</p>
          <p className="text-muted-foreground mt-2">An admin must add cards before voting can begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {resortCards.map((card) => (
            <ResortCardComponent 
              key={card.id} 
              card={card} 
              teamId={team?.id}
              onVoteSuccess={handleVoteSuccess} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
