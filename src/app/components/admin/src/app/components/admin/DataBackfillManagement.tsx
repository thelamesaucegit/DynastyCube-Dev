// src/app/components/admin/DataBackfillManagement.tsx
"use client";

import React, { useState } from "react";
import { backfillAllCMCData, backfillColorIdentity } from "@/app/actions/adminActions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export const DataBackfillManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleBackfillCMC = async () => {
    setLoading(true);
    setResult("Starting CMC backfill for all pools and picks...");
    try {
      const res = await backfillAllCMCData();
      if (res.success) {
        setResult(`✅ CMC Backfill Complete!\nPools Updated: ${res.cardPoolsUpdated}\nPicks Updated: ${res.draftPicksUpdated}\nFailed: ${res.totalFailed}\nErrors: ${res.errors.join(", ")}`);
      } else {
        setResult(`❌ CMC Backfill Failed.\nErrors: ${res.errors.join(", ")}`);
      }
    } catch (err) {
      setResult(`❌ An unexpected error occurred: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackfillIdentity = async () => {
    setLoading(true);
    setResult("Starting Color Identity backfill for the card pool...");
    try {
      const result = await backfillColorIdentity();
      if (result.success) {
        setResult(`✅ Color Identity Backfill Complete!\nUpdated: ${result.updated}\nFailed: ${result.failed}\nErrors: ${result.errors.join(", ")}`);
      } else {
        setResult(`❌ Color Identity Backfill Failed.\nErrors: ${result.errors.join(", ")}`);
      }
    } catch (err) {
      setResult(`❌ An unexpected error occurred: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          ⚙️ Data Backfill & Maintenance
        </CardTitle>
        <CardDescription>
          Run one-time operations to update missing data for cards in the pool. 
          This is useful after importing new cards or changing the database schema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg bg-background">
          <h4 className="font-semibold mb-2">Backfill CMC Data</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Scans all cards in `card_pools` and `team_draft_picks` and fetches their Converted Mana Cost (CMC) from Scryfall if it's missing.
          </p>
          <Button onClick={handleBackfillCMC} disabled={loading}>
            {loading ? "Running..." : "Run CMC Backfill"}
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-background">
          <h4 className="font-semibold mb-2">Backfill Color Identity Data</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Scans all cards in `card_pools` and populates the `color_identity` field from Scryfall. This is required for the enhanced autodraft algorithm.
          </p>
          <Button onClick={handleBackfillIdentity} disabled={loading}>
            {loading ? "Running..." : "Run Color Identity Backfill"}
          </Button>
        </div>

        {result && (
          <pre className="mt-4 bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap font-mono">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
