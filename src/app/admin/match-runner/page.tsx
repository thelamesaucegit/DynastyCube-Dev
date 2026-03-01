// src/app/admin/match-runner/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Swords, Bot, Hourglass } from 'lucide-react';
import { getAiProfiles, AiProfile } from '@/app/actions/adminActions';

function formatDecklistToDck(decklist: string, deckName: string): string {
  return `[metadata]\nName=${deckName}\n\n[Main]\n${decklist}`;
}

export default function MatchRunnerPage() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  const [player1, setPlayer1] = useState({ decklist: '', deckName: 'Player 1 Deck', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: 'Player 2 Deck', aiProfile: '' });
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadProfiles() {
      try {
        const fetchedProfiles = await getAiProfiles();
        setProfiles(fetchedProfiles);
      } catch (err) {
        setError('Failed to load AI profiles.');
      }
    }
    loadProfiles();
  }, []);

  const handleSimulate = async () => {
    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist || !player2.decklist) {
      setError('Please provide a decklist and AI profile for both players.');
      return;
    }
    setIsSimulating(true);
    setError(null);
    setStatusMessage('Submitting match to simulation server...');

    const deck1Filename = player1.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    const deck2Filename = player2.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    
    try {
      const response = await fetch('/api/match-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck1: { filename: deck1Filename, content: formatDecklistToDck(player1.decklist, player1.deckName), aiProfile: player1.aiProfile },
          deck2: { filename: deck2Filename, content: formatDecklistToDck(player2.decklist, player2.deckName), aiProfile: player2.aiProfile },
        })
      });

      if (!response.ok) throw new Error('Failed to start simulation on the server.');
      
      const { matchId } = await response.json();
      setStatusMessage(`Simulation started with ID: ${matchId}. Waiting for completion...`);

      const poll = setInterval(async () => {
        const statusRes = await fetch(`/api/match-runner/${matchId}`);
        const { winner } = await statusRes.json();
        
        if (winner) {
          clearInterval(poll);
          setStatusMessage(`Match complete! Winner: ${winner}. Redirecting to replay...`);
          router.push(`/admin/match-viewer/${matchId}`);
        }
      }, 5000);

    } catch (err: unknown) { // FIX: Use 'unknown' instead of 'any'
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
      setIsSimulating(false);
    }
  };
  
  if (isSimulating) {
    return (
        <Card className="max-w-2xl mx-auto mt-10">
            <CardHeader className="text-center">
                <Hourglass className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                <CardTitle>Simulation in Progress</CardTitle>
                <CardDescription>{statusMessage}</CardDescription>
                {error && <p className="text-red-500 mt-4">{error}</p>}
            </CardHeader>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Swords /> Forge Match Simulator</CardTitle>
        <CardDescription>Create a match and record the results to the database for later viewing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simplified form structure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player 1 */}
            <div>
                <Label>Player 1 Deck Name</Label>
                <Input value={player1.deckName} onChange={(e) => setPlayer1({ ...player1, deckName: e.target.value })} />
                <Label>Player 1 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label>Player 1 Decklist</Label>
                <Textarea value={player1.decklist} onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })} />
            </div>
            {/* Player 2 */}
            <div>
                <Label>Player 2 Deck Name</Label>
                <Input value={player2.deckName} onChange={(e) => setPlayer2({ ...player2, deckName: e.target.value })} />
                <Label>Player 2 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label>Player 2 Decklist</Label>
                <Textarea value={player2.decklist} onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })} />
            </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={handleSimulate}>Simulate Match</Button>
      </CardContent>
    </Card>
  );
}
