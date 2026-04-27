//src/app/components/admin/ChamberManagement.tsx

"use client";

import React, { useState } from "react";
import { importNextSetToChamber } from "@/app/actions/chamberActions";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { toast } from "sonner";

export const ChamberManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!confirm("This will import the next chronological set into The Chamber based on your records. Continue?")) {
      return;
    }
    setLoading(true);
    try {
      const result = await importNextSetToChamber();
      if (result.success) {
        toast.success(result.message, {
          description: result.importedSetName ? `Set: ${result.importedSetName}, Cards Added: ${result.cardsAdded}` : "No more sets to import.",
        });
      } else {
        toast.error("Import Failed", {
          description: result.message,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected client-side error occurred.";
      toast.error("A critical error occurred", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          🏛️ The Chamber Automation
        </CardTitle>
        <CardDescription>
          Manually trigger the import of the next scheduled set into The Chamber. This process is based on the `chamber_records` table.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Clicking this button will find the next set where `in_chamber` is false, fetch its cards from Scryfall according to the defined filter rules, calculate their Cubucks cost, and add them to `the_chamber` table.
        </p>
        <Button onClick={handleImport} disabled={loading}>
          {loading ? "Importing..." : "Run Next Chamber Import"}
        </Button>
      </CardContent>
    </Card>
  );
};
