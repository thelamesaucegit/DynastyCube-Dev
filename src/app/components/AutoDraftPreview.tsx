// src/app/components/AutoDraftPreview.tsx

"use client";

import React, { useState, useEffect } from "react";
import { getAutoDraftPreview, type AutoDraftPreviewResult, type AlgorithmDetails } from "@/app/actions/autoDraftActions";
import { getActiveDraftSession } from "@/app/actions/draftSessionActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/app/components/ui/collapsible";
import { Zap, ChevronDown, ChevronUp, Brain, Palette } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { getCardImageUrl } from "@/app/utils/cardUtils";

const COLOR_LABELS: Record<string, { label: string; emoji: string; className: string }> = {
  W: { label: "White", emoji: "⚪", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" },
  U: { label: "Blue", emoji: "🔵", className: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200" },
  B: { label: "Black", emoji: "⚫", className: "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-200" },
  R: { label: "Red", emoji: "🔴", className: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200" },
  G: { label: "Green", emoji: "🟢", className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200" },
};

interface AutoDraftPreviewProps {
  teamId: string;
  compact?: boolean;
  onManageQueue?: () => void;
  refreshKey?: number;
}

export function AutoDraftPreview({
  teamId,
  compact = false,
  onManageQueue,
  refreshKey = 0,
}: AutoDraftPreviewProps) {
  const { useOldestArt } = useSettings();
  const [preview, setPreview] = useState<AutoDraftPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

 useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, refreshKey]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { session, error: sessionErr } = await getActiveDraftSession();
      if (sessionErr || !session) {
        setPreview(null);
        setLoading(false);
        return;
      }
      
      const result = await getAutoDraftPreview(teamId, session.id);
      setPreview(result);
    } catch (error) {
      console.error("Error loading auto-draft preview:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
            <span>Computing auto-draft...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview || !preview.nextPick) {
    return null;
  }

  const card = preview.nextPick;
  const imageUrl = getCardImageUrl(card, useOldestArt);

  if (compact) {
    return (
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Zap className="size-4 text-purple-500" />
              <span className="font-semibold">Auto-Draft</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Next pick:</span>
              <span className="font-semibold">{card.card_name}</span>
              {card.cubecobra_elo && (
                <Badge variant="secondary" className="text-xs">
                  ELO {card.cubecobra_elo.toLocaleString()}
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-xs ml-auto">
              {preview.source === "manual_queue" ? "📌 From Queue" : "🧠 Algorithm"}
            </Badge>
            {onManageQueue && (
              <Button variant="ghost" size="sm" onClick={onManageQueue} className="text-xs">
                Manage Queue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-indigo-500/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-5 text-purple-500" />
          <h3 className="text-lg font-bold">Auto-Draft Pick</h3>
          <Badge variant="outline" className="text-xs ml-auto">
            {preview.source === "manual_queue" ? "📌 From Queue" : "🧠 Algorithm"}
          </Badge>
        </div>
        <div className="flex gap-4">
          {/* Card Image */}
          {imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={card.card_name}
              className="w-32 h-44 object-cover rounded-lg shadow-md flex-shrink-0"
            />
          )}
          {/* Card Details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-bold mb-1">{card.card_name}</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {card.card_type && (
                <Badge variant="secondary" className="text-xs">
                  {card.card_type}
                </Badge>
              )}
              {card.cubecobra_elo && (
                <Badge className="text-xs bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">
                  ELO {card.cubecobra_elo.toLocaleString()}
                </Badge>
              )}
              {card.cubucks_cost != null && (
                <Badge className="text-xs bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  💰 {card.cubucks_cost || 1}
                </Badge>
              )}
            </div>
            {/* Color Badges */}
            <div className="flex gap-1 mb-3">
              {card.colors && card.colors.length > 0 ? (
                card.colors.map((color) => {
                  const colorInfo = COLOR_LABELS[color];
                  return colorInfo ? (
                    <span
                      key={color}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorInfo.className}`}
                    >
                      {colorInfo.emoji} {colorInfo.label}
                    </span>
                  ) : null;
                })
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                  ◇ Colorless
                </span>
              )}
            </div>
            {preview.queueDepth > 0 && (
              <p className="text-xs text-muted-foreground">
                {preview.queueDepth} card{preview.queueDepth !== 1 ? "s" : ""} in manual queue
              </p>
            )}
            {onManageQueue && (
              <Button variant="outline" size="sm" onClick={onManageQueue} className="mt-2">
                <Palette className="size-3 mr-1" />
                Manage Queue
              </Button>
            )}
          </div>
        </div>
        {/* Algorithm Details (collapsible) */}
        {preview.algorithmDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-4 text-xs text-muted-foreground">
                <Brain className="size-3 mr-1" />
                Algorithm Details
                {detailsOpen ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <AlgorithmDetailsPanel details={preview.algorithmDetails} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function AlgorithmDetailsPanel({ details }: { details: AlgorithmDetails }) {
  // Use the new properties if available, fallback to legacy if somehow loaded from old cache
  const colorCounts = details.color_counts || details.teamDraftedColorCounts || { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const colorModifiers = details.color_modifiers || details.colorAffinityModifiers || { W: 1, U: 1, B: 1, R: 1, G: 1 };
  
  const baseElo = details.base_elo || 1000;
  const effectiveElo = details.effective_elo || baseElo;
  const multiplier = details.affinity_multiplier || (effectiveElo / baseElo);
  const isLand = details.is_land || false;
  const landPenalty = details.land_penalty || 1;

  return (
    <div className="mt-3 space-y-4 text-sm">
      {/* Team Color Counts & Modifiers */}
      <div>
        <h5 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Team Color Affinity
        </h5>
        <div className="space-y-2">
          {(["W", "U", "B", "R", "G"] as const).map((color) => {
            const count = colorCounts[color] || 0;
            const modifier = colorModifiers[color] || 1;
            const colorInfo = COLOR_LABELS[color];
            
            // Highlight the strongest color(s)
            const isDominant = modifier === Math.max(...Object.values(colorModifiers));

            return (
              <div key={color} className={`rounded p-2 flex items-center justify-between ${isDominant ? "bg-accent/50" : "bg-muted/30"}`}>
                <span className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${colorInfo.className}`}>
                     {colorInfo.emoji}
                  </span>
                  <span className={`font-medium ${isDominant ? "text-foreground" : "text-muted-foreground"}`}>
                    {colorInfo.label} ({count} drafted)
                  </span>
                </span>
                <span className={`text-xs font-mono font-bold ${modifier > 1 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  ×{modifier.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Math Breakdown */}
      <div>
        <h5 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Calculated ELO Breakdown
        </h5>
        <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg p-2 border border-border bg-muted/20">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Base ELO</div>
              <div className="font-medium">{Math.round(baseElo).toLocaleString()}</div>
            </div>
            
            <div className="rounded-lg p-2 border border-border bg-muted/20">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {isLand ? `Land Mod (×${landPenalty.toFixed(2)})` : "Affinity Mod"}
              </div>
              <div className={`font-medium ${multiplier > 1 ? "text-green-600 dark:text-green-400" : ""}`}>
                ×{multiplier.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg p-2 border border-purple-500/30 bg-purple-500/10">
              <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Final ELO</div>
              <div className="font-bold text-purple-700 dark:text-purple-300">
                {Math.round(effectiveElo).toLocaleString()}
              </div>
            </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        Analyzed Top 50 cards by raw ELO. Base multiplier +0.05 per drafted color (decaying by 0.99). Lands evaluate overlapping identities. Non-lands evaluate strictest casting cost.
      </p>
    </div>
  );
}
