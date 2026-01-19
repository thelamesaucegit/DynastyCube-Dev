// src/app/components/DeckBuilder.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  getTeamDraftPicks,
  getTeamDecks,
  createDeck,
  deleteDeck,
  getDeckCards,
  addCardToDeck,
  removeCardFromDeck,
} from "@/app/actions/draftActions";
import type { DraftPick, Deck, DeckCard } from "@/app/actions/draftActions";

interface DeckBuilderProps {
  teamId: string;
}

// Draggable Card Component
function DraggableCard({ pick }: { pick: DraftPick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pick-${pick.id}`,
    data: { pick },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`w-full text-left p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {pick.image_url && (
          <img
            src={pick.image_url}
            alt={pick.card_name}
            className="w-12 h-16 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
            {pick.card_name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {pick.card_type}
          </p>
        </div>
        <span className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
          ⇄
        </span>
      </div>
    </div>
  );
}

// Droppable Zone Component
function DroppableZone({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''
      } transition-all`}
    >
      {children}
    </div>
  );
}

// Basic Lands data
const BASIC_LANDS = [
  { name: "Plains", color: "W", emoji: "⚪", image: "https://cards.scryfall.io/normal/front/5/4/54f67f45-eb8c-4c3e-8c7a-6e8b0c0e3f5a.jpg" },
  { name: "Island", color: "U", emoji: "🔵", image: "https://cards.scryfall.io/normal/front/f/f/ff7a16c5-8b10-4989-b2f9-ba84fe8e51d6.jpg" },
  { name: "Swamp", color: "B", emoji: "⚫", image: "https://cards.scryfall.io/normal/front/a/3/a3c6bc4f-0ca0-40e9-9bf3-e8ceb1df78fa.jpg" },
  { name: "Mountain", color: "R", emoji: "🔴", image: "https://cards.scryfall.io/normal/front/6/1/61af6645-86e9-4b4b-8c16-8c9c70a9b7b4.jpg" },
  { name: "Forest", color: "G", emoji: "🟢", image: "https://cards.scryfall.io/normal/front/b/9/b9c3c8d4-3a51-4c8e-971e-b2e2f3d8b6e0.jpg" },
];

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ teamId }) => {
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("standard");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"mainboard" | "sideboard" | "maybeboard">("mainboard");
  const [activeDragPick, setActiveDragPick] = useState<DraftPick | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (selectedDeck) {
      loadDeckCards(selectedDeck.id!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeck]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { picks } = await getTeamDraftPicks(teamId);
      setDraftPicks(picks);

      const { decks: teamDecks } = await getTeamDecks(teamId);
      setDecks(teamDecks);

      if (teamDecks.length > 0 && !selectedDeck) {
        setSelectedDeck(teamDecks[0]);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadDeckCards = async (deckId: string) => {
    try {
      const { cards } = await getDeckCards(deckId);
      setDeckCards(cards);
    } catch (err) {
      console.error("Error loading deck cards:", err);
    }
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      setError("Deck name is required");
      return;
    }

    const result = await createDeck({
      team_id: teamId,
      deck_name: newDeckName,
      description: newDeckDescription,
      format: newDeckFormat,
      is_public: false,
    });

    if (result.success) {
      setSuccess("Deck created successfully!");
      setShowNewDeckModal(false);
      setNewDeckName("");
      setNewDeckDescription("");
      setNewDeckFormat("standard");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to create deck");
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm("Are you sure you want to delete this deck?")) return;

    const result = await deleteDeck(deckId);

    if (result.success) {
      setSuccess("Deck deleted successfully!");
      setSelectedDeck(null);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to delete deck");
    }
  };

  const handleAddCardToDeck = async (pick: DraftPick) => {
    if (!selectedDeck) {
      setError("Please select a deck first");
      return;
    }

    // Check if card is already in deck
    if (deckCards.some((dc) => dc.card_id === pick.card_id && dc.category === activeCategory)) {
      setError("Card is already in this section");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const result = await addCardToDeck({
      deck_id: selectedDeck.id!,
      draft_pick_id: pick.id,
      card_id: pick.card_id,
      card_name: pick.card_name,
      quantity: 1,
      category: activeCategory,
    });

    if (result.success) {
      setSuccess(`Added ${pick.card_name} to ${activeCategory}!`);
      await loadDeckCards(selectedDeck.id!);
      setTimeout(() => setSuccess(null), 2000);
    } else {
      setError(result.error || "Failed to add card");
    }
  };

  const handleRemoveCardFromDeck = async (cardId: string, cardName: string) => {
    const result = await removeCardFromDeck(cardId);

    if (result.success) {
      setSuccess(`Removed ${cardName} from deck!`);
      if (selectedDeck) {
        await loadDeckCards(selectedDeck.id!);
      }
      setTimeout(() => setSuccess(null), 2000);
    } else {
      setError(result.error || "Failed to remove card");
    }
  };

  // Add a basic land to the deck
  const handleAddBasicLand = async (landName: string) => {
    if (!selectedDeck) {
      setError("Please select a deck first");
      return;
    }

    // Check if this basic land is already in the deck
    const existingLand = deckCards.find(
      (dc) => dc.card_name === landName && dc.category === activeCategory
    );

    if (existingLand) {
      // Increment quantity
      const result = await addCardToDeck({
        deck_id: selectedDeck.id!,
        draft_pick_id: undefined, // Basic lands don't have draft picks
        card_id: `basic-${landName.toLowerCase()}`,
        card_name: landName,
        quantity: (existingLand.quantity || 1) + 1,
        category: activeCategory,
      });

      if (result.success) {
        setSuccess(`Added ${landName} to ${activeCategory}!`);
        await loadDeckCards(selectedDeck.id!);
        setTimeout(() => setSuccess(null), 1000);
      } else {
        setError(result.error || "Failed to add basic land");
      }
    } else {
      // Add new basic land
      const result = await addCardToDeck({
        deck_id: selectedDeck.id!,
        draft_pick_id: undefined,
        card_id: `basic-${landName.toLowerCase()}`,
        card_name: landName,
        quantity: 1,
        category: activeCategory,
      });

      if (result.success) {
        setSuccess(`Added ${landName} to ${activeCategory}!`);
        await loadDeckCards(selectedDeck.id!);
        setTimeout(() => setSuccess(null), 1000);
      } else {
        setError(result.error || "Failed to add basic land");
      }
    }
  };

  // Update basic land quantity
  const handleUpdateBasicLandQuantity = async (landName: string, newQuantity: number) => {
    if (!selectedDeck) return;

    const existingLand = deckCards.find(
      (dc) => dc.card_name === landName && dc.category === activeCategory
    );

    if (!existingLand) return;

    if (newQuantity <= 0) {
      // Remove the land
      await handleRemoveCardFromDeck(existingLand.id!, landName);
    } else {
      // Update quantity
      const result = await addCardToDeck({
        deck_id: selectedDeck.id!,
        draft_pick_id: undefined,
        card_id: `basic-${landName.toLowerCase()}`,
        card_name: landName,
        quantity: newQuantity,
        category: activeCategory,
      });

      if (result.success) {
        await loadDeckCards(selectedDeck.id!);
      }
    }
  };

  // Export deck to Cockatrice format
  const handleExportToCockatrice = () => {
    if (!selectedDeck) {
      setError("No deck selected");
      return;
    }

    // Get cards by category
    const mainboard = getCardsByCategory("mainboard");
    const sideboard = getCardsByCategory("sideboard");

    // Build Cockatrice deck format
    let deckText = `// Deck: ${selectedDeck.deck_name}\n`;
    deckText += `// Format: ${selectedDeck.format || 'Unknown'}\n`;
    if (selectedDeck.description) {
      deckText += `// Description: ${selectedDeck.description}\n`;
    }
    deckText += `// Exported from Dynasty Cube\n`;
    deckText += `\n`;

    // Add mainboard
    if (mainboard.length > 0) {
      deckText += `// Mainboard (${mainboard.reduce((sum, card) => sum + (card.quantity || 1), 0)} cards)\n`;
      mainboard.forEach((card) => {
        deckText += `${card.quantity || 1} ${card.card_name}\n`;
      });
      deckText += `\n`;
    }

    // Add sideboard
    if (sideboard.length > 0) {
      deckText += `// Sideboard (${sideboard.reduce((sum, card) => sum + (card.quantity || 1), 0)} cards)\n`;
      sideboard.forEach((card) => {
        deckText += `SB: ${card.quantity || 1} ${card.card_name}\n`;
      });
    }

    // Create and download file
    const blob = new Blob([deckText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDeck.deck_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.cod`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`Exported ${selectedDeck.deck_name} to Cockatrice format!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Export deck to Arena format
  const handleExportToArena = () => {
    if (!selectedDeck) {
      setError("No deck selected");
      return;
    }

    // Get cards by category
    const mainboard = getCardsByCategory("mainboard");
    const sideboard = getCardsByCategory("sideboard");

    // Build Arena deck format (simpler format)
    let deckText = `Deck\n`;

    mainboard.forEach((card) => {
      deckText += `${card.quantity || 1} ${card.card_name}\n`;
    });

    if (sideboard.length > 0) {
      deckText += `\nSideboard\n`;
      sideboard.forEach((card) => {
        deckText += `${card.quantity || 1} ${card.card_name}\n`;
      });
    }

    // Create and download file
    const blob = new Blob([deckText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDeck.deck_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`Exported ${selectedDeck.deck_name} to Arena format!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const pick = active.data.current?.pick as DraftPick;
    setActiveDragPick(pick);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragPick(null);

    if (!over || !selectedDeck) return;

    // Check if dropped on a category zone
    if (over.id.toString().startsWith('category-')) {
      const category = over.id.toString().replace('category-', '') as "mainboard" | "sideboard" | "maybeboard";
      const pick = active.data.current?.pick as DraftPick;

      if (!pick) return;

      // Check if card is already in this category
      if (deckCards.some((dc) => dc.card_id === pick.card_id && dc.category === category)) {
        setError(`${pick.card_name} is already in ${category}`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Add card to the deck in the dropped category
      const result = await addCardToDeck({
        deck_id: selectedDeck.id!,
        draft_pick_id: pick.id,
        card_id: pick.card_id,
        card_name: pick.card_name,
        quantity: 1,
        category: category,
      });

      if (result.success) {
        setSuccess(`Added ${pick.card_name} to ${category}!`);
        await loadDeckCards(selectedDeck.id!);
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(result.error || "Failed to add card");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const getCardsByCategory = (category: string) => {
    return deckCards.filter((card) => card.category === category);
  };

  const mainboardCards = getCardsByCategory("mainboard");
  const sideboardCards = getCardsByCategory("sideboard");
  const maybeboardCards = getCardsByCategory("maybeboard");

  // Get available picks (not in current deck yet)
  const availablePicks = draftPicks.filter(
    (pick) => !deckCards.some((dc) => dc.card_id === pick.card_id && dc.category === activeCategory)
  );

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading deck builder...</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
            ✗ {error}
          </div>
        )}

      {/* Deck Selection / Creation */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Your Decks
          </h3>
          <button
            onClick={() => setShowNewDeckModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Deck
          </button>
        </div>

        {decks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No decks yet</p>
            <p className="text-sm">Create your first deck to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => setSelectedDeck(deck)}
                className={`
                  text-left p-4 rounded-lg border-2 transition-all
                  ${
                    selectedDeck?.id === deck.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                  }
                `}
              >
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {deck.deck_name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {deck.format}
                </p>
                {deck.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">
                    {deck.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Deck Modal */}
      {showNewDeckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Create New Deck
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deck Name *
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="My Awesome Deck"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newDeckDescription}
                  onChange={(e) => setNewDeckDescription(e.target.value)}
                  placeholder="Describe your deck strategy..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <select
                  value={newDeckFormat}
                  onChange={(e) => setNewDeckFormat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="standard">Standard</option>
                  <option value="modern">Modern</option>
                  <option value="commander">Commander</option>
                  <option value="legacy">Legacy</option>
                  <option value="vintage">Vintage</option>
                  <option value="pauper">Pauper</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleCreateDeck}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Create Deck
                </button>
                <button
                  onClick={() => {
                    setShowNewDeckModal(false);
                    setNewDeckName("");
                    setNewDeckDescription("");
                    setNewDeckFormat("standard");
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deck Builder Interface */}
      {selectedDeck && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Available Cards & Basic Lands */}
          <div className="lg:col-span-1 space-y-4">
            {/* Basic Lands Section */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>🏔️</span> Basic Lands
                </h3>
                <span className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  Unlimited
                </span>
              </div>

              <div className="space-y-2">
                {BASIC_LANDS.map((land) => {
                  const landInDeck = deckCards.find(
                    (dc) => dc.card_name === land.name && dc.category === activeCategory
                  );
                  const quantity = landInDeck?.quantity || 0;

                  return (
                    <div
                      key={land.name}
                      className="flex items-center justify-between bg-white/80 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{land.emoji}</span>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {land.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {quantity} in {activeCategory}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {quantity > 0 && (
                          <>
                            <button
                              onClick={() => handleUpdateBasicLandQuantity(land.name, quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded font-bold transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-bold text-gray-900 dark:text-gray-100">
                              {quantity}
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => handleAddBasicLand(land.name)}
                          className="w-7 h-7 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Drafted Cards */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Drafted Cards
                </h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {availablePicks.length} cards
                </span>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availablePicks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-8">
                    All drafted cards are in the deck
                  </p>
                ) : (
                  availablePicks.map((pick) => (
                    <div key={pick.id} onClick={() => handleAddCardToDeck(pick)}>
                      <DraggableCard pick={pick} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Deck Contents */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {selectedDeck.deck_name}
              </h3>
              <div className="flex gap-2">
                <div className="relative group">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    📥 Export
                  </button>
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button
                      onClick={handleExportToCockatrice}
                      className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg transition-colors"
                    >
                      Cockatrice (.cod)
                    </button>
                    <button
                      onClick={handleExportToArena}
                      className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg transition-colors"
                    >
                      MTG Arena (.txt)
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDeck(selectedDeck.id!)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              {[
                { id: "mainboard" as const, label: "Mainboard", count: mainboardCards.length },
                { id: "sideboard" as const, label: "Sideboard", count: sideboardCards.length },
                { id: "maybeboard" as const, label: "Maybeboard", count: maybeboardCards.length },
              ].map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`
                    px-4 py-2 font-medium transition-colors relative
                    ${
                      activeCategory === category.id
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }
                  `}
                >
                  {category.label} ({category.count})
                  {activeCategory === category.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Current Category Cards */}
            <DroppableZone
              id={`category-${activeCategory}`}
              className="space-y-2 max-h-[500px] overflow-y-auto min-h-[200px] p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
            >
              {getCardsByCategory(activeCategory).length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-500">
                  <p className="text-lg mb-2">No cards in {activeCategory}</p>
                  <p className="text-sm">Drag cards here or click to add them</p>
                </div>
              ) : (
                getCardsByCategory(activeCategory).map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                      {card.quantity}x
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {card.card_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCardFromDeck(card.id!, card.card_name)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </DroppableZone>

            {/* Deck Stats */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {mainboardCards.reduce((sum, card) => sum + (card.quantity || 1), 0)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Mainboard</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {sideboardCards.reduce((sum, card) => sum + (card.quantity || 1), 0)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Sideboard</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {maybeboardCards.reduce((sum, card) => sum + (card.quantity || 1), 0)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Maybeboard</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {(() => {
                      const cmcValues: number[] = [];
                      mainboardCards.forEach((card) => {
                        const pick = draftPicks.find((p) => p.card_id === card.card_id);
                        if (pick && pick.cmc !== null && pick.cmc !== undefined) {
                          for (let i = 0; i < (card.quantity || 1); i++) {
                            cmcValues.push(pick.cmc);
                          }
                        }
                      });
                      const avg = cmcValues.length > 0
                        ? cmcValues.reduce((sum, cmc) => sum + cmc, 0) / cmcValues.length
                        : 0;
                      return (Math.round(avg * 100) / 100).toFixed(2);
                    })()}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Avg CMC</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {(() => {
                      const colors = new Set<string>();
                      [...mainboardCards, ...sideboardCards].forEach((card) => {
                        const pick = draftPicks.find((p) => p.card_id === card.card_id);
                        if (pick && pick.colors && Array.isArray(pick.colors)) {
                          pick.colors.forEach((c: string) => colors.add(c));
                        }
                      });
                      return colors.size;
                    })()}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Colors</div>
                </div>
              </div>

              {/* Mini Mana Curve */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mana Curve (Mainboard)
                </div>
                <div className="flex items-end justify-center gap-1 h-16">
                  {(() => {
                    const cmcDist: { [cmc: string]: number } = {};
                    mainboardCards.forEach((card) => {
                      const pick = draftPicks.find((p) => p.card_id === card.card_id);
                      if (pick && pick.cmc !== null && pick.cmc !== undefined) {
                        const cmcKey = Math.min(pick.cmc, 7).toString();
                        cmcDist[cmcKey] = (cmcDist[cmcKey] || 0) + (card.quantity || 1);
                      }
                    });
                    const maxCount = Math.max(...Object.values(cmcDist), 1);

                    return Array.from({ length: 8 }, (_, i) => {
                      const cmc = i.toString();
                      const count = cmcDist[cmc] || 0;
                      const height = (count / maxCount) * 100;

                      return (
                        <div key={cmc} className="flex flex-col items-center gap-0.5 flex-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {count || ""}
                          </div>
                          <div
                            className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
                            style={{ height: `${Math.max(height, count > 0 ? 10 : 0)}%`, minHeight: count > 0 ? "4px" : "0" }}
                          />
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {i === 7 ? "7+" : i}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Deck Selected */}
      {!selectedDeck && decks.length > 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-500">
          <p className="text-lg mb-2">Select a deck to start building</p>
          <p className="text-sm">Choose from your decks above</p>
        </div>
      )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragPick ? (
          <div className="w-64 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-400 shadow-2xl opacity-90">
            <div className="flex items-center gap-2">
              {activeDragPick.image_url && (
                <img
                  src={activeDragPick.image_url}
                  alt={activeDragPick.card_name}
                  className="w-12 h-16 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {activeDragPick.card_name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {activeDragPick.card_type}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
