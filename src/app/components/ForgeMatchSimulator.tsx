// src/app/components/admin/ForgeMatchSimulator.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Swords, Wand, Bot, ArrowRight } from 'lucide-react';
import { getAiProfiles } from '@/app/actions/adminActions'; // We will create this action file next

// Define the shape of an AI profile from our new Supabase table
export interface AiProfile {
  id: string;
  profile_name: string;
  description?: string;
}

export function ForgeMatchSimulator() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  const [player1, setPlayer1] = useState({ decklist: '', deckName: 'Player 1 Deck', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: 'Player 2 Deck', aiProfile: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfiles() {
      try {
        const fetchedProfiles = await getAiProfiles();
        setProfiles(fetchedProfiles);
      } catch (err) {
        setError('Failed to load AI profiles from the database.');
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const handleSimulate = () => {
    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist || !player2.decklist) {
      setError('Please select an AI profile and provide a decklist for both players.');
      return;
    }

    // Encode the match details into URL query parameters
    const query = new URLSearchParams({
      p1_deck: player1.decklist,
      p1_name: player1.deckName,
      p1_ai: player1.aiProfile,
      p2_deck: player2.decklist,
      p2_name: player2.deckName,
      p2_ai: player2.aiProfile,
    });

    // Navigate to the new live match view page
    router.push(`/admin/match-viewer?${query.toString()}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Wand className="size-5" />
          Forge Match Simulator
        </CardTitle>
        <CardDescription>
          Manually create a match between two AI players with custom decklists to view in the live simulator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player 1 Controls */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2"><Bot className="size-4" /> Player 1</h3>
            <div className="space-y-2">
              <Label htmlFor="p1-deck-name">Deck Name</Label>
              <Input
                id="p1-deck-name"
                value={player1.deckName}
                onChange={(e) => setPlayer1({ ...player1, deckName: e.target.value })}
                placeholder="Enter deck name for Player 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p1-profile">AI Profile</Label>
              <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                <SelectTrigger id="p1-profile">
                  <SelectValue placeholder="Select AI Profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p1-decklist">Decklist</Label>
              <Textarea
                id="p1-decklist"
                value={player1.decklist}
                onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })}
                placeholder="1 Black Lotus&#10;4 Sol Ring&#10;55 Swamp"
                className="h-48 font-mono text-xs"
              />
            </div>
          </div>

          {/* Player 2 Controls */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2"><Bot className="size-4" /> Player 2</h3>
            <div className="space-y-2">
              <Label htmlFor="p2-deck-name">Deck Name</Label>
              <Input
                id="p2-deck-name"
                value={player2.deckName}
                onChange={(e) => setPlayer2({ ...player2, deckName: e.target.value })}
                placeholder="Enter deck name for Player 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2-profile">AI Profile</Label>
              <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                <SelectTrigger id="p2-profile">
                  <SelectValue placeholder="Select AI Profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2-decklist">Decklist</Label>
              <Textarea
                id="p2-decklist"
                value={player2.decklist}
                onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })}
                placeholder="1 Ancestral Recall&#10;4 Counterspell&#10;55 Island"
                className="h-48 font-mono text-xs"
              />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSimulate} disabled={loading}>
            <Swords className="size-4 mr-2" />
            Simulate Match
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
