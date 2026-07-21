// src/app/components/DeckBuilder.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import { ExternalLinkIcon } from 'lucide-react';
import Image from "next/image";
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
  updateDeckCardQuantity,
  removeCardFromDeck,
  updateDeckDetails,
} from "@/app/actions/draftActions";
import { addDeckToActivePoll } from "@/app/actions/deckVoteActions"; 
import type { DraftPick, Deck, DeckCard } from "@/app/actions/draftActions";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";
import { CardPreview } from "@/app/components/CardPreview";
import { TeamStats } from "@/app/components/TeamStats"; // <-- IMPORT TEAM STATS

interface DeckBuilderProps {
  teamId: string;
  teamName?: string;
  isUserTeamMember?: boolean;
}

// Draggable Card Component
function DraggableCard({ pick }: { pick: DraftPick }) {
  const { useOldestArt } = useSettings();
  const imageUrl = getCardImageUrl(pick, useOldestArt);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pick-${pick.id}`,
    data: { pick },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const scryfallUrl = `https://scryfall.com/search?as=grid&order=name&q=${encodeURIComponent('!"' + pick.card_name + '"')}`;

  return (
    <div className={`w-full text-left p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md transition-all group relative ${isDragging ? 'ring-2 ring-blue-400' : ''}`}>
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
            {imageUrl && (
                <CardPreview card={{ card_name: pick.card_name, image_url: pick.image_url, oldest_image_url: pick.oldest_image_url }}>
                    {/* The image itself now triggers the hover preview */}
                    <div className="w-12 h-16 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={pick.card_name} className="w-full h-full object-cover rounded" />
                    </div>
                </CardPreview>
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
        {/*  Add a separate, explicit link to Scryfall */}
        <Link href={scryfallUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-1 rounded-full bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <ExternalLinkIcon className="size-3 text-muted-foreground" />
        </Link>
    </div>
  );
}

function DroppableZone({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

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

const BASIC_LANDS = [
  { name: "Plains", color: "W", emoji: "⚪", image: "https://cards.scryfall.io/normal/front/5/4/54f67f45-eb8c-4c3e-8c7a-6e8b0c0e3f5a.jpg" },
  { name: "Island", color: "U", emoji: "🔵", image: "https://cards.scryfall.io/normal/front/f/f/ff7a16c5-8b10-4989-b2f9-ba84fe8e51d6.jpg" },
  { name: "Swamp", color: "B", emoji: "⚫", image: "https://cards.scryfall.io/normal/front/a/3/a3c6bc4f-0ca0-40e9-9bf3-e8ceb1df78fa.jpg" },
  { name: "Mountain", color: "R", emoji: "🔴", image: "https://cards.scryfall.io/normal/front/6/1/61af6645-86e9-4b4b-8c16-8c9c70a9b7b4.jpg" },
  { name: "Forest", color: "G", emoji: "🟢", image: "https://cards.scryfall.io/normal/front/b/9/b9c3c8d4-3a51-4c8e-971e-b2e2f3d8b6e0.jpg" },
];

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ teamId, teamName = "This team", isUserTeamMember = true }) => {
  const { useOldestArt } = useSettings();
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("standard");
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editDeckName, setEditDeckName] = useState("");
  const [editDeckDescription, setEditDeckDescription] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"mainboard" | "sideboard" | "maybeboard">("mainboard");
  const [activeDragPick, setActiveDragPick] = useState<DraftPick | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
  }, [selectedDeck]);

    const loadData = async () => {
    setLoading(true);
    try {
      const { picks } = await getTeamDraftPicks(teamId);
      
      //  Filter out skipped picks so they don't pollute the draggable card pool
      setDraftPicks(picks.filter(p => p.pick_source !== 'skipped'));
      
      const { decks: teamDecks } = await getTeamDecks(teamId);
      
      if (teamDecks.length > 0 && !selectedDeck) setSelectedDeck(teamDecks[0]);
      if (!isUserTeamMember && teamDecks.length > 0) setSelectedDeck(teamDecks[0]);
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
    if (!newDeckName.trim()) { setError("Deck name is required"); return; }
    const result = await createDeck({
      team_id: teamId, deck_name: newDeckName, description: newDeckDescription, format: newDeckFormat, is_public: false,
    });
    if (result.success) {
      setSuccess("Deck created successfully!");
      setShowNewDeckModal(false); setNewDeckName(""); setNewDeckDescription(""); setNewDeckFormat("standard");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to create deck");
    }
  };

  const handleEditDeck = async () => {
    if (!editDeckName.trim()) return setError("Deck name is required");
    const result = await updateDeckDetails(selectedDeck!.id!, { deck_name: editDeckName, description: editDeckDescription });
    if (result.success) {
      setSuccess("Deck updated successfully!");
      setShowEditDeckModal(false);
      setSelectedDeck(prev => prev ? { ...prev, deck_name: editDeckName, description: editDeckDescription } : null);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to update deck");
    }
  };

  const handleAddDeckToVote = async () => {
    if (!selectedDeck) return;
    setVoteLoading(true);
    const result = await addDeckToActivePoll(teamId, selectedDeck.id!);
    if (result.success) setSuccess(result.message || "Deck added to the current vote!");
    else setError(result.error || "Failed to add deck to vote.");
    setTimeout(() => { setSuccess(null); setError(null); }, 4000);
    setVoteLoading(false);
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm("Are you sure you want to delete this deck?")) return;
    const result = await deleteDeck(deckId);
    if (result.success) {
      setSuccess("Deck deleted successfully!");
      setSelectedDeck(null); await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to delete deck");
    }
  };

  const handleAddCardToDeck = async (pick: DraftPick) => {
    if (!selectedDeck) { setError("Please select a deck first"); return; }
    if (deckCards.some((dc) => dc.draft_pick_id === pick.id)) {
      setError("Card is already in this section");
      setTimeout(() => setError(null), 3000); return;
    }
    const result = await addCardToDeck({
      deck_id: selectedDeck.id!, draft_pick_id: pick.id, card_id: pick.card_id, card_name: pick.card_name, quantity: 1, category: activeCategory,
    });
    if (result.success) {
      setSuccess(`Added ${pick.card_name} to ${activeCategory}!`);
      await loadDeckCards(selectedDeck.id!);
      setTimeout(() => setSuccess(null), 2000);
    } else setError(result.error || "Failed to add card");
  };

  const handleRemoveCardFromDeck = async (cardId: string, cardName: string) => {
    const result = await removeCardFromDeck(cardId);
    if (result.success) {
      setSuccess(`Removed ${cardName} from deck!`);
      if (selectedDeck) await loadDeckCards(selectedDeck.id!);
      setTimeout(() => setSuccess(null), 2000);
    } else setError(result.error || "Failed to remove card");
  };

  const handleAddBasicLand = async (landName: string) => {
    if (!selectedDeck?.id) return setError("Please select a deck first");
    const existingLand = deckCards.find(
      (dc) => dc.card_name.toLowerCase() === landName.toLowerCase() && dc.category === activeCategory
    );
    if (existingLand && existingLand.id && !existingLand.id.startsWith('temp-')) {
      const newQuantity = (existingLand.quantity || 1) + 1;
      setDeckCards(prev => prev.map(dc => dc.id === existingLand.id ? { ...dc, quantity: newQuantity } : dc));
      const result = await updateDeckCardQuantity(existingLand.id!, newQuantity);
      if (!result.success) { setError(result.error || "Failed to update basic land"); await loadDeckCards(selectedDeck.id!); }
    } else if (!existingLand) {
      const tempId = 'temp-' + Date.now();
      setDeckCards(prev => [...prev, { id: tempId, card_name: landName, category: activeCategory, quantity: 1, deck_id: selectedDeck.id!, card_id: `basic-${landName.toLowerCase()}` }]);
      const result = await addCardToDeck({
        deck_id: selectedDeck.id, draft_pick_id: undefined, card_id: `basic-${landName.toLowerCase()}`, card_name: landName, quantity: 1, category: activeCategory,
      });
      if (result.success) await loadDeckCards(selectedDeck.id);
      else { setError(result.error || "Failed to add basic land"); setDeckCards(prev => prev.filter(dc => dc.id !== tempId)); }
    }
  };

  const handleUpdateBasicLandQuantity = async (landName: string, newQuantity: number) => {
    if (!selectedDeck?.id) return;
    const existingLand = deckCards.find(
      (dc) => dc.card_name.toLowerCase() === landName.toLowerCase() && dc.category === activeCategory
    );
    if (!existingLand || !existingLand.id || existingLand.id.startsWith('temp-')) return;
    if (newQuantity <= 0) {
      setDeckCards(prev => prev.filter(dc => dc.id !== existingLand.id));
      await handleRemoveCardFromDeck(existingLand.id!, landName);
    } else {
      setDeckCards(prev => prev.map(dc => dc.id === existingLand.id ? { ...dc, quantity: newQuantity } : dc));
      const result = await updateDeckCardQuantity(existingLand.id!, newQuantity);
      if (!result.success) await loadDeckCards(selectedDeck.id!);
    }
  };

  const handleExportToCockatrice = () => {
    if (!selectedDeck) { setError("No deck selected"); return; }
    const mainboard = getCardsByCategory("mainboard");
    const sideboard = getCardsByCategory("sideboard");
    let deckText = `// Deck: ${selectedDeck.deck_name}\n// Format: ${selectedDeck.format || 'Unknown'}\n`;
    if (selectedDeck.description) deckText += `// Description: ${selectedDeck.description}\n`;
    deckText += `// Exported from Dynasty Cube\n\n`;
    if (mainboard.length > 0) {
      deckText += `// Mainboard (${mainboard.reduce((sum, card) => sum + (card.quantity || 1), 0)} cards)\n`;
      mainboard.forEach((card) => { deckText += `${card.quantity || 1} ${card.card_name}\n`; });
      deckText += `\n`;
    }
    if (sideboard.length > 0) {
      deckText += `// Sideboard (${sideboard.reduce((sum, card) => sum + (card.quantity || 1), 0)} cards)\n`;
      sideboard.forEach((card) => { deckText += `SB: ${card.quantity || 1} ${card.card_name}\n`; });
    }
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

  const handleExportToArena = () => {
    if (!selectedDeck) { setError("No deck selected"); return; }
    const mainboard = getCardsByCategory("mainboard");
    const sideboard = getCardsByCategory("sideboard");
    let deckText = `Deck\n`;
    mainboard.forEach((card) => { deckText += `${card.quantity || 1} ${card.card_name}\n`; });
    if (sideboard.length > 0) {
      deckText += `\nSideboard\n`;
      sideboard.forEach((card) => { deckText += `${card.quantity || 1} ${card.card_name}\n`; });
    }
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const pick = active.data.current?.pick as DraftPick;
    setActiveDragPick(pick);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragPick(null);
    if (!over || !selectedDeck) return;
    if (over.id.toString().startsWith('category-')) {
      const category = over.id.toString().replace('category-', '') as "mainboard" | "sideboard" | "maybeboard";
      const pick = active.data.current?.pick as DraftPick;
      if (!pick) return;
      if (deckCards.some((dc) => dc.draft_pick_id === pick.id)) {
        setError(`${pick.card_name} is already in ${category}`);
        setTimeout(() => setError(null), 3000); return;
      }
      const result = await addCardToDeck({
        deck_id: selectedDeck.id!, draft_pick_id: pick.id, card_id: pick.card_id, card_name: pick.card_name, quantity: 1, category: category,
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
    const filtered = deckCards.filter((card) => card.category === category);
    if (category === "mainboard") {
       return filtered.sort((a, b) => {
           const isBasicA = a.card_id?.startsWith('basic-');
           const isBasicB = b.card_id?.startsWith('basic-');
           const cmcA = isBasicA ? 99 : (draftPicks.find(p => p.card_id === a.card_id)?.cmc ?? 99);
           const cmcB = isBasicB ? 99 : (draftPicks.find(p => p.card_id === b.card_id)?.cmc ?? 99);
           if (cmcA !== cmcB) return cmcA - cmcB;
           return a.card_name.localeCompare(b.card_name);
       });
    }
    return filtered;
  };

  const mainboardCards = getCardsByCategory("mainboard");
  const sideboardCards = getCardsByCategory("sideboard");
  const maybeboardCards = getCardsByCategory("maybeboard");

  const availablePicks = draftPicks.filter((pick) => !deckCards.some((dc) => dc.draft_pick_id === pick.id));
  const activeDragPickImageUrl = activeDragPick ? getCardImageUrl(activeDragPick, useOldestArt) : null;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading deck builder...</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {success && (<div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">✓ {success}</div>)}
        {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">✗ {error}</div>)}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{isUserTeamMember ? "Your Decks" : `${teamName}'s Decks`}</h3>
          {isUserTeamMember && (<button onClick={() => setShowNewDeckModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">+ New Deck</button>)}
        </div>
        {decks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No decks yet</p>
            <p className="text-sm">{isUserTeamMember ? "Create your first deck to get started" : `${teamName} hasn't created any decks yet`}</p>
          </div>
        ) : isUserTeamMember ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <button key={deck.id} onClick={() => setSelectedDeck(deck)} className={`text-left p-4 rounded-lg border-2 transition-all ${selectedDeck?.id === deck.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"}`}>
                <div className="flex items-start justify-between gap-2 mb-1"><h4 className="font-semibold text-gray-900 dark:text-gray-100">{deck.deck_name}</h4></div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{deck.format}</p>
                {deck.created_by_name && (<p className="text-xs text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1"><span>👤</span> Created by {deck.created_by_name}</p>)}
                {deck.description && (<p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">{deck.description}</p>)}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            {decks.length > 0 && (
              <div className="inline-block text-left p-4 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/30">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{decks[0].deck_name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{decks[0].format}</p>
                {decks[0].created_by_name && (<p className="text-xs text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1"><span>👤</span> Created by {decks[0].created_by_name}</p>)}
                {decks[0].description && (<p className="text-xs text-gray-500 dark:text-gray-500">{decks[0].description}</p>)}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Showing the most recent deck. Join the team to see all decks.</p>
          </div>
        )}
      </div>

      {showNewDeckModal && isUserTeamMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create New Deck</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deck Name *</label>
                <input type="text" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="My Awesome Deck" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={newDeckDescription} onChange={(e) => setNewDeckDescription(e.target.value)} placeholder="Describe the deck strategy..." rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
                <select value={newDeckFormat} onChange={(e) => setNewDeckFormat(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                  <option value="standard">Standard</option><option value="modern">Modern</option><option value="commander">Commander</option><option value="legacy">Legacy</option><option value="vintage">Vintage</option><option value="pauper">Pauper</option><option value="draft">Draft</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={handleCreateDeck} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Create Deck</button>
                <button onClick={() => { setShowNewDeckModal(false); setNewDeckName(""); setNewDeckDescription(""); setNewDeckFormat("standard"); }} className="flex-1 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditDeckModal && isUserTeamMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Edit Deck Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deck Name *</label>
                <input type="text" value={editDeckName} onChange={(e) => setEditDeckName(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={editDeckDescription} onChange={(e) => setEditDeckDescription(e.target.value)} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={handleEditDeck} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Save Changes</button>
                <button onClick={() => setShowEditDeckModal(false)} className="flex-1 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
        
      {selectedDeck && isUserTeamMember && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><span>🏔️</span> Basic Lands</h3>
                <span className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 px-2 py-1 rounded">Unlimited</span>
              </div>
              <div className="space-y-2">
                {BASIC_LANDS.map((land) => {
                  const landInDeck = deckCards.find((dc) => dc.card_name === land.name && dc.category === activeCategory);
                  const quantity = landInDeck?.quantity || 0;
                  return (
                    <div key={land.name} className="flex items-center justify-between bg-white/80 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{land.emoji}</span>
                        <div><p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{land.name}</p><p className="text-xs text-gray-600 dark:text-gray-400">{quantity} in {activeCategory}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {quantity > 0 && (
                          <><button onClick={() => handleUpdateBasicLandQuantity(land.name, quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded font-bold transition-colors">−</button><span className="w-8 text-center font-bold text-gray-900 dark:text-gray-100">{quantity}</span></>
                        )}
                        <button onClick={() => handleAddBasicLand(land.name)} className="w-7 h-7 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Drafted Cards</h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">{availablePicks.length} cards</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availablePicks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-8">All drafted cards are in the deck</p>
                ) : (
                  availablePicks.map((pick) => (
                    <CardPreview key={pick.id} card={{ card_name: pick.card_name, image_url: pick.image_url, oldest_image_url: pick.oldest_image_url }}>
                        <div onClick={() => handleAddCardToDeck(pick)}><DraggableCard pick={pick} /></div>
                    </CardPreview>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
           <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedDeck.deck_name}</h3>
                {selectedDeck.created_by_name && (<p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"><span>👤</span> Created by {selectedDeck.created_by_name}</p>)}
              </div>
              
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={handleAddDeckToVote} disabled={voteLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:bg-purple-400">{voteLoading ? "Adding..." : "➕ Add to Vote"}</button>
                <div className="relative group">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">📥 Export</button>
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button onClick={handleExportToCockatrice} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 rounded-t-lg">Cockatrice (.cod)</button>
                    <button onClick={handleExportToArena} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 rounded-b-lg">MTG Arena (.txt)</button>
                  </div>
                </div>
                <button onClick={() => { setEditDeckName(selectedDeck.deck_name); setEditDeckDescription(selectedDeck.description || ""); setShowEditDeckModal(true); }} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm font-medium px-2 border-l border-gray-300 dark:border-gray-600 pl-4">✏️ Edit</button>
                <button onClick={() => handleDeleteDeck(selectedDeck.id!)} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium">🗑️ Delete</button>
              </div>
            </div>

            <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              {[
                { id: "mainboard" as const, label: "Mainboard", count: mainboardCards.reduce((acc, c) => acc + (c.quantity || 1), 0) },
                { id: "sideboard" as const, label: "Sideboard", count: sideboardCards.reduce((acc, c) => acc + (c.quantity || 1), 0) },
                { id: "maybeboard" as const, label: "Maybeboard", count: maybeboardCards.reduce((acc, c) => acc + (c.quantity || 1), 0) },
              ].map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-4 py-2 font-medium transition-colors relative ${activeCategory === category.id ? "text-blue-600 dark:text-blue-400" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {category.label} ({category.count})
                  {activeCategory === category.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
                </button>
              ))}
            </div>

            <DroppableZone id={`category-${activeCategory}`} className="space-y-2 max-h-[500px] overflow-y-auto min-h-[200px] p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              {getCardsByCategory(activeCategory).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">No cards in {activeCategory}</p>
                  <p className="text-sm">Drag cards here or click to add them</p>
                </div>
              ) : (
                getCardsByCategory(activeCategory).map((card) => {
                  const fullPickData = draftPicks.find(p => p.card_id === card.card_id) || {
                      card_name: card.card_name, image_url: null, oldest_image_url: null
                  };
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                      <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">{card.quantity}x</span>
                      <div className="flex-1">
                        <CardPreview card={fullPickData}>
                          <p className="font-semibold hover:text-blue-500 transition-colors cursor-pointer">{card.card_name}</p>
                        </CardPreview>
                      </div>
                      <button onClick={() => handleRemoveCardFromDeck(card.id!, card.card_name)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
                    </div>
                  );
                })
              )}
            </DroppableZone>
            
            {/* Embedded TeamStats restricted to just this Deck Builder! */}
            <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
               <TeamStats teamId={teamId} />
            </div>

          </div>
        </div>
      )}

      {selectedDeck && !isUserTeamMember && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedDeck.deck_name}</h3>
              {selectedDeck.created_by_name && (<p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"><span>👤</span> Created by {selectedDeck.created_by_name}</p>)}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{deckCards.length} cards</span>
          </div>

          {selectedDeck.description && (<p className="text-gray-600 dark:text-gray-400 mb-4">{selectedDeck.description}</p>)}

         <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            {[
              { id: "mainboard" as const, label: "Mainboard", count: deckCards.filter(c => c.category === "mainboard").reduce((acc, c) => acc + (c.quantity || 1), 0) },
              { id: "sideboard" as const, label: "Sideboard", count: deckCards.filter(c => c.category === "sideboard").reduce((acc, c) => acc + (c.quantity || 1), 0) },
              { id: "maybeboard" as const, label: "Maybeboard", count: deckCards.filter(c => c.category === "maybeboard").reduce((acc, c) => acc + (c.quantity || 1), 0) },
            ].map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 font-medium transition-colors relative ${activeCategory === category.id ? "text-blue-600 dark:text-blue-400" : "text-gray-600 hover:text-gray-900"}`}
              >
                {category.label} ({category.count})
                {activeCategory === category.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {getCardsByCategory(activeCategory).map((card) => {
              const fullPickData = draftPicks.find(p => p.card_id === card.card_id) || {
                  card_name: card.card_name, image_url: null, oldest_image_url: null
              };
              return (
                <div key={card.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                  <CardPreview card={fullPickData}>
                    <p className="font-semibold text-sm truncate hover:text-blue-500 transition-colors cursor-pointer">{card.card_name}</p>
                  </CardPreview>
                  {(card.quantity || 1) > 1 && <p className="text-xs text-gray-500">x{card.quantity}</p>}
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
            <p className="text-sm text-gray-500 text-center">This is a read-only view. Join {teamName} to edit decks.</p>
          </div>
          
          <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
               <TeamStats teamId={teamId} />
          </div>
        </div>
      )}

      {!selectedDeck && decks.length > 0 && isUserTeamMember && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-500">
          <p className="text-lg mb-2">Select a deck to start building</p>
          <p className="text-sm">Choose from the decks above</p>
        </div>
      )}
      </div>

      <DragOverlay>
        {activeDragPick && activeDragPickImageUrl ? (
          <div className="w-64 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-400 shadow-2xl opacity-90">
            <div className="flex items-center gap-2">
              <Image src={activeDragPickImageUrl} alt={activeDragPick.card_name} width={48} height={64} className="object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{activeDragPick.card_name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{activeDragPick.card_type}</p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
