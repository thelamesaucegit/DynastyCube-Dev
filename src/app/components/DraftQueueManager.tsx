// src/app/components/DraftQueueManager.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  getTeamDraftQueue,
  setTeamDraftQueue,
  pinCardToQueue,
  removeFromQueue,
  clearTeamDraftQueue,
  getAutoDraftPreview,
  type QueueEntry,
} from "@/app/actions/autoDraftActions";
import { getAvailableCardsForDraft, type CardData } from "@/app/actions/cardActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  GripVertical,
  Pin,
  PinOff,
  X,
  Plus,
  Trash2,
  Search,
  Zap,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { AutoDraftPreview } from "@/app/components/AutoDraftPreview";

const COLOR_LABELS: Record<string, { label: string; emoji: string; className: string }> = {
  W: { label: "White", emoji: "⚪", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" },
  U: { label: "Blue", emoji: "🔵", className: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200" },
  B: { label: "Black", emoji: "⚫", className: "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-200" },
  R: { label: "Red", emoji: "🔴", className: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200" },
  G: { label: "Green", emoji: "🟢", className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200" },
};

interface DraftQueueManagerProps {
  teamId: string;
  isUserTeamMember?: boolean;
}

// ============================================================================
// Sortable Queue Item
// ============================================================================

function SortableQueueItem({
  entry,
  onPin,
  onRemove,
  isManual,
}: {
  entry: QueueEntry;
  onPin: (entry: QueueEntry) => void;
  onRemove: (entry: QueueEntry) => void;
  isManual: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.cardId });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isManual
          ? "bg-card border-purple-500/20"
          : "bg-muted/50 border-border/50"
      } ${isDragging ? "shadow-lg ring-2 ring-purple-500/30" : ""}`}
    >
      {/* Drag Handle */}
      <button
        className="touch-none p-1 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Position Number */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        entry.position <= 3
          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
          : "bg-muted text-muted-foreground"
      }`}>
        {entry.position}
      </div>

      {/* Card Thumbnail */}
      {entry.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={entry.imageUrl}
          alt={entry.cardName}
          className="w-10 h-14 object-cover rounded flex-shrink-0"
        />
      )}

      {/* Card Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{entry.cardName}</span>
          {entry.pinned && (
            <Pin className="size-3 text-purple-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Colors */}
          <div className="flex gap-0.5">
            {entry.colors && entry.colors.length > 0 ? (
              entry.colors.map((color) => {
                const info = COLOR_LABELS[color];
                return info ? (
                  <span key={color} className="text-xs">{info.emoji}</span>
                ) : null;
              })
            ) : (
              <span className="text-xs text-muted-foreground">◇</span>
            )}
          </div>
          {/* ELO */}
          {entry.cubecobraElo != null && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              ELO {entry.cubecobraElo.toLocaleString()}
            </span>
          )}
          {/* Cost */}
          {entry.cubucksCost != null && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              💰 {entry.cubucksCost || 1}
            </span>
          )}
          {/* Source indicator */}
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {isManual ? "📌 Manual" : "🧠 Auto"}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPin(entry)}
          title={entry.pinned ? "Unpin" : "Pin to queue"}
        >
          {entry.pinned ? (
            <PinOff className="size-3.5" />
          ) : (
            <Pin className="size-3.5" />
          )}
        </Button>
        {isManual && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onRemove(entry)}
            title="Remove from queue"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Drag Overlay Item
// ============================================================================

