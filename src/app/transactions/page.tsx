// src/app/transactions/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { getRecentTransactions, type RecentTransaction } from "@/app/actions/homeActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Loader2 } from "lucide-react";
import { CardPreview } from "@/app/components/CardPreview";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch the last 100 transactions for the dedicated page
      const result = await getRecentTransactions(100);
      if (result.transactions) {
        setTransactions(result.transactions);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading transaction ledger...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">League Transactions</h1>
        <p className="text-muted-foreground text-lg">A permanent ledger of all card acquisitions and trades.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {transactions.length > 0 ? (
            <div className="flex flex-col">
              {transactions.map((tx) => (
                <CardPreview key={tx.id} card={{ card_name: tx.card_name, image_url: tx.image_url, oldest_image_url: tx.oldest_image_url }}>
                  <div className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/50 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-4">
                        {tx.image_url && (<Image src={tx.image_url} alt={tx.card_name} width={48} height={68} className="rounded-sm object-cover shadow-sm hidden sm:block"/>)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg">{tx.card_name}</span>
                            {tx.card_type && (<Badge variant="secondary" className="text-[10px]">{tx.card_type}</Badge>)}
                          </div>
                          <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/80 flex items-center gap-1">
                                <span className="text-base">{tx.team_emoji}</span> {tx.team_name}
                            </span>
                            <span className="text-xs opacity-70 border-l border-border/50 pl-2 uppercase tracking-wide">
                                {tx.acquisition_method === 'trade' && tx.from_team_emoji 
                                  ? `ACQUIRED VIA TRADE FROM ${tx.from_team_emoji}`
                                  : `ACQUIRED VIA ${tx.acquisition_method.replace('_', ' ')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap font-medium bg-muted/50 px-3 py-1.5 rounded-full">
                            {new Date(tx.acquired_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardPreview>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">The transaction ledger is currently empty.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
