// src/app/components/team/TeamEssenceDisplay.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Sparkles, Info, Loader2 } from "lucide-react";
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
    <Card className="h-full border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 shadow-sm">
      <CardHeader className="pb-3 border-b border-purple-500/10">
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <Sparkles className="size-5" />
          Essence Matrix
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-6">
          
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Team Bank</p>
            <div className="text-4xl font-black text-purple-600 dark:text-purple-400 drop-shadow-sm flex items-center justify-center sm:justify-start gap-2">
              {data?.teamBank || 0} ✨
            </div>
          </div>

          {isUserTeamMember && (
            <div className="flex flex-col items-center sm:items-end gap-3 border-t sm:border-t-0 sm:border-l border-purple-500/20 pt-4 sm:pt-0 sm:pl-6">
              <div className="text-center sm:text-right">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Personal Balance</p>
                <p className="text-2xl font-bold text-foreground">{data?.personalBalance || 0} ✨</p>
              </div>
              
              <Button 
                onClick={handleClaim} 
                disabled={!data?.canClaim || claiming}
                className={`w-full sm:w-auto shadow-md ${data?.canClaim ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {claiming && <Loader2 className="size-4 animate-spin mr-2" />}
                {data?.canClaim ? "Claim Daily Essence" : `Next Claim in ${data?.timeUntilNextClaim}`}
              </Button>
            </div>
          )}

        </div>

        <div className="bg-background/60 rounded-lg p-4 text-sm text-muted-foreground border border-purple-500/10 flex gap-3 shadow-inner">
          <Info className="size-5 shrink-0 text-purple-500 mt-0.5" />
          <div className="space-y-2">
            <p><strong>Essence</strong> is a mystical currency used at the Marketplace to alter the rules of the league and unlock lore.</p>
            <p>Every day, team members can claim <strong>1 Base Essence</strong>. If the Team Bank has Essence stored inside it, you will automatically drain 1 from the Team Bank to claim an <strong>Additional Bonus Essence</strong> for yourself!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
