// src/app/marketplace/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { 
  Store, 
  Package, 
  Map, 
  BookOpen, 
  Search, 
  TrendingUp, 
  Ghost, 
  Tag, 
  FastForward, 
  Skull, 
  ArrowUpCircle,
  Loader2
} from "lucide-react";
import { getUserEssenceBalance, type EssenceBalance } from "@/app/actions/essenceActions";
import { purchaseRandomBooster } from "@/app/actions/marketplaceActions";
import { toast } from "sonner";

// Centralizing configuration data to easily map UI logic
const MARKETPLACE_ITEMS = [
  {
    id: "random_booster",
    title: "Random Booster",
    description: "Add a Booster Pack to The Chamber (at random).",
    icon: <Package className="size-6 text-blue-400" />,
    cost: 150,
    isActive: true, // Activated!
  },
  {
    id: "home_booster",
    title: "Home Plane Booster",
    description: "Add a Booster Pack from your Team's Home Plane to The Chamber (at random).",
    icon: <Map className="size-6 text-green-400" />,
    cost: 100,
    isActive: false, 
  },
  {
    id: "reveal_truth",
    title: "Reveal",
    description: "Reveal words from The Cypher.",
    icon: <BookOpen className="size-6 text-amber-400" />,
    costText: "€2 per letter", // Special text for dynamic cost
    isActive: false, 
  },
  {
    id: "retrieve_lost",
    title: "Retrieve",
    description: "Retrieve something Lost.",
    icon: <Search className="size-6 text-cyan-400" />,
    cost: 200,
    isActive: false,
  },
  {
    id: "market_manipulation",
    title: "Market Manipulation",
    description: "Increase or decrease the value of a card not in a Team Pool by Ç1. Minimum value of Ç1. Cards in a Draft Pool for a currently active Draft are ineligible.",
    icon: <TrendingUp className="size-6 text-emerald-400" />,
    cost: 100,
    isActive: false,
  },
  {
    id: "necromancy",
    title: "Reinvigorate",
    description: "Call a card back from Retirement.",
    icon: <Ghost className="size-6 text-slate-400" />,
    cost: 250,
    isActive: false,
  },
  {
    id: "rename",
    title: "Rename",
    description: "Nickname a creature in your Team Pool permanently.",
    icon: <Tag className="size-6 text-pink-400" />,
    cost: 500,
    isActive: false,
  },
  {
    id: "skip",
    title: "Skip",
    description: "Skip. The chamber is emptied and refilled with the next chronological set.",
    icon: <FastForward className="size-6 text-orange-400" />,
    cost: 1000,
    isActive: false,
  },
  {
    id: "scarring",
    title: "Scarring",
    description: "Apply a random Scar to a specified card in The Draft Pool or The Chamber, or a specified Scar to a random card.",
    icon: <Skull className="size-6 text-red-500" />,
    cost: 500,
    isActive: false,
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

  const loadBalance = async () => {
    const result = await getUserEssenceBalance();
    if (result.balance) {
      setBalance(result.balance);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadBalance();
  }, []);

  const handlePurchase = async (itemId: string, cost: number) => {
      // Preliminary UI check
      if ((balance?.essence_balance || 0) < cost) {
          toast.error(`Insufficient Essence. You need ${cost} €.`);
          return;
      }

      setProcessingId(itemId);

      if (itemId === "random_booster") {
          const res = await purchaseRandomBooster();
          if (res.success) {
              toast.success(res.message);
              await loadBalance(); // Refresh the balance readout
          } else {
              toast.error(res.error);
          }
      }
      // Future implementations will branch here!

      setProcessingId(null);
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-purple-600 dark:text-purple-400">
            <Store className="size-10" />
            The Marketplace
          </h1>
          <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
            A strange bazaar where trinkets and great powers are bought and sold side by side. 
            Spend your Essence carefully.
          </p>
        </div>
        
        {/* PERSONAL ESSENCE STASH */}
        <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm min-w-[200px] shrink-0">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Essence</p>
            {loading ? (
               <div className="h-10 w-16 bg-purple-500/20 animate-pulse rounded-md mt-1"></div>
            ) : (
               <div className="text-4xl font-black text-purple-600 dark:text-purple-400 flex items-center gap-1 drop-shadow-sm">
                 {balance?.essence_balance || 0} <span className="font-semibold text-3xl">€</span>
               </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MARKETPLACE ITEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MARKETPLACE_ITEMS.map((item) => {
            const isProcessing = processingId === item.id;
            const canAfford = item.cost ? (balance?.essence_balance || 0) >= item.cost : false;

            return (
              <Card key={item.id} className={`relative overflow-hidden border-border/50 transition-all flex flex-col shadow-sm hover:shadow-md ${!item.isActive ? "bg-muted/20 opacity-80" : "bg-card hover:border-primary/50"}`}>
                
                <CardHeader className="pb-3 z-10">
                  <div className="p-3 bg-background border rounded-lg w-fit shadow-sm mb-3">
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
                    <Badge variant="outline" className={`font-bold border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10`}>
                      {item.costText ? item.costText : `${item.cost} €`}
                    </Badge>
                  </div>
                  
                  {item.isActive ? (
                    <Button 
                        onClick={() => handlePurchase(item.id, item.cost || 0)}
                        disabled={!canAfford || isProcessing}
                        className={canAfford ? "bg-purple-600 hover:bg-purple-700 text-white font-bold" : ""}
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
    </div>
  );
}
