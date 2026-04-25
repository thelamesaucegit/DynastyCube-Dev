
// src/app/pools/wire/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { getWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, AlertCircle } from "lucide-react";
import { WireCardComponent } from "@/app/components/WireCardComponent"; // We will create this next

export default function WirePage() {
  const [wireCards, setWireCards] = useState<WireCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWireData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { cards, error: fetchError } = await getWireCards();
      if (fetchError) {
        setError(fetchError);
      } else {
        setWireCards(cards);
      }
    } catch (err) {
      setError("An unexpected error occurred while fetching wire data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWireData();
  }, []);

  const handleBidSuccess = () => {
    // Re-fetch data to show the updated bid status
    loadWireData(); 
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading The Wire...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="mt-4 font-bold text-destructive">Error Loading The Wire</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
        <p className="text-muted-foreground text-lg">
          Bid on unclaimed cards. Bids are processed every Wednesday at Midnight (UTC).
        </p>
      </div>

      {wireCards.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">The Wire is currently empty.</p>
          <p className="text-muted-foreground mt-2">Check back after cards have been cut or the draft has completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {wireCards.map((card) => (
            <WireCardComponent key={card.id} card={card} onBidSuccess={handleBidSuccess} />
          ))}
        </div>
      )}
    </div>
  );
}
