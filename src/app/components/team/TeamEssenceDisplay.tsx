// src/app/components/team/TeamEssenceDisplay.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Info, Loader2 } from "lucide-react";
import { getEssenceData, claimDailyEssence, type EssenceData } from "@/app/actions/essenceActions";
import { toast } from "sonner";

interface Props {
  teamId: string;
  isUserTeamMember: boolean;
}

export function TeamEssenceDisplay({ teamId, isUserTeamMember }: Props) {
  const [data, setData] = useState<EssenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchEssence = async () => {
    const result = await getEssenceData(teamId);
    if (result.success && result.data) {
      setData(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEssence();
  }, [teamId]);

  const handleClaim = async () => {
    setClaiming(true);
    const result = await claimDailyEssence(teamId);
    if (result.success) {
      toast.success(result.message);
      await fetchEssence(); // Refresh data
    } else {
      toast.error(result.error);
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center p-6 border-purple-500/20 bg-purple-500/5">
        <Loader2 className="animate-spin text-purple-500" />
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 shadow-sm">
      <CardHeader className="py-2.5 sm:py-3 border-b border-purple-500/10">
        <CardTitle className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider font-extrabold text-purple-700 dark:text-purple-400">
          <span className="text-base">€</span>
          Essence
        </CardTitle>
      </CardHeader>
      
      {/* 
        THE FIX: Responsive layouts and paddings. 
        - Mobile: p-3 (half size reduction)
        - Desktop: max-h-[300px] with compressed spacing (30% shorter)
      */}
      <CardContent className="p-3 sm:p-5 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 mb-3 sm:mb-4">
          
          <div className="text-center sm:text-left">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Team Essence Bank</p>
            <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 drop-shadow-sm flex items-center justify-center sm:justify-start gap-1">
              {data?.teamBank || 0} <span className="font-semibold">€</span>
            </div>
          </div>

          {isUserTeamMember && (
            <div className="flex flex-col items-center sm:items-end gap-2 border-t sm:border-t-0 sm:border-l border-purple-500/20 pt-2 sm:pt-0 sm:pl-5 w-full sm:w-auto">
              <div className="text-center sm:text-right">
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Your Essence</p>
                <p className="text-lg sm:text-xl font-bold text-foreground">{data?.personalBalance || 0} €</p>
              </div>
              
              <Button 
                onClick={handleClaim} 
                disabled={!data?.canClaim || claiming}
                className={`w-full sm:w-auto h-8 sm:h-9 text-xs shadow-md ${data?.canClaim ? 'bg-purple-600 hover:bg-purple-700 text-white font-bold' : 'bg-muted text-muted-foreground'}`}
              >
                {claiming && <Loader2 className="size-3 animate-spin mr-1.5" />}
                {data?.canClaim ? "Claim Daily Essence" : `Claim in ${data?.timeUntilNextClaim}`}
              </Button>
            </div>
          )}
        </div>

        {/* Info Banner - Compressed for spacing */}
        <div className="bg-background/60 rounded-lg p-2.5 sm:p-3 text-[11px] sm:text-xs text-muted-foreground border border-purple-500/10 flex gap-2.5 shadow-inner">
          <Info className="size-4 shrink-0 text-purple-500 mt-0.5" />
          <div className="space-y-1">
            <p><strong>Essence</strong> is a currency used to alter <strong>THE CUBE</strong>.</p>
            <p className="hidden sm:block">Claim <strong>1 €</strong> daily. Stored team essence grants you an <strong>Additional Bonus €</strong>!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
