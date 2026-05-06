
// src/app/pools/wire/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { getWireCards, type WireCard } from "@/app/actions/wireActions";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { WireCardComponent } from "@/app/components/WireCardComponent"; 
import { Input } from "@/app/components/ui/input";

const PAGE_SIZE = 50;

export default function WirePage() {
  const [wireCards, setWireCards] = useState<WireCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
  
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
 useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 on new search
      loadWireData(1, searchTerm);
    }, 400); // 400ms delay after typing stops

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Page change effect (skips running on mount if searchTerm is empty to avoid double-fetch)
  useEffect(() => {
    if (currentPage !== 1) {
       loadWireData(currentPage, searchTerm);
    }
  }, [currentPage]);


const handleBidSuccess = () => {
    loadWireData(currentPage, searchTerm); 
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  

  if (loading && wireCards.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading The Wire...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">The Wire</h1>
          <p className="text-muted-foreground text-lg">
            Bid on unclaimed cards. Bids processed every Wednesday at Midnight (UTC).
          </p>
        </div>
        <div className="text-sm font-medium bg-secondary/50 px-3 py-1 rounded-full border">
          {totalCount} Cards Available
        </div>
      </div>
{/* --- NEW SEARCH BAR --- */}
      <div className="mb-8 p-4 border rounded-xl bg-card shadow-sm">
         <label className="block text-sm font-medium text-muted-foreground mb-2">Search The Wire</label>
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
      
      {error && (
        <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {wireCards.length === 0 && !loading ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-xl font-semibold">The Wire is currently empty.</p>
          <p className="text-muted-foreground mt-2">Check back later.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {wireCards.map((card) => (
              <WireCardComponent key={card.id} card={card} onBidSuccess={handleBidSuccess} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="flex items-center gap-1 px-4 py-2 rounded-md border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || loading}
                className="flex items-center gap-1 px-4 py-2 rounded-md border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Loading Overlay for page transitions */}
      {loading && wireCards.length > 0 && (
        <div className="fixed inset-0 bg-background/40 backdrop-blur-sm z-50 flex items-center justify-center">
             <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
