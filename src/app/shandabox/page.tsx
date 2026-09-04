// src/app/shandabox/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ShandaboxPublicWrapper } from "./ShandaboxPublicWrapper";
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

  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [charName, setCharName] = useState("");
  const [authError, setAuthError] = useState("");

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
    const [inv, b] = await Promise.all([ getUserInventory(uid), getUserBosses(uid) ]);
    setInventory(inv);
    setBosses(b);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    const res = await loginOrRegisterShandabox(email, passcode, charName);
    if (res.success) await loadUser();
    else { setAuthError(res.error || "Login failed"); setLoading(false); }
  };

  const handleProcessCards = async () => {
    if (!bulkCodes.trim() || processing || !user) return;
    setProcessing(true);
    const codes = [...new Set(bulkCodes.match(/\b\d{5}\b/g) || [])];
    if (codes.length === 0) { alert("No valid 5-digit codes found."); setProcessing(false); return; }

    for (const code of codes) {
      if (inventory.some(i => i.code === code)) continue;
      const status = await checkCodeStatus(code);
      if (!status.valid) continue;
      if (status.isOwned && status.ownerId !== user.id) {
          setTransferPrompt({ code, cardName: status.cardName, ownerName: status.ownerName || 'Unknown Player', ownerId: status.ownerId });
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
      const result = await claimBossCode(user.id, bossCode.trim());
      if (result.success) { setBossCode(""); await refreshData(user.id); }
      else alert(result.error);
      setBossProcessing(false);
  }

  if (loading) return <ShandaboxPublicWrapper><div className="text-center py-20 text-4xl">Loading...</div></ShandaboxPublicWrapper>;

  if (!user) {
    return (
      <ShandaboxPublicWrapper>
        <div className="max-w-xl mx-auto py-20">
          <div className="shanda-panel space-y-6">
            <div className="text-center">
              <h1 className="text-6xl uppercase tracking-widest border-b-[3px] border-current pb-4 mb-4">Shandabox</h1>
              <p className="text-2xl">Enter your credentials to continue.</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input type="email" placeholder="Email Address" required className="shanda-input" value={email} onChange={e => setEmail(e.target.value)} />
              <input type="text" placeholder="4-Digit PIN" pattern="\d{4}" maxLength={4} required className="shanda-input" value={passcode} onChange={e => setPasscode(e.target.value)} />
              <input type="text" placeholder="Character Name (Optional for login)" className="shanda-input" value={charName} onChange={e => setCharName(e.target.value)} />
              {authError && <p className="text-2xl text-red-500 font-bold text-center bg-black/50 p-2">{authError}</p>}
              <button type="submit" className="shanda-button mt-4">ENTER</button>
            </form>
          </div>
        </div>
      </ShandaboxPublicWrapper>
    );
  }

  return (
    <ShandaboxPublicWrapper>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="shanda-panel flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-5xl uppercase tracking-widest">{user.character_name}</h1>
            <p className="text-3xl opacity-80">LEVEL {user.level} ADVENTURER</p>
          </div>
          <div className="flex flex-col gap-2">
              <Link href={`/shandabox/${encodeURIComponent(user.character_name)}`} className="shanda-button text-center text-lg">Public Profile</Link>
              <button className="shanda-button text-lg" onClick={async () => { await logoutShandabox(); setUser(null); }}>Log Out</button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          
          {/* Controls */}
          <div className="md:col-span-1 space-y-8">
              <div className="shanda-panel space-y-4">
                  <h2 className="text-3xl border-b-[3px] border-current pb-2 uppercase">Register Cards</h2>
                  <textarea 
                      className="shanda-input w-full min-h-[120px]"
                      placeholder="Codes (e.g. 12345 67890)"
                      value={bulkCodes}
                      onChange={e => setBulkCodes(e.target.value)}
                      disabled={processing || !!transferPrompt}
                  />
                  {transferPrompt ? (
                      <div className="border-[3px] border-red-500 p-4 bg-red-500/10">
                          <p className="text-2xl font-bold text-red-500 mb-2">WARNING: CONFLICT</p>
                          <p className="text-xl mb-4">{transferPrompt.cardName} belongs to {transferPrompt.ownerName}. Did they give this to you?</p>
                          <div className="flex flex-col gap-2">
                              <button className="shanda-button bg-red-500/20" onClick={confirmTransfer}>Yes, Claim It</button>
                              <button className="shanda-button" onClick={() => { setTransferPrompt(null); setProcessing(false); }}>Cancel</button>
                          </div>
                  ) : (
                      <button onClick={handleProcessCards} disabled={!bulkCodes.trim() || processing} className="shanda-button w-full">
                          {processing ? "PROCESSING..." : "ADD TO POOL"}
                      </button>
                  )}
              </div>

              <div className="shanda-panel space-y-4">
                  <h2 className="text-3xl border-b-[3px] border-current pb-2 uppercase">Log Boss Defeat</h2>
                  <div className="flex flex-col gap-2">
                      <input type="text" placeholder="Boss Code" value={bossCode} onChange={e => setBossCode(e.target.value)} maxLength={5} className="shanda-input w-full" />
                      <button onClick={handleProcessBoss} disabled={!bossCode.trim() || bossProcessing} className="shanda-button w-full">
                          {bossProcessing ? "LOGGING..." : "LOG DEFEAT"}
                      </button>
                  </div></div>

          {/* Display */}
          <div className="md:col-span-2 space-y-8">
              
              {bosses.length > 0 && (
                  <div className="shanda-panel">
                      <h2 className="text-3xl border-b-[3px] border-current pb-2 uppercase mb-4">Bosses Defeated ({bosses.length})</h2>
                      <div className="flex flex-wrap gap-3">
                          {bosses.map(b => (
                              <div key={b.code} className="border-[3px] border-current px-3 py-1 text-2xl uppercase bg-black/10">
                                  {b.boss?.boss_name || 'Unknown Boss'}
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              <div className="shanda-panel">
                  <h2 className="text-3xl border-b-[3px] border-current pb-2 uppercase mb-4">Active Pool ({inventory.length})</h2>
                  {inventory.length === 0 ? (
                      <p className="text-center py-12 text-2xl opacity-60">No cards registered yet.</p>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {inventory.map((item) => (
                              <div key={item.code} className="border-[3px] border-current bg-black/10 flex flex-col h-full">
                                  <div className="relative aspect-[2.5/3.5] border-b-[3px] border-current">
                                      {item.card?.image_url ? (
                                          <Image src={item.card.image_url} alt={item.card?.card_name || 'Card'} fill className="object-cover" />
                                      ) : (
                                          <div className="absolute inset-0 flex items-center justify-center text-xl">No Image</div>
                                      )}
                                  </div>
                                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                      <p className="font-bold text-xl leading-tight" title={item.card?.card_name}>{item.card?.card_name}</p>
                                      <div className="flex items-center justify-between">
                                          <span className="text-lg opacity-80">#{item.code}</span>
                                          <button onClick={() => handleDropCard(item.code)} className="text-red-500 hover:text-red-400 font-bold text-lg transition-colors">
                                              [DROP]
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
    </ShandaboxPublicWrapper>
  );
}
