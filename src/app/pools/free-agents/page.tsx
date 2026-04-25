//src/app/pools/free-agents/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { DraftInterface } from "@/app/components/DraftInterface";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTeam } from "@/app/actions/teamActions"; // We will use this action
import { Loader2, AlertCircle } from "lucide-react";
import type { Team } from "@/app/actions/teamActions"; // Import the Team type

export default function FreeAgentsPage() {
  const { user } = useAuth();
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This effect runs once when the component mounts to find the user's team.
    const fetchUserTeam = async () => {
      if (!user?.email) {
        setLoading(false);
        // User is not logged in, they can view but not interact.
        return;
      }

      try {
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

    fetchUserTeam();
  }, [user]); // Re-run if the user object changes (e.g., on login)

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
      </div>

      {error && (
        <div className="p-4 mb-4 text-center text-destructive-foreground bg-destructive rounded-lg">
          <AlertCircle className="inline-block h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* 
        If the user is not on a team, the DraftInterface will still render in a 
        read-only state, which is good UX. They can see the free agents but can't claim them.
      */}
      <DraftInterface
        teamId={userTeam?.id || ""} // Pass the team ID, or an empty string if no team
        teamName={userTeam?.name}
        isUserTeamMember={!!userTeam}
        onDraftComplete={
            () => { 
                // We might want to add a success message or refresh the page after a claim.
                // For now, the component handles its own refresh internally.
            }
        }
        isFreeAgencyEnabled={true} // This is the Free Agents page, so this is always true.
      />
    </div>
  );
}
