// src/app/components/admin/CardManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getCardPool,
  addCardToPool,
  removeCardFromPool,
} from "@/app/actions/cardActions";
import type { CardData } from "@/app/actions/cardActions";

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
  const [cards, setCards] = useState<CardData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MTGCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load cards from database on mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCardPool();
      if (result.error) {
        setError(result.error);
      } else {
        setCards(result.cards);
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
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards`
      );

      if (response.ok) {
        const data = await response.json();
        const formattedResults: MTGCard[] = data.data.slice(0, 10).map((card: unknown) => {
          const c = card as { id: string; name: string; set_name: string; rarity: string; colors?: string[]; type_line: string; image_uris?: { normal?: string; small?: string }; mana_cost?: string; cmc?: number };
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
    // Check if already in pool
    if (cards.find(c => c.card_id === card.id)) {
      setError("Card already in pool");
      return;
    }

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

    const result = await addCardToPool(cardData);

    if (result.success) {
      setSuccess(`Added ${card.name} to pool!`);
      await loadCards();
      onUpdate?.();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to add card");
    }

    setActionLoading(false);
  };

  const handleRemoveCard = async (cardId: string) => {
    const card = cards.find(c => c.card_id === cardId);
    if (!card) return;

    if (!confirm(`Remove ${card.card_name} from pool?`)) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const result = await removeCardFromPool(cardId);

    if (result.success) {
      setSuccess(`Removed ${card.card_name} from pool!`);
      await loadCards();
      onUpdate?.();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to remove card");
    }

    setActionLoading(false);
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
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">🃏 Card Pool Management</h2>
        <p className="admin-section-description">
          Add and manage Magic: The Gathering cards for draft pools
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      {/* Card Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
          🔍 Search & Add Cards
        </h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search for cards (e.g., 'Lightning Bolt', 'Counterspell')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchCard();
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearchCard}
            disabled={searchLoading || !searchQuery.trim()}
            className="admin-btn admin-btn-primary"
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Found {searchResults.length} cards:
            </p>
            {searchResults.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
              >
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {card.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {card.set} • {card.rarity} • {card.type}
                  </p>
                  {card.colors.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {card.colors.map((color) => (
                        <span
                          key={color}
                          className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAddCard(card)}
                  disabled={cards.some(c => c.card_id === card.id) || actionLoading}
                  className={`admin-btn ${
                    cards.some(c => c.card_id === card.id)
                      ? "admin-btn-secondary opacity-50 cursor-not-allowed"
                      : "admin-btn-primary"
                  }`}
                >
                  {cards.some(c => c.card_id === card.id) ? "Added" : "Add to Pool"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Pool */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            📋 Current Card Pool ({cards.length})
          </h3>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No cards in pool yet</p>
            <p className="text-sm">Search and add cards above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cards.map((card) => (
              <div
                key={card.id || card.card_id}
                className="group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-all"
              >
                {card.image_url && (
                  <img
                    src={card.image_url}
                    alt={card.card_name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-2">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {card.card_name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {card.card_set}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveCard(card.card_id)}
                  disabled={actionLoading}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Remove card"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
          💡 Make sure you&apos;ve run the schema.sql file to create the &quot;card_pools&quot; table.
        </p>
      </div>
    </div>
  );
};
