"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";
import Image from 'next/image';
import { toast } from "sonner";
import type { PurchaseableCard } from '@/app/actions/marketplaceActions';

interface ItemPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
  item: {
    id: string;
    title: string;
    description: string;
    cost?: number; // Is optional
    fetchAction?: () => Promise<{ cards: PurchaseableCard[] }>; // Is optional
    purchaseAction?: (cardId: string) => Promise<{ success: boolean; message?: string; error?: string }>; // Is optional
  };
}

export const ItemPurchaseModal: React.FC<ItemPurchaseModalProps> = ({ isOpen, onClose, onPurchaseComplete, item }) => {
  const [cards, setCards] = useState<PurchaseableCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<PurchaseableCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<PurchaseableCard | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && item.fetchAction) { // Safety check
      const loadData = async () => {
        setLoading(true);
        const { cards: fetchedCards } = await item.fetchAction!(); // Use non-null assertion
        setCards(fetchedCards);
        setFilteredCards(fetchedCards);
        setLoading(false);
      };
      loadData();
    } else {
      setCards([]);
      setFilteredCards([]);
      setSelectedCard(null);
      setSearchTerm("");
    }
  }, [isOpen, item]);

  useEffect(() => {
    const filtered = cards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredCards(filtered);
  }, [searchTerm, cards]);

  const handlePurchase = async () => {
    if (!selectedCard || !item.purchaseAction) return; // Safety check
    setProcessing(true);
    const res = await item.purchaseAction(selectedCard.id);
    if (res.success) {
      toast.success(res.message || "Purchase successful!");
      onPurchaseComplete();
      onClose();
    } else {
      toast.error(res.error || "An unexpected error occurred.");
    }
    setProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-muted/30">
          <div>
            <h3 className="text-xl font-bold">{item.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-6" /></button>
        </div>
        <div className="p-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search by name..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-2 overflow-y-auto flex-1">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin"/></div>
            : filteredCards.length > 0 ? <div className="space-y-2">
              {filteredCards.map(card => (
                <button key={card.id} onClick={() => setSelectedCard(card)} className={`w-full flex items-center gap-3 p-2 border-2 rounded-lg text-left transition-colors ${selectedCard?.id === card.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}>
                  {card.imageUrl && <Image src={card.imageUrl} alt={card.name} width={40} height={56} className="rounded" />}
                  <div>
                    <div className="font-semibold">{card.name}</div>
                    <div className="text-xs text-muted-foreground">{card.set}</div>
                  </div>
                </button>
              ))}
            </div>
            : <div className="text-center py-8 text-sm text-muted-foreground">No eligible cards found.</div>
          }
        </div>
        <div className="p-6 border-t bg-muted/30 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost</span>
            <span className="text-2xl font-bold text-emerald-500">{item.cost || 0} €</span>
          </div>
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" disabled={processing || !selectedCard} onClick={handlePurchase}>
            {processing ? <Loader2 className="size-5 animate-spin"/> : "Purchase"}
          </Button>
        </div>
      </div>
    </div>
  );
};
