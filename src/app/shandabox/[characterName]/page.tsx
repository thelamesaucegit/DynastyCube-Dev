// src/app/shandabox/[characterName]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Shield, Skull, ArrowLeft } from "lucide-react";
import { getPublicShandaboxProfile, type ShandaboxUser, type ShandaboxInventoryItem, type ShandaboxDefeatedBoss } from "@/app/actions/shandaboxActions";

export default function ShandaboxProfilePage({ params }: { params: Promise<{ characterName: string }> }) {
  const unwrappedParams = use(params);
  const characterName = decodeURIComponent(unwrappedParams.characterName);
  
  const [user, setUser] = useState<ShandaboxUser | null>(null);
  const [inventory, setInventory] = useState<ShandaboxInventoryItem[]>([]);
  const [bosses, setBosses] = useState<ShandaboxDefeatedBoss[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getPublicShandaboxProfile(characterName);
      if (res.success && res.user) {
        setUser(res.user);
        setInventory(res.inventory || []);
        setBosses(res.bosses || []);
      }
      setLoading(false);
    }
    load();
  }, [characterName]);

  if (loading) return <div className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-blue-500" /></div>;

  if (!user) {
      return (
          <div className="container max-w-md mx-auto py-20 text-center space-y-4">
              <h1 className="text-2xl font-bold">Character Not Found</h1>
              <p className="text-muted-foreground">The adventurer &quot;{characterName}&quot; does not exist in Shandabox.</p>
              <Link href="/shandabox" className="text-blue-500 hover:underline block">Return to Shandabox Login</Link>
          </div>
      );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
      <Link href="/shandabox" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 mr-1" /> Back to Login
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 bg-muted/30 p-8 rounded-lg border border-border shadow-sm">
        <div className="size-20 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-background shrink-0">
            {user.level}
        </div>
        <div>
            <h1 className="text-4xl font-black tracking-tight mb-1">{user.character_name}</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 text-lg">
                <Shield className="size-5" /> Level {user.level} Adventurer
            </p>
        </div>
      </div>

      {bosses.length > 0 && (
          <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
                  <Skull className="size-5 text-orange-500" /> Bosses Defeated ({bosses.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                  {bosses.map(b => (
                      <div key={b.code} className="bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-300 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
                          {b.boss?.boss_name || 'Unknown Boss'}
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Inventory Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Active Card Pool ({inventory.length})</h2>
        {inventory.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">No cards registered yet.</p>
        ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {inventory.map((item) => (
                    <div key={item.code} className="bg-card border rounded-lg overflow-hidden flex flex-col hover:border-primary/50 transition-colors">
                        <div className="relative aspect-[2.5/3.5] bg-muted/50 border-b">
                            {item.card?.image_url ? (
                                <Image src={item.card.image_url} alt={item.card?.card_name || 'Card'} fill className="object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-2 text-center">No Image</div>
                            )}
                        </div>
                        <div className="p-2 bg-muted/20">
                            <p className="font-bold text-[11px] truncate text-center" title={item.card?.card_name}>{item.card?.card_name}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
