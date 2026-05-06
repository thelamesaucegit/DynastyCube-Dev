//src/app/pools/resort/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getResortCards, type ResortCard } from "@/app/actions/resortActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions"; 
import { useAuth } from "@/contexts/AuthContext";
import { getUserTeam } from "@/app/actions/teamActions";
import { Loader2, AlertCircle, Info, Search } from "lucide-react";
import { ResortNominationCard } from "@/app/components/ResortNominationCard";
import { Input } from "@/app/components/ui/input";

// Define the Team type locally for state management
interface Team {
  id: string;
  name: string;
  emoji: string;
}

export default function ResortPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [resortCards, setResortCards] = useState<ResortCard[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPostseason, setIsPostseason] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    // Don't start loading until we know if the user is available
    if (user === undefined) return;

    setLoading(true);
    setError(null);
    try {
      // Fetch all necessary data in parallel
      const [cardResult, seasonResult, teamResult] = await Promise.all([
        getResortCards(),
        // CORRECTED: Call the existing `getCurrentSeason` function
        getCurrentSeason(),
        user?.email ? getUserTeam(user.email) : Promise.resolve({ team: null, error: undefined })
      ]);

      // Handle card data
      if (cardResult.error) {
        setError(cardResult.error);
      } else {
        setResortCards(cardResult.cards);
      }

      // Handle season data
      if (seasonResult.error || !seasonResult.season) {
         console.warn("Could not determine current season phase.");
         setIsPostseason(false);
      } else {
         // Check the 'phase' property of the returned season object
         setIsPostseason(seasonResult.season.phase === 'postseason');
      }
      
      // Handle team data
      if (teamResult.error) {
          console.warn("Could not fetch user team:", teamResult.error);
      }
      setTeam(teamResult.team);

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);
  
  const handleVoteSuccess = () => {
    // We don't need to reload the whole page, just the card data
    const reloadCards = async () => {
        const { cards, error: fetchError } = await getResortCards(team?.id);
        if (fetchError) {
            setError(fetchError);
        } else {
            setResortCards(cards);
        }
    };
    reloadCards();
  };
  
  const filteredCards = useMemo(() => {
    if (!searchTerm) return resortCards;
    return resortCards.filter(card => 
      card.card_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [resortCards, searchTerm]);

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
          Nominate a card for your Team&apos;s Off-Season vote.
        </p>
        {!isPostseason ? (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-3">
                <Info className="h-5 w-5" />
                <span>Nominations are only open during the Post-Season.</span>
            </div>
        ) : (
             <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded-lg text-sm text-green-800 dark:text-green-200 flex items-center gap-3">
                <Info className="h-5 w-5" />
                <span>Nominations are currently open! Nominated cards will appear as voting options on your Team Page.</span>
            </div>
        )}
      </div>

     {/* --- NEW SEARCH BAR --- */}
      {resortCards.length > 0 && (
        <div className="mb-8 p-4 border rounded-xl bg-card shadow-sm">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Search Resort Pool</label>
          <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Search by card name..." 
                  className="pl-10" 
              />
          </div>
        </div>
      )}

      {resortCards.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">The Resort Pool is currently empty.</p>
          <p className="text-muted-foreground mt-2">An admin must add cards before voting can begin.</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">No cards found matching &quot;{searchTerm}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Loop over filteredCards instead of resortCards */}
          {filteredCards.map((card) => (
            <ResortNominationCard 
              key={card.id} 
              card={card} 
              teamId={team?.id}
              isPostseason={isPostseason}
            />
          ))}
        </div>
      )}
    </div>
  );
}
