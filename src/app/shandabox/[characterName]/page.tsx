// src/app/shandabox/[characterName]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ShandaboxPublicWrapper } from "../ShandaboxPublicWrapper";
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

  if (loading) return <ShandaboxPublicWrapper><div className="text-center py-20 text-4xl">Loading...</div></ShandaboxPublicWrapper>;

  if (!user) {
      return (
        <ShandaboxPublicWrapper>
          <div className="shanda-panel max-w-xl mx-auto py-20 text-center space-y-6">
              <h1 className="text-5xl font-bold uppercase">Character Not Found</h1>
              <p className="text-2xl opacity-80">The adventurer &quot;{characterName}&quot; does not exist.</p>
              <Link href="/shandabox" className="shanda-button inline-block mt-4">Return to Login</Link>
          </div>
        </ShandaboxPublicWrapper>
      );
  }

  return (
    <ShandaboxPublicWrapper>
      <div className="space-y-8">
        <Link href="/shandabox" className="text-2xl hover:underline uppercase opacity-80 hover:opacity-100 transition-opacity">
            {"< Back to Login"}
        </Link>

        {/* Header */}
        <div className="shanda-panel flex flex-col md:flex-row items-center gap-6">
          <div className="size-24 rounded-full border-[4px] border-current flex items-center justify-center font-black text-5xl bg-black/10 shrink-0">
              {user.level}
          </div>
          <div className="text-center md:text-left">
              <h1 className="text-6xl font-black uppercase tracking-widest mb-2">{user.character_name}</h1>
              <p className="text-3xl opacity-80 uppercase">Level {user.level} Adventurer</p>
          </div>
        </div>

        {bosses.length > 0 && (
            <div className="shanda-panel">
                <h2 className="text-4xl border-b-[3px] border-current pb-2 uppercase mb-6">Bosses Defeated ({bosses.length})</h2>
                <div className="flex flex-wrap gap-4">
                    {bosses.map(b => (
                        <div key={b.code} className="border-[3px] border-current px-4 py-2 text-2xl uppercase bg-black/10">
                            {b.boss?.boss_name || 'Unknown Boss'}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Inventory Grid */}
        <div className="shanda-panel">
          <h2 className="text-4xl border-b-[3px] border-current pb-2 uppercase mb-6">Active Card Pool ({inventory.length})</h2>
          {inventory.length === 0 ? (
              <p className="text-center py-12 text-2xl opacity-60">No cards registered yet.</p>
          ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {inventory.map((item) => (
                      <div key={item.code} className="border-[3px] border-current bg-black/10 flex flex-col hover:border-current/50 transition-colors">
                          <div className="relative aspect-[2.5/3.5] border-b-[3px] border-current">
                              {item.card?.image_url ? (
                                  <Image src={item.card.image_url} alt={item.card?.card_name || 'Card'} fill className="object-cover" />
                              ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-xl text-center">No Image</div>
                              )}
                          </div>
                          <div className="p-2 bg-black/20 flex-1 flex flex-col justify-center">
                              <p className="font-bold text-lg truncate text-center" title={item.card?.card_name}>{item.card?.card_name}</p>
                          </div>
                      </div> // <-- FIXED MISSING CLOSING DIV
                  ))}
              </div>
          )}
        </div>
      </div>
    </ShandaboxPublicWrapper>
  );
}
