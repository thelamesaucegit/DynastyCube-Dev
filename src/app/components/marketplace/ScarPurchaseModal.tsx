// /src/app/components/marketplace/ScarPurchaseModal.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Search, Skull, X, Loader2, Wand2, Shuffle } from "lucide-react";
import { getScarsForPurchase, searchCardsForManipulation, purchaseScar, type ScarData } from "@/app/actions/marketplaceActions";
import { toast } from "sonner";
import Image from 'next/image';

interface ManipulationCard {
  id: string;
  card_name: string;
  image_url: string | null;
}

interface ScarPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
}

export const ScarPurchaseModal: React.FC<ScarPurchaseModalProps> = ({ isOpen, onClose, onPurchaseComplete }) => {
  const [mode, setMode] = useState<'card' | 'scar'>('card');
  const [availableScars, setAvailableScars] = useState<ScarData[]>([]);
  
  const [cardSearch, setCardSearch] = useState("");
  const [cardResults, setCardResults] = useState<ManipulationCard[]>([]);
  const [isCardSearching, setIsCardSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ManipulationCard | null>(null);

  const [selectedScar, setSelectedScar] = useState<ScarData | null>(null);
  
  const [cost, setCost] = useState(50);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchScars = async () => {
      const { scars } = await getScarsForPurchase();
      setAvailableScars(scars);
    };
    fetchScars();
  }, []);

  useEffect(() => {
    // Debounce search input
    const handler = setTimeout(async () => {
      if (mode === 'card' && cardSearch.length >= 3) {
        setIsCardSearching(true);
        const res = await searchCardsForManipulation(cardSearch);
        if (res.success && res.cards) {
          setCardResults(res.cards as ManipulationCard[]);
        }
        setIsCardSearching(false);
      } else {
        setCardResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [cardSearch, mode]);

  useEffect(() => {
    // Reset selections when mode changes
    setSelectedCard(null);
    setSelectedScar(null);
    setCardSearch("");
    setCardResults([]);
    calculateCost();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    calculateCost();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScar, mode]);

  const calculateCost = () => {
    const baseCost = 500;
    let premium = 0;
    if (mode === 'scar' && selectedScar) {
      if (selectedScar.rarity === 'uncommon') premium = 250;
      if (selectedScar.rarity === 'rare') premium = 500;
    }
    setCost(baseCost + premium);
  };

  const handleSelectScar = (scarId: string) => {
    const scar = availableScars.find(s => s.id === scarId);
    setSelectedScar(scar || null);
  };
  
  const handlePurchase = async () => {
    const options = {
        targetCardId: selectedCard?.id,
        targetScarId: selectedScar?.id
    };

    if (!options.targetCardId && !options.targetScarId) {
        toast.error("A selection is required.");
        return;
    }

    setProcessing(true);
    const res = await purchaseScar(options);

    if (res.success) {
        toast.success(res.message);
        onPurchaseComplete();
        onClose();
    } else {
        toast.error(res.error);
    }
    setProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-muted/30">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Skull className="size-5" /> Afflict with a Scar
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Imbue a card with a permanent, reality-altering property.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-6" /></button>
        </div>

        <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-lg">
                <button onClick={() => setMode('card')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}>
                    Target a Card
                </button>
                <button onClick={() => setMode('scar')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'scar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}>
                    Choose a Scar
                </button>
            </div>

            {mode === 'card' && (
                <div>
                    <p className="text-sm text-center text-muted-foreground mb-4">Select a card to receive a random, weighted scar.</p>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input placeholder="Search for a card..." className="pl-9" value={cardSearch} onChange={e => setCardSearch(e.target.value)} />
                    </div>
                </div>
            )}

            {mode === 'scar' && (
                <div>
                    <p className="text-sm text-center text-muted-foreground mb-4">Select a scar to apply to a random, eligible card.</p>
                    <Select onValueChange={handleSelectScar}>
                        <SelectTrigger><SelectValue placeholder="Select a scar..." /></SelectTrigger>
                        <SelectContent>
                        {availableScars.map(scar => (
                            <SelectItem key={scar.id} value={scar.id}>
                                <div className='flex justify-between w-full'>
                                    <span>{scar.name}</span>
                                    <Badge variant={scar.rarity === 'rare' ? 'destructive' : scar.rarity === 'uncommon' ? 'secondary' : 'outline'}>
                                        {scar.rarity}
                                    </Badge>
                                </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>

        <div className="p-6 pt-0 overflow-y-auto flex-1">
            {mode === 'card' && (
                isCardSearching ? <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin"/></div>
                : cardResults.length > 0 ? <div className="space-y-2">
                    {cardResults.map(card => (
                        <button key={card.id} onClick={() => setSelectedCard(card)} className={`w-full flex items-center gap-3 p-2 border-2 rounded-lg text-left transition-colors ${selectedCard?.id === card.id ? 'border-red-500 bg-red-500/10' : 'border-transparent hover:bg-muted'}`}>
                            {card.image_url && <Image src={card.image_url} alt={card.card_name} width={40} height={56} className="rounded" />}
                            <span className="font-semibold">{card.card_name}</span>
                        </button>
                    ))}
                </div>
                : cardSearch.length >= 3 ? <div className="text-center py-8 text-sm text-muted-foreground">No eligible cards found.</div>
                : <div className="text-center py-8 text-sm text-muted-foreground opacity-60">
                    <Wand2 className="mx-auto size-8 mb-2" />
                    <p>Search for a card to begin.</p>
                  </div>
            )}
             {mode === 'scar' && (
                selectedScar ? <div className='text-center py-8 text-sm text-muted-foreground'>
                    <Shuffle className="mx-auto size-8 mb-2" />
                    <p>A random, eligible card from the global pool will be chosen to receive the <strong className='text-foreground'>{selectedScar.name}</strong> scar.</p>
                </div> : <div className="text-center py-8 text-sm text-muted-foreground opacity-60">
                    <Wand2 className="mx-auto size-8 mb-2" />
                    <p>Select a scar to continue.</p>
                </div>
             )}
        </div>

        <div className="p-6 border-t bg-muted/30 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Cost</span>
                <span className="text-2xl font-bold text-red-500">{cost} €</span>
            </div>
            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold" disabled={processing || (mode === 'card' && !selectedCard) || (mode === 'scar' && !selectedScar)} onClick={handlePurchase}>
                {processing ? <Loader2 className="size-5 animate-spin"/> : <Skull className="size-5 mr-2"/>}
                {processing ? "Applying..." : "Purchase Scar"}
            </Button>
        </div>
      </div>
    </div>
  );
};
