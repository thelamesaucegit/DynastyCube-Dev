// src/app/marketplace/page.tsx
"use client";

import { ScarPurchaseModal } from "@/app/components/marketplace/ScarPurchaseModal";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { 
  Store, Package, Map, BookOpen, Search, TrendingUp, Ghost, Tag, FastForward, Skull, ArrowUpCircle, Construction, Lock, Loader2, ArrowUpRight, ArrowDownRight, X
} from "lucide-react";
import { getUserEssenceBalance, type EssenceBalance } from "@/app/actions/essenceActions";
import { purchaseRandomBooster, purchaseHomePlaneBooster, searchCardsForManipulation, purchaseMarketManipulation } from "@/app/actions/marketplaceActions";
import { toast } from "sonner";

// Type-safe interface to replace "any"
interface ManipulationCard {
  id: string;
  card_name: string;
  card_set: string;
  cubucks_cost: number;
  image_url: string | null;
  pool_name: string;
}

const MARKETPLACE_ITEMS = [
  {
    id: "random_booster",
    title: "Random Booster",
    description: "Add a Booster Pack to The Chamber (at random). Contains 1 Rare/Mythic, 3 Uncommons, and 11 Commons.",
    icon: <Package className="size-6 text-emerald-500" />,
    cost: 150,
    isActive: true, 
  },
  {
    id: "home_booster",
    title: "Home Plane Booster",
    description: "Add a Booster Pack from your Team's Home Plane to The Chamber. Contains 1 Rare/Mythic, 3 Uncommons, and 11 Commons.",
    icon: <Map className="size-6 text-green-500" />,
    cost: 100,
    isActive: true, 
  },
  {
    id: "reveal_truth",
    title: "Reveal",
    description: "Reveal words from The Cypher.",
    icon: <BookOpen className="size-6 text-amber-500" />,
    costText: "€2 per letter",
    isActive: true,
    href: "/cypher" 
  },
  {
    id: "retrieve_lost",
    title: "Retrieve",
    description: "Retrieve something Lost.",
    icon: <Search className="size-6 text-cyan-500" />,
    cost: 200,
    isActive: false,
  },
  {
    id: "market_manipulation",
    title: "Market Manipulation",
    description: "Increase or decrease the value of a card not in a Team Pool by Ç1. Minimum value of Ç1. Cards in a Draft Pool for a currently active Draft are ineligible.",
    icon: <TrendingUp className="size-6 text-lime-500" />,
    cost: 100,
    isActive: true, 
    action: "modal_manipulation"
  },
  {
    id: "necromancy",
    title: "Reinvigorate",
    description: "Call a card back from Retirement.",
    icon: <Ghost className="size-6 text-slate-500" />,
    cost: 250,
    isActive: false,
  },
  {
    id: "rename",
    title: "Rename",
    description: "Nickname a creature in your Team Pool permanently.",
    icon: <Tag className="size-6 text-pink-500" />,
    cost: 500,
    isActive: false,
  },
  {
    id: "skip",
    title: "Skip",
    description: "Skip. The chamber is emptied and refilled with the next chronological set.",
    icon: <FastForward className="size-6 text-orange-500" />,
    cost: 1000,
    isActive: false,
  },
 {
    id: "scarring",
    title: "Scar",
    description: "Apply a random Scar to a specified card, or a specified Scar to a random card. Cost varies by rarity.",
    icon: <Skull className="size-6 text-red-500" />,
    cost: 500, // Base cost
    isActive: true, // ACTIVATE THE ITEM
  },
  {
    id: "ascension",
    title: "Ascension",
    description: "Ascend.",
    icon: <ArrowUpCircle className="size-6 text-purple-500" />,
    cost: 100000,
    isActive: false,
  },
];

