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
import { Swords, Hourglass, ShieldCheck, ShieldX } from 'lucide-react';
import { getAiProfiles, AiProfile, validateAndCanonicalizeDeck } from '@/app/actions/adminActions';

function formatDecklistToDck(decklist: string, deckName: string): string {
  const mainDeck = decklist
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      // This regex correctly checks if a line starts with one or more digits followed by a space
      if (/^\d+\s/.test(line)) {
        return line;
      }
      return `1 ${line}`;
    })
    .join('\n');
  return `[metadata]\nName=${deckName}\n\n[Main]\n${mainDeck}`;
}


export default function MatchRunnerPage() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  const [player1, setPlayer1] = useState({ decklist: '', deckName: 'Player 1 Deck', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: 'Player 2 Deck', aiProfile: '' });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const router = useRouter();

  useEffect(() => {
    async function loadProfiles() {
      try {
        const fetchedProfiles = await getAiProfiles();
        setProfiles(fetchedProfiles);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        setError(`Failed to load AI profiles: ${message}`);
      }
    }
    loadProfiles();
  }, []);

  const handleSimulate = async () => {
    setError(null);
    setValidationError(null);

    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist || !player2.decklist) {
      setError('Please provide a decklist and AI profile for both players.');
      return;
    }

    setIsValidating(true);

    // --- THE FIX IS HERE: Use a regex literal in .replace() to correctly strip numbers ---
    const allCardNames = [...player1.decklist.split('\n'), ...player2.decklist.split('\n')]
      .map(line => line.trim().replace(/^\d+\s/, '')); // e.g., "25 Mountain" becomes "Mountain"

    const { valid, invalid } = await validateAndCanonicalizeDeck(allCardNames);

    if (invalid.length > 0) {
      setValidationError(`The following card names were not found: ${invalid.join(', ')}. Please correct them.`);
      setIsValidating(false);
      return;
    }

    setIsValidating(false);
    setIsSimulating(true);
    setStatusMessage('Validation successful. Submitting match...');

    // --- THE SECOND FIX IS HERE: Rebuild decklists using the canonical names ---
    const buildCorrectedDeck = (decklist: string) => {
      return decklist.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null; // Skip empty lines

        const match = trimmed.match(/^(\d+)\s(.+)/);
        const cardName = match ? match[2] : trimmed;
        const count = match ? match[1] : '1';
        
        // Use lowercase for map lookup, as keys are lowercase
        const canonicalName = valid.get(cardName.toLowerCase());

        return canonicalName ? `${count} ${canonicalName}` : line; // Fallback to original line if something unexpected happens
      }).filter(Boolean).join('\n');
    };

    const correctedDeck1 = buildCorrectedDeck(player1.decklist);
    const correctedDeck2 = buildCorrectedDeck(player2.decklist);

    const deck1Filename = player1.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    const deck2Filename = player2.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    
    try {
      const response = await fetch('/api/match-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck1: { filename: deck1Filename, content: formatDecklistToDck(correctedDeck1, player1.deckName), aiProfile: player1.aiProfile },
          deck2: { filename: deck2Filename, content: formatDecklistToDck(correctedDeck2, player2.deckName), aiProfile: player2.aiProfile },
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start simulation.');
      }
      
      const { matchId } = await response.json();
      if (!matchId) throw new Error("API did not return a valid match ID.");

      setStatusMessage(`Simulation started with ID: ${matchId}. Waiting for completion...`);
      
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/match-runner/${matchId}`);
          if (!statusRes.ok) return;

          const { winner } = await statusRes.json();
          
          if (winner) {
            clearInterval(poll);
            setStatusMessage(`Match complete! Winner: ${winner}. Redirecting to replay...`);
            router.push(`/admin/match-viewer/${matchId}`);
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
        }
      }, 5000);

    } catch (err: unknown) {
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
        <CardDescription>Enter two decklists. You can specify a count (e.g., &quot;25 Mountain&quot;) or enter one card name per line.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Label htmlFor="p1_deck_name">Player 1 Deck Name</Label>
                <Input id="p1_deck_name" value={player1.deckName} onChange={(e) => setPlayer1({ ...player1, deckName: e.target.value })} />
                <Label className="mt-4 block">Player 1 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-4 block" htmlFor="p1_decklist">Player 1 Decklist</Label>
                <Textarea id="p1_decklist" placeholder="25 Mountain&#10;15 Lightning Bolt" value={player1.decklist} onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })} className="h-48"/>
            </div>
            <div>
                <Label htmlFor="p2_deck_name">Player 2 Deck Name</Label>
                <Input id="p2_deck_name" value={player2.deckName} onChange={(e) => setPlayer2({ ...player2, deckName: e.target.value })} />
                <Label className="mt-4 block">Player 2 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-4 block" htmlFor="p2_decklist">Player 2 Decklist</Label>
                <Textarea id="p2_decklist" placeholder="25 Plains&#10;15 Savannah Lions" value={player2.decklist} onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })} className="h-48"/>
            </div>
        </div>

        {validationError && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md flex items-start gap-3">
            <ShieldX className="size-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold">Validation Failed</h4>
              <p className="text-sm">{validationError}</p>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button onClick={handleSimulate} disabled={isValidating || isSimulating}>
          {isValidating ? (
            <><Hourglass className="size-4 mr-2 animate-spin" /> Validating...</>
          ) : isSimulating ? (
            <><Hourglass className="size-4 mr-2 animate-spin" /> Simulating...</>
          ) : (
            <><ShieldCheck className="size-4 mr-2" /> Validate & Simulate Match</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
