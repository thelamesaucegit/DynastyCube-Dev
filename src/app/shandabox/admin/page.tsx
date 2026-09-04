// src/app/shandabox/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { verifyShandaboxAdmin, bulkImportCards, bulkImportBosses } from "@/app/actions/shandaboxActions";

export default function ShandaboxAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  // States
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
      setMessage("Importing cards... Scryfall API fetches may take a moment for large lists.");
      
      const result = await bulkImportCards(cardCsv);
      if (result.success) {
          setMessage(`✅ Successfully imported ${result.count} cards and fetched original artwork!`);
          setCardCsv("");
      } else {
          setMessage(`❌ Card Error: ${result.error}`);
      }
      setLoadingCards(false);
  };

  const handleBossImport = async () => {
      if (!bossCsv.trim()) return;
      setLoadingBosses(true);
      setMessage("Importing boss definitions...");
      
      const result = await bulkImportBosses(bossCsv);
      if (result.success) {
          setMessage(`✅ Successfully mapped ${result.count} Boss codes!`);
          setBossCsv("");
      } else {
          setMessage(`❌ Boss Error: ${result.error}`);
      }
      setLoadingBosses(false);
  };

  if (isAdmin === null) return <div className="p-20 text-center"><Loader2 className="size-10 animate-spin mx-auto text-muted-foreground" /></div>;

  if (isAdmin === false) {
      return (
          <div className="p-20 text-center space-y-4">
              <ShieldAlert className="size-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Unauthorized</h1>
              <p className="text-muted-foreground">You do not have Shandabox Administrator privileges.</p>
          </div>
      );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400">Shandabox Admin Panel</h1>
        <p className="text-muted-foreground">Manage the Master Registry</p>
      </div>

      {message && (
          <div className={`p-4 rounded-md font-bold text-sm shadow-sm ${message.includes('❌') ? 'bg-red-500/20 text-red-600 border border-red-500/50' : 'bg-green-500/20 text-green-600 border border-green-500/50'}`}>
              {message}
          </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* CARD IMPORT */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Bulk Import CARDS</CardTitle>
            <p className="text-xs text-muted-foreground">
                Format: <code>5DigitCode, Exact Card Name</code><br/>
                (Will ping Scryfall for art).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
              <textarea 
                  className="w-full h-64 p-4 font-mono text-sm rounded-md bg-muted/50 border border-border outline-none"
                  placeholder={`12345, Lightning Bolt\n54321, Black Lotus`}
                  value={cardCsv}
                  onChange={e => setCardCsv(e.target.value)}
                  disabled={loadingCards}
              />
              <Button onClick={handleCardImport} disabled={!cardCsv.trim() || loadingCards} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {loadingCards ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Import Cards
              </Button>
          </CardContent>
        </Card>

        {/* BOSS IMPORT */}
        <Card className="border-orange-500/20">
          <CardHeader>
            <CardTitle>Bulk Import BOSSES</CardTitle>
            <p className="text-xs text-muted-foreground">
                Format: <code>5DigitCode, Boss Name</code><br/>
                (Does not ping Scryfall).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
              <textarea 
                  className="w-full h-64 p-4 font-mono text-sm rounded-md bg-muted/50 border border-border outline-none"
                  placeholder={`99991, The Goblin King\n99992, Shadow Dragon`}
                  value={bossCsv}
                  onChange={e => setBossCsv(e.target.value)}
                  disabled={loadingBosses}
              />
              <Button onClick={handleBossImport} disabled={!bossCsv.trim() || loadingBosses} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                  {loadingBosses ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Import Bosses
              </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