export default function MarketplacePage() {
  const [balance, setBalance] = useState<EssenceBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal State
  const [manipulationModalOpen, setManipulationModalOpen] = useState(false);
  const [manipulationSearch, setManipulationSearch] = useState("");
  const [scarModalOpen, setScarModalOpen] = useState(false);

  // THE FIX: Explicitly typed array instead of any[]
  const [manipulationResults, setManipulationResults] = useState<ManipulationCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadBalance = async () => {
    const result = await getUserEssenceBalance();
    if (result.balance) setBalance(result.balance);
    setLoading(false);
  }

  useEffect(() => { loadBalance(); }, []);

  // Handle Search Debouncing for Market Manipulation
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
          if (manipulationSearch.trim().length >= 3) {
              setIsSearching(true);
              const res = await searchCardsForManipulation(manipulationSearch);
              // THE FIX: Explicit cast matching the ManipulationCard interface
              if (res.success && res.cards) setManipulationResults(res.cards as ManipulationCard[]);
              setIsSearching(false);
          } else {
              setManipulationResults([]);
          }
      }, 500);

      return () => clearTimeout(delayDebounceFn);
  }, [manipulationSearch]);

  const handlePurchase = async (itemId: string, cost: number, actionType?: string) => {
      if ((balance?.essence_balance || 0) < cost) {
          toast.error(`Insufficient Essence. You need ${cost} €.`);
          return;
      }
      if (actionType === "modal_manipulation") {
          setManipulationModalOpen(true);
          return;
      }
      // THE FIX: Add the new case for the scar modal
      if (itemId === "scarring") {
          setScarModalOpen(true);
          return;
      }

      setProcessingId(itemId);

      if (itemId === "random_booster") {
          const res = await purchaseRandomBooster();
          if (res.success) { toast.success(res.message); await loadBalance(); } 
          else toast.error(res.error);
      } 
      else if (itemId === "home_booster") {
          const res = await purchaseHomePlaneBooster();
          if (res.success) { toast.success(res.message); await loadBalance(); } 
          else toast.error(res.error);
      }

      setProcessingId(null);
  }

  const handleExecuteManipulation = async (cardId: string, direction: 'increase' | 'decrease', currentCost: number) => {
      if (direction === 'decrease' && currentCost <= 1) {
          toast.error("Market failure: A card's cost cannot be reduced below Ç1.");
          return;
      }
      if (!confirm(`Are you sure you want to spend 100 € to ${direction} the cost of this card?`)) return;

      setProcessingId("market_manipulation_execute");
      const res = await purchaseMarketManipulation(cardId, direction);
      
      if (res.success) {
          toast.success(res.message);
          setManipulationModalOpen(false);
          setManipulationSearch("");
          await loadBalance();
      } else {
          toast.error(res.error);
      }
      setProcessingId(null);
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <Store className="size-10" />
            The Marketplace
          </h1>
          <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
            A strange bazaar where trinkets and great powers are bought and sold side by side. 
            Spend your Essence carefully.
          </p>
        </div>
        
        {/* PERSONAL ESSENCE STASH */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm min-w-[200px] shrink-0">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Essence</p>
            {loading ? (
               <div className="h-10 w-16 bg-emerald-500/20 animate-pulse rounded-md mt-1"></div>
            ) : (
               <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 drop-shadow-sm">
                 {balance?.essence_balance || 0} <span className="font-semibold text-3xl">€</span>
               </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* UNDER CONSTRUCTION BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-4 shadow-inner">
        <Construction className="size-6 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-700 dark:text-amber-400">The stalls are currently opening.</h3>
          <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
            The League is in flux. Several items below have been spotted through the storefront windows, but their prices remain obscured. Gather your Essence while you wait.
          </p>
        </div>
      </div>

      {/* MARKETPLACE ITEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MARKETPLACE_ITEMS.map((item) => {
            const isProcessing = processingId === item.id;
            const canAfford = item.cost ? (balance?.essence_balance || 0) >= item.cost : true;

            return (
              <Card key={item.id} className={`relative overflow-hidden border-border/50 transition-all flex flex-col shadow-sm hover:shadow-md ${!item.isActive ? "bg-muted/20 opacity-80" : "bg-card hover:border-emerald-500/50"}`}>
                
                {!item.isActive && (
                    <div className="absolute top-3 right-3 opacity-30">
                        <Lock className="size-16 text-muted-foreground" />
                    </div>
                )}
                
                <CardHeader className="pb-3 z-10">
                  <div className={`p-3 bg-background border rounded-lg w-fit shadow-sm mb-3 ${!item.isActive ? 'grayscale' : ''}`}>
                    {item.icon}
                  </div>
                  <CardTitle className="text-xl font-bold">{item.title}</CardTitle>
                </CardHeader>
                
                <CardContent className="z-10 flex-1">
                  <CardDescription className="text-sm leading-relaxed text-foreground/80">
                    {item.description}
                  </CardDescription>
                </CardContent>
                
                <CardFooter className="z-10 pt-4 border-t border-border/40 bg-background/50 flex items-center justify-between mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Cost</span>
                    <Badge variant="outline" className={`font-bold ${!item.isActive ? 'bg-muted text-muted-foreground border-border' : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'}`}>
                      {item.costText ? item.costText : `${item.cost} €`}
                    </Badge>
                  </div>
                  
                  {item.href ? (
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        <Link href={item.href}>Go To Page</Link>
                    </Button>
                  ) : item.isActive ? (
                    <Button 
                        onClick={() => handlePurchase(item.id, item.cost || 0, item.action)}
                        disabled={!canAfford || isProcessing}
                        className={canAfford ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : ""}
                        variant={canAfford ? "default" : "secondary"}
                    >
                        {isProcessing ? <Loader2 className="size-4 animate-spin" /> : "Purchase"}
                    </Button>
                  ) : (
                    <Button disabled variant="secondary" className="opacity-50 cursor-not-allowed font-semibold">
                      Locked
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
        })}
      </div>

      {/* MARKET MANIPULATION MODAL */}
      {manipulationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh]">
                
                {/* Modal Header */}
                <div className="p-6 border-b flex justify-between items-center bg-muted/30">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="size-5" /> Market Manipulation
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Search for an eligible card to permanently alter its value.</p>
                    </div>
                    <button onClick={() => setManipulationModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="size-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-6 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search by card name (min 3 characters)..." 
                            className="pl-10 h-12 text-lg"
                            value={manipulationSearch}
                            onChange={(e) => setManipulationSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Search Results */}
                <div className="p-6 pt-4 overflow-y-auto flex-1">
                    {isSearching ? (
                        <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-emerald-500" /></div>
                    ) : manipulationResults.length > 0 ? (
                        <div className="space-y-3">
                            {manipulationResults.map((card) => (
                                <div key={card.id} className="flex items-center gap-4 p-3 border rounded-lg hover:border-emerald-500/50 bg-muted/20 transition-colors">
                                    {card.image_url && (
                                        <div className="w-12 h-16 shrink-0 relative rounded overflow-hidden">
                                            <Image src={card.image_url} alt={card.card_name} fill className="object-cover" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-foreground truncate">{card.card_name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-[10px]">{card.card_set}</Badge>
                                            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-500">Current Cost: Ç {card.cubucks_cost || 1}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                            disabled={processingId === "market_manipulation_execute"}
                                            onClick={() => handleExecuteManipulation(card.id, 'increase', card.cubucks_cost || 1)}
                                        >
                                            <ArrowUpRight className="size-3 mr-1" />
                                            Increase to Ç {(card.cubucks_cost || 1) + 1}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-30"
                                            disabled={processingId === "market_manipulation_execute" || (card.cubucks_cost || 1) <= 1}
                                            onClick={() => handleExecuteManipulation(card.id, 'decrease', card.cubucks_cost || 1)}
                                        >
                                            <ArrowDownRight className="size-3 mr-1" />
                                            Decrease to Ç {Math.max(1, (card.cubucks_cost || 1) - 1)}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : manipulationSearch.trim().length >= 3 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {/* THE FIX: Properly escaped the double quotes inside JSX */}
                            No eligible cards found matching &ldquo;{manipulationSearch}&rdquo;. <br/>
                            <span className="text-xs">(Cards currently held in a Team Pool or an active Draft Pool are ineligible.)</span>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground opacity-50">
                            <TrendingUp className="size-12 mx-auto mb-3" />
                            Type a card name to search the global market pool.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* NEW SCAR MODAL */}
  <ScarPurchaseModal 
    isOpen={scarModalOpen}
    onClose={() => setScarModalOpen(false)}
    onPurchaseComplete={() => {
        loadBalance(); // Refresh user's essence balance
    }}
  />
    </div>
  );
}
