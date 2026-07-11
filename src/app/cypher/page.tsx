// src/app/cypher/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { BookOpen, Key, Loader2, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { getObfuscatedCyphers, submitCypherGuess, purchaseCypherWord, type ObfuscatedCypher, type CypherToken } from "@/app/actions/cypherActions";
import { getUserEssenceBalance } from "@/app/actions/essenceActions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { TargetedGlitchedText } from "@/app/components/lore/TargetedGlitchedText";


export default function CypherPage() {
  const [cyphers, setCyphers] = useState<ObfuscatedCypher[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  const [guessInput, setGuessInput] = useState("");
  const [guessingId, setGuessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [cypherRes, balRes] = await Promise.all([
        getObfuscatedCyphers(),
        getUserEssenceBalance()
    ]);
    if (cypherRes.success && cypherRes.cyphers) setCyphers(cypherRes.cyphers);
    if (balRes.balance) setBalance(balRes.balance.essence_balance);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleGuess = async (cypherId: string) => {
    if (!guessInput.trim()) return;
    setGuessingId(cypherId);
    
    const res = await submitCypherGuess(cypherId, guessInput);
    if (res.success) {
        toast.success(res.message);
        setGuessInput("");
        await loadData(); 
    } else {
        toast.error(res.error);
    }
    setGuessingId(null);
  };

  const handlePurchase = async (cypherId: string, token: CypherToken) => {
      if (!token.length || token.wordIndex === undefined) return;
      const cost = token.length * 2;
      
      if (!confirm(`Spend ${cost} Essence to force-reveal this ${token.length}-letter word?`)) return;
      const res = await purchaseCypherWord(cypherId, token.wordIndex);
      if (res.success) {
          toast.success(res.message);
          await loadData();
      } else {
          toast.error(res.error);
      }
  };

  if (loading) {
      return <div className="flex justify-center py-20"><Loader2 className="size-10 animate-spin text-amber-500" /></div>;
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
        <div>
          {/* THE FIX: Changed purple header coloring to golden yellow (text-amber-500) */}
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-amber-500 dark:text-amber-400">
            <BookOpen className="size-10" />
            The Cypher
          </h1>
          <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
            Pages torn from THE BOOK. Guess the hidden words to decode the lore and earn Essence for your efforts. 
            Alternatively, spend your Essence to force a revelation.
          </p>
        </div>
        
        {/* THE FIX: Changed purple container and currency symbol to gold borders and € symbol */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm min-w-[200px] shrink-0">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Essence</p>
            <div className="text-4xl font-black text-amber-500 dark:text-amber-400 flex items-center gap-2 drop-shadow-sm">
                {balance} <span className="font-semibold text-3xl">€</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {cyphers.map(cypher => (
          <AccordionItem key={cypher.id} value={cypher.id} className="border border-border/50 bg-card rounded-lg overflow-hidden shadow-sm">
            <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 text-lg font-bold">
                    {/* THE FIX: Changed purple key icon to golden yellow */}
                    <Key className="size-5 text-amber-500" />
                    {cypher.title}
                </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-6 pb-6 pt-2">
                {/* GUESSING INTERFACE */}
                <div className="flex gap-2 mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
                    <Input 
                        placeholder="Guess a hidden word..." 
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess(cypher.id)}
                        className="max-w-xs"
                    />
                    {/* THE FIX: Changed decode button from purple to golden yellow (bg-amber-600) */}
                    <Button 
                        onClick={() => handleGuess(cypher.id)}
                        disabled={guessingId === cypher.id || !guessInput.trim()}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                        {guessingId === cypher.id ? <Loader2 className="size-4 animate-spin mr-2"/> : <Key className="size-4 mr-2"/>}
                        Decode
                    </Button>
                </div>

                {/* THE TEXT RENDERER */}
                <div className="text-lg leading-loose font-serif p-6 bg-amber-500/5 border border-amber-500/20 rounded-lg shadow-inner text-foreground/90">
                    {cypher.tokens.map((token, idx) => {
                        if (!token.isWord) return <span key={idx} className="whitespace-pre-wrap">{token.text}</span>;
                        
                        {/* THE FIX: Changed revealed word color from purple to blue (text-blue-600 / dark:text-blue-400) */}
                        if (token.isRevealed) {
                            return <span key={idx} className="text-blue-600 dark:text-blue-400 font-bold transition-all"><TargetedGlitchedText text={token.text}/></span>;
                        }

                        {/* THE FIX: Changed hidden card block hover states from purple to golden yellow */}
                        return (
                            <span 
                                key={idx} 
                                onClick={() => handlePurchase(cypher.id, token)}
                                className="cursor-pointer text-muted-foreground hover:text-amber-500 transition-colors bg-muted-foreground/20 hover:bg-amber-500/20 rounded px-1 mx-0.5 select-none inline-flex items-center gap-1 group"
                                title={`Reveal for ${token.length! * 2} Essence`}
                            >
                                {token.text}
                                <LockOpen className="size-3 opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-4" />
                            </span>
                        );
                    })}
                </div>
            </AccordionContent>
          </AccordionItem>
        ))}
        
        {cyphers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="size-12 mx-auto mb-3 opacity-20" />
                <p>No cyphers are currently available to decode.</p>
            </div>
        )}
      </Accordion>
    </div>
  );
}
