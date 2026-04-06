// src/app/components/AutoDraftPreview.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAutoDraftPreview, type AutoDraftPreviewResult, type AlgorithmDetails } from "@/app/actions/autoDraftActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/app/components/ui/collapsible";
import { Zap, ChevronDown, ChevronUp, Brain, Palette } from "lucide-react";

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
      const result = await getAutoDraftPreview(teamId);
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
          {card.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.image_url}
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
  const maxTotal = Math.max(...Object.values(details.colorTotals), 1);

  return (
    <div className="mt-3 space-y-4 text-sm">
      {/* Color ELO Totals */}
      <div>
        <h5 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Color ELO Totals (Top 50 Cards)
        </h5>
        <div className="space-y-2">
          {(["W", "U", "B", "R", "G"] as const).map((color) => {
            const total = details.colorTotals[color] || 0;
            const modifier = details.colorAffinityModifiers[color] || 1;
            const isDominant = color === details.dominantColor;
            const colorInfo = COLOR_LABELS[color];
            const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

            return (
              <div key={color} className={`rounded p-2 ${isDominant ? "bg-accent" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1">
                    <span>{colorInfo.emoji}</span>
                    <span className={`font-medium ${isDominant ? "text-foreground" : "text-muted-foreground"}`}>
                      {colorInfo.label}
                    </span>
                    {isDominant && (
                      <Badge className="text-[10px] px-1 py-0 bg-purple-500/15 text-purple-600 dark:text-purple-400">
                        Dominant
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(total).toLocaleString()}
                    {modifier > 1 && (
                      <span className="text-green-600 dark:text-green-400 ml-1">
                        ×{modifier.toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isDominant ? "bg-purple-500" : "bg-muted-foreground/30"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Color Affinity */}
      <div>
        <h5 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Drafted Cards by Color
        </h5>
        <div className="flex flex-wrap gap-2">
          {(["W", "U", "B", "R", "G"] as const).map((color) => {
            const count = details.teamDraftedColorCounts[color] || 0;
            const colorInfo = COLOR_LABELS[color];
            return (
              <span
                key={color}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${colorInfo.className}`}
              >
                {colorInfo.emoji} {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Best Picks Comparison */}
      <div>
        <h5 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Pick Decision
        </h5>
        <div className="grid grid-cols-2 gap-2">
          {details.bestColoredCard && (
            <div className={`rounded-lg p-2 border ${details.selectedSource === "colored" ? "border-green-500/40 bg-green-500/5" : "border-border"}`}>
              <div className="text-xs text-muted-foreground mb-1">Best Colored</div>
              <div className="font-medium text-sm">{details.bestColoredCard.cardName}</div>
              <div className="text-xs text-muted-foreground">
                ELO: {details.bestColoredCard.elo.toLocaleString()} ({COLOR_LABELS[details.bestColoredCard.color]?.emoji} {COLOR_LABELS[details.bestColoredCard.color]?.label})
              </div>
              {details.selectedSource === "colored" && (
                <Badge className="text-[10px] mt-1 bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
                  Selected
                </Badge>
              )}
            </div>
          )}
          {details.bestColorlessCard && (
            <div className={`rounded-lg p-2 border ${details.selectedSource === "colorless" ? "border-green-500/40 bg-green-500/5" : "border-border"}`}>
              <div className="text-xs text-muted-foreground mb-1">Best Colorless</div>
              <div className="font-medium text-sm">{details.bestColorlessCard.cardName}</div>
              <div className="text-xs text-muted-foreground">
                ELO: {details.bestColorlessCard.elo.toLocaleString()}
              </div>
              {details.selectedSource === "colorless" && (
                <Badge className="text-[10px] mt-1 bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
                  Selected
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Analyzed {details.top50CardIds.length} top ELO cards. Color modifier: ×1.01 per drafted card in that color.
      </p>
    </div>
  );
}
