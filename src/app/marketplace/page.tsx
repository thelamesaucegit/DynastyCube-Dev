// src/app/marketplace/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { 
  Sparkles, 
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
  Construction,
  Lock
} from "lucide-react";
import { getUserEssenceBalance, type EssenceBalance } from "@/app/actions/essenceActions";

const MARKETPLACE_ITEMS = [
  {
    id: "random_booster",
    title: "Random Booster",
    description: "Add a Booster Pack to The Chamber (at random).",
    icon: <Package className="size-6 text-blue-400" />,
  },
  {
    id: "home_booster",
    title: "Home Plane Booster",
    description: "Add a Booster Pack from your Team's Home Plane to The Chamber (at random).",
    icon: <Map className="size-6 text-green-400" />,
  },
  {
    id: "reveal_truth",
    title: "Reveal",
    description: "Reveal words from The Cypher.",
    icon: <BookOpen className="size-6 text-amber-400" />,
  },
  {
    id: "retrieve_lost",
    title: "Retrieve",
    description: "Retrieve something Lost.",
    icon: <Search className="size-6 text-cyan-400" />,
  },
  {
    id: "market_manipulation",
    title: "Market Manipulation",
    description: "Increase or decrease the value of a card not in a Team Pool by Ç1. Minimum value of Ç1. Cards in a Draft Pool for a currently active Draft are ineligible.",
    icon: <TrendingUp className="size-6 text-emerald-400" />,
  },
  {
    id: "necromancy",
    title: "Reinvigorate",
    description: "Call a card back from Retirement.",
    icon: <Ghost className="size-6 text-slate-400" />,
  },
  {
    id: "rename",
    title: "Rename",
    description: "Nickname a creature in your Team Pool permanently.",
    icon: <Tag className="size-6 text-pink-400" />,
  },
  {
    id: "skip",
    title: "Skip",
    description: "Skip.",
    icon: <FastForward className="size-6 text-orange-400" />,
  },
  {
    id: "scarring",
    title: "Scarring",
    description: "Apply a random Scar to a specified card in The Draft Pool or The Chamber, or a specified Scar to a random card.",
    icon: <Skull className="size-6 text-red-500" />,
  },
  {
    id: "ascension",
    title: "Ascension",
    description: "Ascend.",
    icon: <ArrowUpCircle className="size-6 text-purple-500" />,
  },
];

export default function MarketplacePage() {
  const [balance, setBalance] = useState<EssenceBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBalance() {
      const result = await getUserEssenceBalance();
      if (result.balance) {
        setBalance(result.balance);
      }
      setLoading(false);
    }
    loadBalance();
  }, []);

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
            The vendor appears to be away at the moment.
          </p>
        </div>

        {/* PERSONAL ESSENCE STASH */}
        <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm min-w-[200px] shrink-0">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Essence</p>
            {loading ? (
               <div className="h-10 w-16 bg-purple-500/20 animate-pulse rounded-md mt-1"></div>
            ) : (
               <div className="text-4xl font-black text-purple-600 dark:text-purple-400 flex items-center gap-2 drop-shadow-sm">
                 {balance?.essence_balance || 0} <Sparkles className="size-8" />
               </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* UNDER CONSTRUCTION BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-4 shadow-inner">
        <Construction className="size-6 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-700 dark:text-amber-400">The stalls are currently closed.</h3>
          <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
            The League is in flux. The items below have been spotted through the storefront windows, but their prices remain obscured. Gather your Essence while you wait.
          </p>
        </div>
      </div>

      {/* MARKETPLACE ITEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MARKETPLACE_ITEMS.map((item) => (
          <Card key={item.id} className="relative overflow-hidden border-border/50 bg-muted/20 opacity-80 transition-all hover:opacity-100 flex flex-col">
            
            {/* Locked Overlay Styling */}
            <div className="absolute top-3 right-3 opacity-30">
                <Lock className="size-16 text-muted-foreground" />
            </div>

            <CardHeader className="pb-3 z-10">
              <div className="p-3 bg-background border rounded-lg w-fit shadow-sm mb-3 grayscale">
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
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 blur-[2px] select-none hover:blur-none transition-all duration-500 cursor-help" title="The price is shifting...">
                  REDACTED ✨
                </Badge>
              </div>
              <Button disabled variant="secondary" className="opacity-50 cursor-not-allowed font-semibold">
                Closed
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
