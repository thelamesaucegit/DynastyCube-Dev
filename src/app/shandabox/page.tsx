// src/app/shandabox/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Loader2, Plus, LogOut, AlertTriangle, Trash2, Shield, Skull } from "lucide-react";
import { 
  loginOrRegisterShandabox, 
  getShandaboxUser, 
  logoutShandabox, 
  getUserInventory, 
  getUserBosses,
  checkCodeStatus, 
  claimCode,
  dropCode,
  claimBossCode,
  type ShandaboxUser,
  type ShandaboxInventoryItem,
  type ShandaboxDefeatedBoss
} from "@/app/actions/shandaboxActions";

export default function ShandaboxPage() {
  const [user, setUser] = useState<ShandaboxUser | null>(null);
  const [inventory, setInventory] = useState<ShandaboxInventoryItem[]>([]);
  const [bosses, setBosses] = useState<ShandaboxDefeatedBoss[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [charName, setCharName] = useState("");
  const [authError, setAuthError] = useState("");

  // Input States
  const [bulkCodes, setBulkCodes] = useState("");
  const [bossCode, setBossCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [bossProcessing, setBossProcessing] = useState(false);
  const [transferPrompt, setTransferPrompt] = useState<{code: string, cardName: string, ownerName: string, ownerId: string} | null>(null);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    setLoading(true);
    const u = await getShandaboxUser();
    if (u) {
      setUser(u);
      await refreshData(u.id);
    }
    setLoading(false);
  };

  const refreshData = async (uid: string) => {
    const [inv, b] = await Promise.all([
        getUserInventory(uid),
        getUserBosses(uid)
    ]);
    setInventory(inv);
    setBosses(b);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    const res = await loginOrRegisterShandabox(email, passcode, charName);
    if (res.success) {
      await loadUser();
    } else {
      setAuthError(res.error || "Login failed");
      setLoading(false);
    }
  };

  const handleProcessCards = async () => {
    if (!bulkCodes.trim() || processing || !user) return;
    setProcessing(true);
    
    const codes = [...new Set(bulkCodes.match(/\b\d{5}\b/g) || [])];
    if (codes.length === 0) {
      alert("No valid 5-digit codes found.");
      setProcessing(false);
      return;
    }

    for (const code of codes) {
      if (inventory.some(i => i.code === code)) continue;

      const status = await checkCodeStatus(code);
      if (!status.valid) {
          console.warn(status.error);
          continue;
      }

      if (status.isOwned && status.ownerId !== user.id) {
          setTransferPrompt({ 
              code, 
              cardName: status.cardName, 
              ownerName: status.ownerName || 'Unknown Player', 
              ownerId: status.ownerId 
          });
          setProcessing(false);
          return; 
      } else {
          await claimCode(user.id, code);
      }
    }

    setBulkCodes("");
    await refreshData(user.id);
    setProcessing(false);
  };

  const confirmTransfer = async () => {
      if (!transferPrompt || !user) return;
      setProcessing(true);
      await claimCode(user.id, transferPrompt.code, transferPrompt.ownerId);
      
      setBulkCodes(prev => prev.replace(new RegExp(`\\b${transferPrompt.code}\\b`, 'g'), ''));
      setTransferPrompt(null);
      await refreshData(user.id);
      setProcessing(false);
  };

  const handleDropCard = async (code: string) => {
      if (!user || !confirm(`Remove code ${code} from your pool?`)) return;
      await dropCode(user.id, code);
      await refreshData(user.id);
  };

  const handleProcessBoss = async () => {
      if (!bossCode.trim() || bossProcessing || !user) return;
      setBossProcessing(true);
      
      const cleanCode = bossCode.trim();
      const result = await claimBossCode(user.id, cleanCode);
      
      if (result.success) {
          setBossCode("");
          await refreshData(user.id);
      } else {
          alert(result.error);
      }
      setBossProcessing(false);
  }

  if (loading) return <div className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-blue-500" /></div>;

  if (!user) {
    return (
      <div className="container max-w-md mx-auto py-20 px-4">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-black">Shandabox</CardTitle>
            <p className="text-muted-foreground text-sm">Enter your email and a 4-digit PIN. If you are new, enter your Character Name to register.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} />
              <Input type="text" placeholder="4-Digit PIN" pattern="\d{4}" maxLength={4} required value={passcode} onChange={e => setPasscode(e.target.value)} />
              <Input type="text" placeholder="Character Name (Optional if already registered)" value={charName} onChange={e => setCharName(e.target.value)} />
              {authError && <p className="text-sm text-red-500 font-bold text-center">{authError}</p>}
              <Button type="submit" className="w-full">Enter Shandabox</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-6 rounded-lg border">
        <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg border-4 border-background">
                {user.level}
            </div>
            <div>
                <h1 className="text-3xl font-black tracking-tight">{user.character_name}</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2">
                    <Shield className="size-4" /> Level {user.level} Adventurer
                </p>
            </div>
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
                <Link href={`/shandabox/${encodeURIComponent(user.character_name)}`}>View Public Profile</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await logoutShandabox(); setUser(null); }}>
                <LogOut className="size-4 mr-2" /> Log Out
            </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Registration Column */}
        <div className="md:col-span-1 space-y-6">
            <Card className="border-primary/20 shadow-md">
                <CardHeader>
                <CardTitle className="text-lg">Register Cards</CardTitle>
                <p className="text-xs text-muted-foreground">Paste or type 5-digit card codes below. Separate with spaces.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                <textarea 
                    className="w-full min-h-[100px] p-3 rounded-md bg-muted/50 border border-border resize-y font-mono"
                    placeholder="e.g., 12345 67890 54321..."
                    value={bulkCodes}
                    onChange={e => setBulkCodes(e.target.value)}
                    disabled={processing || !!transferPrompt}
                />

                {transferPrompt ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-md flex flex-col gap-3">
                        <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400">
                            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold">Card Conflict: {transferPrompt.cardName}</p>
                                <p>Currently registered to <strong>{transferPrompt.ownerName}</strong>.</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <Button size="sm" variant="default" className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={confirmTransfer}>Yes, Transfer to Me</Button>
                            <Button size="sm" variant="outline" onClick={() => { setTransferPrompt(null); setProcessing(false); }}>Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <Button onClick={handleProcessCards} disabled={!bulkCodes.trim() || processing} className="w-full">
                        {processing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
                        Add to Pool
                    </Button>
                )}
                </CardContent>
            </Card>

            <Card className="border-orange-500/20 shadow-md bg-orange-500/5">
                <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <Skull className="size-5" /> Log Boss Defeat
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            type="text" 
                            placeholder="5-Digit Boss Code" 
                            value={bossCode} 
                            onChange={e => setBossCode(e.target.value)} 
                            maxLength={5}
                            className="font-mono"
                        />
                        <Button onClick={handleProcessBoss} disabled={!bossCode.trim() || bossProcessing} variant="secondary">
                            {bossProcessing ? <Loader2 className="size-4 animate-spin" /> : "Log"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Display Column */}
        <div className="md:col-span-2 space-y-8">
            
            {/* Defeated Bosses */}
            {bosses.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
                        <Skull className="size-5 text-orange-500" /> Bosses Defeated ({bosses.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {bosses.map(b => (
                            <div key={b.code} className="bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-300 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {inventory.map((item) => (
                            <div key={item.code} className="bg-card border rounded-lg overflow-hidden group relative flex flex-col">
                                <div className="relative aspect-[2.5/3.5] bg-muted/50 border-b">
                                    {item.card?.image_url ? (
                                        <Image src={item.card.image_url} alt={item.card?.card_name || 'Card'} fill className="object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-2 text-center">No Image</div>
                                    )}
                                </div>
                                <div className="p-2 flex-1 flex flex-col justify-between">
                                    <p className="font-bold text-xs truncate" title={item.card?.card_name}>{item.card?.card_name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{item.code}</span>
                                        <button onClick={() => handleDropCard(item.code)} className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors" title="Remove from pool">
                                            <Trash2 className="size-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}
