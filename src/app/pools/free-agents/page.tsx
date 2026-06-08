// src/app/pools/free-agents/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { DraftInterface } from "@/app/components/DraftInterface";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTeam } from "@/app/actions/teamActions";
import { getCurrentSeason } from "@/app/actions/seasonPhaseActions"; // <-- NEW IMPORT
import { Loader2, AlertCircle, Info } from "lucide-react";
import type { Team } from "@/app/actions/teamActions";

export default function FreeAgentsPage() {
  const { user } = useAuth();
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [isFreeAgencyActive, setIsFreeAgencyActive] = useState(false); // <-- NEW STATE
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        // 1. Fetch current season details to restrict free agency phase-wise
        const seasonResult = await getCurrentSeason();
        const currentPhase = seasonResult.season?.phase || null;
        setIsFreeAgencyActive(currentPhase === "season");

        // 2. Fetch user team if authenticated
        if (!user?.email) {
          setLoading(false);
          return;
        }

        const { team, error: teamError } = await getUserTeam(user.email);
        if (teamError) {
          setError(teamError);
        }
        setUserTeam(team);
      } catch (err) {
        setError("An unexpected error occurred while finding your team.");
      } finally {
        setLoading(false);
      }
    };
    fetchPageData();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Free Agents</h1>
        <p className="text-muted-foreground text-lg">
          Claim un-bid-on cards for a flat cost of 1 Çubuck. First come, first served.
        </p>

        {/* Informational banner when acquisitions are locked */}
        {!isFreeAgencyActive && (
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-3 shadow-sm">
            <Info className="h-5 w-5 shrink-0" />
            <span>Free Agency acquisitions are currently closed. Transactions are only enabled during the active Season phase.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 mb-4 text-center text-destructive-foreground bg-destructive rounded-lg shadow-md">
          <AlertCircle className="inline-block h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <DraftInterface 
        teamId={userTeam?.id || ""} 
        teamName={userTeam?.name} 
        isUserTeamMember={!!userTeam} 
        onDraftComplete={() => {}} 
        isFreeAgencyEnabled={isFreeAgencyActive} // <-- BIND TO CORRECT ACTIVE STATE
      />
    </div>
  );
}
