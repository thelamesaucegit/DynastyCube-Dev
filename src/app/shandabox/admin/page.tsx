// src/app/shandabox/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { verifyShandaboxAdmin, bulkImportCards, bulkImportBosses } from "@/app/actions/shandaboxActions";

export default function ShandaboxAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  const [cardCsv, setCardCsv] = useState("");
  const [bossCsv, setBossCsv] = useState("");
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingBosses, setLoadingBosses] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    verifyShandaboxAdmin().then(setIsAdmin);
  }, []);

  const handleCardImport = async () => {
      if (!cardCsv.trim()) return;
      setLoadingCards(true);
      setMessage("&gt; IMPORTING CARDS... SCRYFALL API FETCHES MAY TAKE A MOMENT.");
      
      const result = await bulkImportCards(cardCsv);
      if (result.success) {
          setMessage(`&gt; SUCCESS: IMPORTED ${result.count} CARDS AND FETCHED ORIGINAL ARTWORK.`);
          setCardCsv("");
      } else {
          setMessage(`&gt; ERROR: ${result.error}`);
      }
      setLoadingCards(false);
  };

  const handleBossImport = async () => {
      if (!bossCsv.trim()) return;
      setLoadingBosses(true);
      setMessage("&gt; IMPORTING BOSS DEFINITIONS...");
      
      const result = await bulkImportBosses(bossCsv);
      if (result.success) {
          setMessage(`&gt; SUCCESS: MAPPED ${result.count} BOSS CODES.`);
          setBossCsv("");
      } else {
          setMessage(`&gt; ERROR: ${result.error}`);
      }
      setLoadingBosses(false);
  };

  if (isAdmin === null) return <div className="min-h-screen bg-black text-[#0f0] font-mono p-12 text-2xl">&gt; INITIALIZING CONNECTION...</div>;

  if (isAdmin === false) {
      return (
          <div className="min-h-screen bg-black text-red-500 font-mono p-12 space-y-6">
              <h1 className="text-4xl font-bold">&gt;&gt;&gt; ACCESS DENIED</h1>
              <p className="text-xl">YOU DO NOT HAVE SHANDABOX ADMINISTRATOR PRIVILEGES.</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-black text-[#ccc] font-mono p-4 sm:p-12 space-y-12">
      <div className="border-b border-[#333] pb-6">
        <h1 className="text-4xl font-bold text-[#fff] tracking-widest uppercase">Shandabox Admin Terminal</h1>
        <p className="text-xl mt-2 text-[#888]">&gt; MANAGE MASTER REGISTRY</p>
      </div>

      {message && (
          <div className={`p-4 border font-bold text-xl ${message.includes('ERROR') ? 'border-red-500 text-red-500' : 'border-[#0f0] text-[#0f0]'}`}>
              {message}
          </div>
      )}

      <div className="grid md:grid-cols-2 gap-12">
        {/* CARD IMPORT */}
        <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase">&gt; Bulk Import CARDS</h2>
              <p className="text-sm text-[#888] mt-1">FORMAT: 5DigitCode, Exact Card Name (PINGING SCRYFALL)</p>
            </div>
            <textarea 
                className="w-full h-80 p-4 text-lg bg-[#111] border border-[#444] text-[#0f0] focus:border-[#fff] focus:ring-0 outline-none resize-y"
                placeholder={`12345, Lightning Bolt\n54321, Black Lotus`}
                value={cardCsv}
                onChange={e => setCardCsv(e.target.value)}
                disabled={loadingCards}
            />
            <button 
              onClick={handleCardImport} 
              disabled={!cardCsv.trim() || loadingCards} 
              className="w-full border-2 border-[#555] bg-[#222] hover:bg-[#fff] hover:text-black text-white p-4 text-xl uppercase font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loadingCards ? "&gt; PROCESSING..." : "&gt; EXECUTE IMPORT"}
            </button>
        </div>

        {/* BOSS IMPORT */}
        <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase">&gt; Bulk Import BOSSES</h2>
              <p className="text-sm text-[#888] mt-1">FORMAT: 5DigitCode, Boss Name (NO API PING)</p>
            </div>
            <textarea 
                className="w-full h-80 p-4 text-lg bg-[#111] border border-[#444] text-[#fa0] focus:border-[#fff] focus:ring-0 outline-none resize-y"
                placeholder={`99991, The Goblin King\n99992, Shadow Dragon`}
                value={bossCsv}
                onChange={e => setBossCsv(e.target.value)}
                disabled={loadingBosses}
            />
            <button 
              onClick={handleBossImport} 
              disabled={!bossCsv.trim() || loadingBosses} 
              className="w-full border-2 border-[#555] bg-[#222] hover:bg-[#fff] hover:text-black text-white p-4 text-xl uppercase font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loadingBosses ? "&gt; PROCESSING..." : "&gt; EXECUTE IMPORT"}
            </button>
        </div>
      </div>
    </div>
  );
}
