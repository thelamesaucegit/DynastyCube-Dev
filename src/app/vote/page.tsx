// src/app/vote/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getActivePolls, type PollWithOptions } from "@/app/actions/voteActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
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
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Sign In Required</h1>
            <p className="text-lg text-muted-foreground mb-4">You must be signed in to access the voting system.</p>
            <div className="mt-8 max-w-md mx-auto">
              <p className="font-bold mb-4">Why sign in?</p>
              <ul className="text-left space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Vote on cube changes and additions</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Participate in league decisions</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Access member-only features</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Track your voting history</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter polls by vote type
 const republicPolls = polls.filter((p) => p.vote_type === "republic" || p.vote_type === "league");
const blessingPolls = polls.filter((p) => p.vote_type === "blessing_event");
const teamPolls = polls.filter((p) => p.vote_type === "team");
const individualPolls = polls.filter((p) => p.vote_type === "individual"); // Separate them here

// Update default tab logic to include the new group
const defaultTab = republicPolls.length > 0 ? "republic" : 
                   individualPolls.length > 0 ? "individual" : 
                   blessingPolls.length > 0 ? "blessings" : "team";

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Community Voting</h1>
        <p className="text-muted-foreground text-lg">Vote on league rules, blessings, and team decisions.</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading polls...</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-6 flex-wrap h-auto">
             <TabsTrigger value="individual" className="gap-2">
    General Votes <Badge variant="secondary" className="ml-1 rounded-full">{individualPolls.length}</Badge>
  </TabsTrigger>
            <TabsTrigger value="republic" className="gap-2">
              League Rules <Badge variant="secondary" className="ml-1 rounded-full">{republicPolls.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="blessings" className="gap-2">
              Team Blessings <Badge variant="secondary" className="ml-1 rounded-full">{blessingPolls.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              Team Internal <Badge variant="secondary" className="ml-1 rounded-full">{teamPolls.length}</Badge>
            </TabsTrigger>
          </TabsList>
<TabsContent value="individual" className="space-y-6">
  {individualPolls.length === 0 ? (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <p>No active general votes at this time.</p>
      </CardContent>
    </Card>
  ) : (
    individualPolls.map((poll) => (
      {/* Ensure you use a generic vote card here. 
          If RepublicVoteCard works for standard votes, you can reuse it, 
          or create an <IndividualVoteCard /> */}
      <RepublicVoteCard key={poll.id} poll={poll} userId={user.id} onVoteSubmit={loadPolls} />
    ))
  )}
</TabsContent>
          <TabsContent value="republic" className="space-y-6">
            {republicPolls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No active league rule votes at this time.</p>
                </CardContent>
              </Card>
            ) : (
              republicPolls.map((poll) => (
                <RepublicVoteCard key={poll.id} poll={poll} userId={user.id} onVoteSubmit={loadPolls} />
              ))
            )}
          </TabsContent>

          <TabsContent value="blessings" className="space-y-6">
            {blessingPolls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No active team blessing events at this time.</p>
                </CardContent>
              </Card>
            ) : (
              blessingPolls.map((poll) => (
                <BlessingsAllocator key={poll.id} poll={poll} userId={user.id} onVoteSubmit={loadPolls} />
              ))
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            {teamPolls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No active team-specific votes at this time.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamPolls.map((poll) => (
                  <TeamPollCard 
                    key={poll.id} 
                    poll={poll} 
                    userId={user.id} 
                    isCaptain={false} // Note: Edit/Delete controls are kept on the Team Page, not the generic Voting Page
                    onVoteSubmit={loadPolls} 
                    onDelete={() => {}} 
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
