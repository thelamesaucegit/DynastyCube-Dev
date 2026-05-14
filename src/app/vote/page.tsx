// src/app/vote/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getActivePolls, type PollWithOptions } from "@/app/actions/voteActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Loader2, Lock, Check } from "lucide-react";
import { RepublicVoteCard } from "@/app/components/vote/RepublicVoteCard";
import { BlessingsAllocator } from "@/app/components/vote/BlessingsAllocator";
import { TeamPollCard } from "@/app/components/team/TeamPollCard";

export default function VotePage() {
  const { user, loading: authLoading } = useAuth();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      loadPolls();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const result = await getActivePolls(user?.id);
      if (result.success && result.polls) {
        setPolls(result.polls as PollWithOptions[]);
      }
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
        <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">Sign In Required</h1>
        <p className="text-muted-foreground">You must be signed in to access the voting system.</p>
      </div>
    );
  }

  const republicPolls = polls.filter((p) => p.vote_type === "republic" || p.vote_type === "league");
  const blessingPolls = polls.filter((p) => p.vote_type === "blessing_event");
  const teamPolls = polls.filter((p) => p.vote_type === "team" || p.vote_type === "individual");

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Community Voting</h1>
        <p className="text-muted-foreground text-lg">Vote on league rules, blessings, and team decisions.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="republic" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="republic">League Rules ({republicPolls.length})</TabsTrigger>
            <TabsTrigger value="blessings">Team Blessings ({blessingPolls.length})</TabsTrigger>
            <TabsTrigger value="team">Team Internal ({teamPolls.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="republic" className="space-y-6">
            {republicPolls.length === 0 ? (
              <p className="text-muted-foreground">No active league rule votes.</p>
            ) : (
              republicPolls.map((poll) => (
                <RepublicVoteCard key={poll.id} poll={poll} userId={user.id} onVoteSubmit={loadPolls} />
              ))
            )}
          </TabsContent>

          <TabsContent value="blessings" className="space-y-6">
            {blessingPolls.length === 0 ? (
              <p className="text-muted-foreground">No active blessing events.</p>
            ) : (
              blessingPolls.map((poll) => (
                <BlessingsAllocator key={poll.id} poll={poll} userId={user.id} onVoteSubmit={loadPolls} />
              ))
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            {teamPolls.length === 0 ? (
              <p className="text-muted-foreground">No active team-specific votes.</p>
            ) : (
              teamPolls.map((poll) => (
                <TeamPollCard 
                   key={poll.id} 
                   poll={poll} 
                   userId={user.id} 
                   isCaptain={false} 
                   onVoteSubmit={loadPolls} 
                   onDelete={() => {}} 
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