function DragOverlayItem({ entry }: { entry: QueueEntry }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-xl ring-2 ring-purple-500/30">
      <GripVertical className="size-4 text-muted-foreground" />
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 flex-shrink-0">
        {entry.position}
      </div>
      {entry.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={entry.imageUrl}
          alt={entry.cardName}
          className="w-10 h-14 object-cover rounded flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate">{entry.cardName}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Add to Queue Dialog
// ============================================================================

function AddToQueueDialog({
  teamId,
  existingCardIds,
  onAdd,
}: {
  teamId: string;
  existingCardIds: Set<string>;
  onAdd: (card: CardData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("all");

  const loadCards = async () => {
    setLoading(true);
    try {
      const { cards: available } = await getAvailableCardsForDraft();
      setCards(available.filter((c) => !existingCardIds.has(c.card_id)));
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredCards = cards.filter((card) => {
    if (search && !card.card_name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (colorFilter !== "all") {
      if (colorFilter === "colorless") {
        if (card.colors && card.colors.length > 0) return false;
      } else {
        if (!card.colors?.includes(colorFilter)) return false;
      }
    }
    return true;
  });

  // Sort by ELO descending
  const sortedCards = [...filteredCards].sort(
    (a, b) => (b.cubecobra_elo || 0) - (a.cubecobra_elo || 0)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5 mr-1" />
          Add to Queue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Card to Draft Queue</DialogTitle>
          <DialogDescription>
            Search for cards to add to your manual priority queue. Cards at the top of your queue will be auto-drafted first.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by card name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "all", label: "All", emoji: "🌈" },
              { value: "W", label: "White", emoji: "⚪" },
              { value: "U", label: "Blue", emoji: "🔵" },
              { value: "B", label: "Black", emoji: "⚫" },
              { value: "R", label: "Red", emoji: "🔴" },
              { value: "G", label: "Green", emoji: "🟢" },
              { value: "colorless", label: "Colorless", emoji: "◇" },
            ].map((color) => (
              <Button
                key={color.value}
                variant={colorFilter === color.value ? "default" : "outline"}
                size="sm"
                onClick={() => setColorFilter(color.value)}
                className="text-xs"
              >
                {color.emoji} {color.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {sortedCards.length} cards available
          </p>
        </div>

        {/* Card List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No cards found</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {sortedCards.slice(0, 50).map((card) => (
                <button
                  key={card.card_id}
                  onClick={() => {
                    onAdd(card);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg border border-border hover:border-purple-500/40 hover:bg-accent transition-colors text-left"
                >
                  {card.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.image_url}
                      alt={card.card_name}
                      className="w-8 h-11 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{card.card_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex gap-0.5">
                        {card.colors && card.colors.length > 0 ? (
                          card.colors.map((c) => (
                            <span key={c}>{COLOR_LABELS[c]?.emoji}</span>
                          ))
                        ) : (
                          <span>◇</span>
                        )}
                      </span>
                      {card.cubecobra_elo != null && (
                        <span className="text-purple-600 dark:text-purple-400">
                          ELO {card.cubecobra_elo.toLocaleString()}
                        </span>
                      )}
                      <span className="text-yellow-600 dark:text-yellow-400">
                        💰 {card.cubucks_cost || 1}
                      </span>
                    </div>
                  </div>
                  <Plus className="size-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {sortedCards.length > 50 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Showing 50 of {sortedCards.length} cards. Use search to narrow results.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main DraftQueueManager
// ============================================================================

export function DraftQueueManager({ teamId, isUserTeamMember = true }: DraftQueueManagerProps) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { queue: queueData, error } = await getTeamDraftQueue(teamId, 20);
      if (error) {
        console.error("Error loading queue:", error);
      }
      setQueue(queueData);
    } catch (error) {
      console.error("Error loading queue:", error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((e) => e.cardId === active.id);
    const newIndex = queue.findIndex((e) => e.cardId === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update the UI
    const newQueue = arrayMove(queue, oldIndex, newIndex).map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
    setQueue(newQueue);

    // Save the manual entries to the database
    await saveManualQueue(newQueue);
  };

  const saveManualQueue = async (queueToSave: QueueEntry[]) => {
    setSaving(true);
    try {
      // Only save cards that are marked as manual (or that have been reordered by user)
      // When the user drags, all items become "manual" overrides
      const manualEntries = queueToSave
        .filter((entry) => entry.source === "manual" || entry.pinned)
        .map((entry) => ({
          cardPoolId: entry.cardPoolId,
          cardId: entry.cardId,
          cardName: entry.cardName,
          position: entry.position,
          pinned: entry.pinned,
        }));

      await setTeamDraftQueue(teamId, manualEntries);
      setPreviewRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error saving queue:", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePin = async (entry: QueueEntry) => {
    if (!entry.cardPoolId) return;

    if (entry.pinned) {
      // Unpin: remove from manual queue
      await removeFromQueue(teamId, entry.cardPoolId);
    } else {
      // Pin: add to manual queue at current position
      await pinCardToQueue(teamId, entry.cardPoolId, entry.cardId, entry.cardName, entry.position);
    }

    await loadQueue();
    setPreviewRefreshKey((prev) => prev + 1);
  };

  const handleRemove = async (entry: QueueEntry) => {
    if (!entry.cardPoolId) return;

    await removeFromQueue(teamId, entry.cardPoolId);
    await loadQueue();
    setPreviewRefreshKey((prev) => prev + 1);
  };

  const handleAddToQueue = async (card: CardData) => {
    if (!card.id) return;

    // Add to the top of the queue (position 1)
    await pinCardToQueue(teamId, card.id, card.card_id, card.card_name, 1);
    await loadQueue();
    setPreviewRefreshKey((prev) => prev + 1);
  };

  const handleClearQueue = async () => {
    const confirmed = window.confirm(
      "Clear your entire manual draft queue? This will revert to the algorithm-computed order."
    );
    if (!confirmed) return;

    await clearTeamDraftQueue(teamId);
    await loadQueue();
    setPreviewRefreshKey((prev) => prev + 1);
  };

  const handleRefresh = async () => {
    await loadQueue();
    setPreviewRefreshKey((prev) => prev + 1);
  };

  const activeEntry = activeId ? queue.find((e) => e.cardId === activeId) : null;
  const manualCount = queue.filter((e) => e.source === "manual").length;
  const existingCardIds = new Set(queue.map((e) => e.cardId));

  return (
    <div className="space-y-4">
      {/* Auto-Draft Preview */}
      <AutoDraftPreview
        teamId={teamId}
        compact={false}
        onManageQueue={() => setExpanded(!expanded)}
        refreshKey={previewRefreshKey}
      />

      {/* Queue Manager (collapsible) */}
      <Card className="border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-purple-500" />
            <h3 className="font-semibold">Draft Priority Queue</h3>
            {manualCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {manualCount} manual override{manualCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <CardContent className="pt-0 pb-4">
            {/* Queue Actions */}
            {isUserTeamMember && (
              <div className="flex flex-wrap gap-2 mb-4">
                <AddToQueueDialog
                  teamId={teamId}
                  existingCardIds={existingCardIds}
                  onAdd={handleAddToQueue}
                />
                {manualCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearQueue}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Clear Queue
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}

            {/* Queue List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : queue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No cards in queue</p>
                <p className="text-xs mt-1">The algorithm will compute picks on the fly</p>
              </div>
            ) : isUserTeamMember ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={queue.map((e) => e.cardId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {queue.map((entry) => (
                      <SortableQueueItem
                        key={entry.cardId}
                        entry={entry}
                        onPin={handlePin}
                        onRemove={handleRemove}
                        isManual={entry.source === "manual"}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeEntry ? <DragOverlayItem entry={activeEntry} /> : null}
                </DragOverlay>
              </DndContext>
            ) : (
              // Read-only view for non-members
              <div className="space-y-2">
                {queue.map((entry) => (
                  <div
                    key={entry.cardId}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      entry.source === "manual"
                        ? "bg-card border-purple-500/20"
                        : "bg-muted/50 border-border/50"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      entry.position <= 3
                        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {entry.position}
                    </div>
                    {entry.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={entry.imageUrl}
                        alt={entry.cardName}
                        className="w-10 h-14 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{entry.cardName}</span>
                        {entry.pinned && <Pin className="size-3 text-purple-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <div className="flex gap-0.5">
                          {entry.colors && entry.colors.length > 0 ? (
                            entry.colors.map((color) => {
                              const info = COLOR_LABELS[color];
                              return info ? <span key={color} className="text-xs">{info.emoji}</span> : null;
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">◇</span>
                          )}
                        </div>
                        {entry.cubecobraElo != null && (
                          <span className="text-xs text-purple-600 dark:text-purple-400">
                            ELO {entry.cubecobraElo.toLocaleString()}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {entry.source === "manual" ? "📌 Manual" : "🧠 Auto"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-purple-500/20 bg-card" /> Manual override
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-border/50 bg-muted/50" /> Algorithm computed
              </span>
              {isUserTeamMember && (
                <span className="flex items-center gap-1">
                  <GripVertical className="size-3" /> Drag to reorder
                </span>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
