//src/app/components/admin/CardManagement.tsx

"use client";

import React, { useState, useEffect } from "react";

import {
  getCardPool,
  addCardToPool,
  removeCardFromPool,
  bulkImportCards,
  removeFilteredCards,
  undraftAllCards,
    clearCardPool, // Import the updated clearCardPool
} from "@/app/actions/cardActions";
import type { CardData, PoolTableName } from "@/app/actions/cardActions"; // Import the new type
import { getPoolCardsWithStatus } from "@/app/actions/poolActions";
import type { PoolCard } from "@/app/actions/poolActions";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/app/components/ui/alert-dialog";
import { toast } from "sonner"; 
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";


interface MTGCard {
  id: string;
  name: string;
  set: string;
  rarity: string;
  colors: string[];
  type: string;
  imageUrl: string;
  manaCost?: string;
  cmc: number;
}

interface CardManagementProps {
  onUpdate?: () => void;
}

export const CardManagement: React.FC<CardManagementProps> = ({ onUpdate }) => {
  // MODIFIED: State to manage which pool is active
  const [activePool, setActivePool] = useState<PoolTableName>("card_pools");

  const [cards, setCards] = useState<CardData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MTGCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCost, setBulkCost] = useState("1");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    added: number;
    skipped: number;
    failed: string[];
  } | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [poolCards, setPoolCards] = useState<PoolCard[]>([]);
  const [clearFilter, setClearFilter] = useState<"all" | "undrafted" | "drafted" | null>(null);
  const [clearStep, setClearStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  // MODIFIED: Load cards whenever the activePool changes
  useEffect(() => {
    loadCards();
  }, [activePool]);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      // MODIFIED: Pass the active pool table name to the action
      const poolResult = await getCardPool(activePool);
      if (poolResult.error) {
        setError(poolResult.error);
        setCards([]);
      } else {
        setCards(poolResult.cards);
      }
      // Only fetch draft status for the main card pool
      if (activePool === "card_pools") {
        const statusResult = await getPoolCardsWithStatus();
        setPoolCards(statusResult.cards || []);
      } else {
        setPoolCards([]); // Clear draft status for The Chamber
      }
    } catch (err) {
      console.error("Error loading cards:", err);
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };


  const handleSearchCard = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      // Using Scryfall API to search for cards
      const response = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
          searchQuery
        )}&unique=cards`
      );
      if (response.ok) {
        const data = await response.json();
        const formattedResults: MTGCard[] = data.data
          .slice(0, 10)
          .map((card: any) => {
            const c = card as {
              id: string;
              name: string;
              set_name: string;
              rarity: string;
              colors?: string[];
              type_line: string;
              image_uris?: { normal?: string; small?: string };
              mana_cost?: string;
              cmc?: number;
            };
            return {
              id: c.id,
              name: c.name,
              set: c.set_name,
              rarity: c.rarity,
              colors: c.colors || [],
              type: c.type_line,
              imageUrl: c.image_uris?.normal || c.image_uris?.small || "",
              manaCost: c.mana_cost,
              cmc: c.cmc || 0,
            };
          });
        setSearchResults(formattedResults);
      } else {
        setError("Failed to search cards from Scryfall");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching cards:", error);
      setError("Error searching cards");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddCard = async (card: MTGCard) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    const cardData: CardData = {
      card_id: card.id,
      card_name: card.name,
      card_set: card.set,
      card_type: card.type,
      rarity: card.rarity,
      colors: card.colors,
      image_url: card.imageUrl,
      mana_cost: card.manaCost,
      cmc: card.cmc,
    };
    // MODIFIED: Pass active pool to the action
    const result = await addCardToPool(cardData, activePool);
    if (result.success) {
      toast.success(`Added ${card.name} to pool!`);
      await loadCards();
      onUpdate?.();
    } else {
      toast.error(result.error || "Failed to add card");
    }
    setActionLoading(false);
  };
  

const handleRemoveCard = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (!confirm(`Remove ${card.card_name} from the ${activePool === 'the_chamber' ? 'Chamber' : 'Pool'}?`)) return;

    setActionLoading(true);
    // MODIFIED: Pass active pool to the action
    const result = await removeCardFromPool(cardId, activePool);
    if (result.success) {
      toast.success(`Removed ${card.card_name}!`);
      await loadCards();
      onUpdate?.();
    } else {
      toast.error(result.error || "Failed to remove card");
    }
    setActionLoading(false);
  };

  // Pool clear helpers
  const draftedCount = poolCards.filter((c) => c.is_drafted).length;
  const undraftedCount = poolCards.filter((c) => !c.is_drafted).length;
  const totalCount = poolCards.length;

  const getAffectedCount = (filter: "all" | "undrafted" | "drafted") => {
    if (filter === "all") return totalCount;
    if (filter === "undrafted") return undraftedCount;
    return draftedCount;
  };

  const getFilterLabel = (filter: "all" | "undrafted" | "drafted") => {
    if (filter === "all") return "ALL cards";
    if (filter === "undrafted") return "all UNDRAFTED cards";
    return "all DRAFTED cards";
  };

  const openClearDialog = (filter: "all" | "undrafted" | "drafted") => {
    setClearFilter(filter);
    setClearStep(1);
    setConfirmText("");
  };

  const closeClearDialog = () => {
    setClearFilter(null);
    setClearStep(1);
    setConfirmText("");
  };

 const handleClearPool = async () => {
    if (!clearFilter || (clearFilter !== 'drafted' && confirmText !== "CONFIRM")) return;

    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
        let result: { success: boolean; error?: string; removedCount?: number; updatedCount?: number };
        
        if (clearFilter === 'drafted') {
            result = await undraftAllCards();
            if (result.success) {
                toast.success(`Successfully undrafted ${result.updatedCount || 0} card(s).`);
            }
        } else { // 'all' or 'undrafted'
             // For 'the_chamber', 'undrafted' is the same as 'all'
            if (activePool === 'the_chamber' && clearFilter === 'undrafted') {
                setClearFilter('all'); 
            }
            // Use the correct action based on filter
            if (clearFilter === 'all') {
                result = await clearCardPool(activePool);
                 if (result.success) {
                    toast.success(`Removed ${result.removedCount || 0} card(s) from the pool.`);
                }
            } else { // 'undrafted' for card_pools
                result = await removeFilteredCards('undrafted');
                 if (result.success) {
                    toast.success(`Removed ${result.removedCount || 0} undrafted card(s).`);
                }
            }
        }

        if (result.success) {
            closeClearDialog();
            await loadCards();
            onUpdate?.();
        } else {
            toast.error(result.error || "Failed to clear pool.");
            closeClearDialog();
        }
    } catch (err) {
        console.error("Error clearing pool:", err);
        toast.error("An unexpected error occurred while clearing the pool.");
        closeClearDialog();
    } finally {
        setClearing(false);
    }
  };


 const handleBulkImport = async () => {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return;
    const cost = parseInt(bulkCost);
    if (isNaN(cost) || cost < 0) {
      toast.error("Please enter a valid cubucks cost (0 or higher)");
      return;
    }
    if (!confirm(`Import ${lines.length} card(s)?`)) return;
    
    setBulkImporting(true);
    setBulkResult(null);
    
    // MODIFIED: Pass active pool to the action
    const result = await bulkImportCards(lines, cost, activePool);
    
    if (result.success) {
        setBulkResult({ added: result.added, skipped: result.skipped, failed: result.failed });
        if (result.added > 0) {
            toast.success(`Successfully imported ${result.added} card(s).`);
            await loadCards();
            onUpdate?.();
        }
        if (result.failed.length > 0) {
            toast.warning(`Could not find ${result.failed.length} card(s).`);
        }
        if (result.skipped > 0) {
             toast.info(`Skipped ${result.skipped} card(s) that were already in the pool.`);
        }
        setBulkText("");
    } else {
        toast.error(result.error || "Failed to import cards");
    }
    setBulkImporting(false);
  };
  

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading card pool...</p>
        </div>
      </div>
    );
  }

return (
    <div className="admin-section space-y-6">
      <div>
        <h2 className="admin-section-title">🃏 Card Pool Management</h2>
        <p className="admin-section-description">
          Manage cards in the main draft pool or The Chamber staging area.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Select Pool to Manage
        </label>
        {/* CORRECTED: Removed backslashes from Tailwind class */}
        <Select
          value={activePool}
          onValueChange={(value) => setActivePool(value as PoolTableName)}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a pool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card_pools">Main Card Pool</SelectItem>
            <SelectItem value="the_chamber">The Chamber</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
          🔍 Search & Add Cards
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search for cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchCard()}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button onClick={handleSearchCard} disabled={searchLoading || !searchQuery.trim()} className="admin-btn admin-btn-primary">
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchResults.map((card) => (
              <div key={card.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="w-16 h-22 object-cover rounded" />}
                <div className="flex-1">
                  <h4 className="font-semibold">{card.name}</h4>
                  <p className="text-sm text-muted-foreground">{card.set} • {card.rarity}</p>
                </div>
                <button onClick={() => handleAddCard(card)} disabled={actionLoading} className="admin-btn admin-btn-primary">Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Bulk Import</h3>
            <p className="text-sm text-muted-foreground">Paste card names to import many at once.</p>
          </div>
          <button onClick={() => setShowBulkImport(!showBulkImport)} className="admin-btn admin-btn-secondary text-sm">
            {showBulkImport ? "Hide" : "Show"}
          </button>
        </div>
        {showBulkImport && (
          <div>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Lightning Bolt\nCounterspell, 5\nBrainstorm`}
              rows={8} className="w-full p-3 border rounded-lg font-mono text-sm mb-3" />
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Default Cubucks Cost</label>
                <input type="number" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} min={0} className="w-32 p-2 border rounded-lg" />
              </div>
              <button onClick={handleBulkImport} disabled={!bulkText.trim() || bulkImporting} className="admin-btn admin-btn-primary">
                {bulkImporting ? "Importing..." : "Import Cards"}
              </button>
            </div>
            {bulkResult && (
              <div className="mt-4 p-4 bg-background border rounded-lg text-sm space-y-1">
                <p className="text-green-600">Added: {bulkResult.added}</p>
                {bulkResult.skipped > 0 && <p className="text-yellow-600">Skipped: {bulkResult.skipped}</p>}
                {bulkResult.failed.length > 0 && <p className="text-red-600">Failed: {bulkResult.failed.length}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg mb-2">Pool Actions</h3>
        <p className="text-sm text-muted-foreground mb-4">Permanently remove cards from the selected pool.</p>
        <div className="flex flex-wrap gap-3">
          {activePool === 'card_pools' ? (
            <>
              <button onClick={() => openClearDialog("undrafted")} disabled={undraftedCount === 0} className="admin-btn admin-btn-danger">Clear Undrafted ({undraftedCount})</button>
              <button onClick={() => openClearDialog("drafted")} disabled={draftedCount === 0} className="admin-btn admin-btn-danger">Clear Drafted ({draftedCount})</button>
              <button onClick={() => openClearDialog("all")} disabled={totalCount === 0} className="admin-btn admin-btn-danger">Clear All ({totalCount})</button>
            </>
          ) : (
            <button onClick={() => openClearDialog("all")} disabled={totalCount === 0} className="admin-btn admin-btn-danger">Clear The Chamber ({totalCount})</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4">Current {activePool === 'the_chamber' ? 'Chamber' : 'Card Pool'} ({cards.length})</h3>
        {cards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><p>No cards in this pool yet.</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cards.map((card) => (
              <div key={card.id || card.card_id} className="group relative">
                <button onClick={() => handleRemoveCard(card.id!)} disabled={actionLoading}
                  className="w-full text-left p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                  title={`Remove ${card.card_name}`}>
                  <span className="text-sm text-gray-800 dark:text-gray-200 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors truncate block">{card.card_name}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={clearFilter !== null} onOpenChange={(open) => !open && closeClearDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={clearFilter === "drafted" ? "text-orange-600" : "text-red-600"}>
              {clearFilter === "drafted" ? "Warning: Undraft Cards" : "Warning: Remove Cards"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to {clearFilter === "drafted" ? "undraft" : "remove"} <strong>{getAffectedCount(clearFilter!)}</strong> card(s).</p>
                <p>Filter: <strong>{getFilterLabel(clearFilter!)}</strong></p>
                {clearFilter !== 'drafted' && (
                  <p className="text-red-600 dark:text-red-400 font-medium">This action cannot be undone.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeClearDialog}>Cancel</AlertDialogCancel>
            <button onClick={handleClearPool} disabled={clearing} className="admin-btn admin-btn-danger disabled:opacity-50">
              {clearing ? "Processing..." : "Confirm"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CORRECTED: This block was moved back inside the main component return */}
      <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
          ✅ Database Persistence Active
        </h4>
        <ul className="text-sm text-green-800 dark:text-green-200 ml-4 list-disc space-y-1">
          <li>✓ Search for cards using Scryfall API</li>
          <li>✓ Preview card images before adding</li>
          <li>✓ Cards are automatically saved to database</li>
          <li>✓ Pool data persists across sessions</li>
        </ul>
        <p className="text-sm text-green-800 dark:text-green-200 mt-3">
          💡 Make sure you've run the schema.sql file to create the tables.
        </p>
      </div>
    </div>
  );
};
