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
    .map(cardName => `1 ${cardName}`)
    .join('\n');
  return `[metadata]\nName=${deckName}\n\n[Main]\n${mainDeck}`;
}

export default function MatchRunnerPage() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  const [player1, setPlayer1] = useState({ decklist: '', deckName: 'Player 1 Deck', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: 'Player 2 Deck', aiProfile: '' });
  
  // State for the entire process
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
      } catch (err) {
        setError('Failed to load AI profiles.');
      }
    }
    loadProfiles();
  }, []);

  const handleSimulate = async () => {
    // Reset errors on each attempt
    setError(null);
    setValidationError(null);

    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist || !player2.decklist) {
      setError('Please provide a decklist and AI profile for both players.');
      return;
    }

    setIsValidating(true);

    // --- Validation Step ---
    const allCardNames = [...player1.decklist.split('\n'), ...player2.decklist.split('\n')];
    const { valid, invalid } = await validateAndCanonicalizeDeck(allCardNames);

    if (invalid.length > 0) {
      setValidationError(`The following card names were not found in the card pool: ${invalid.join(', ')}. Please correct them.`);
      setIsValidating(false);
      return;
    }

    setIsValidating(false);
    setIsSimulating(true);
    setStatusMessage('Validation successful. Submitting match to simulation server...');

    // Rebuild decklists with the corrected, canonical capitalization
    const correctedDeck1 = player1.decklist.split('\n').map(name => valid.get(name.trim().toLowerCase()) || name).join('\n');
    const correctedDeck2 = player2.decklist.split('\n').map(name => valid.get(name.trim().toLowerCase()) || name).join('\n');

    const deck1Filename = player1.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    const deck2Filename = player2.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    
    // --- Simulation Step ---
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
        throw new Error(errorData.error || 'Failed to start simulation on the server.');
      }
      
      const { matchId } = await response.json();
      if (!matchId) throw new Error("API did not return a valid match ID.");

      setStatusMessage(`Simulation started with ID: ${matchId}. Waiting for completion...`);
      
      const poll = setInterval(async () => {
        // ... (polling logic remains the same) ...
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
    // ... (isSimulating UI remains the same) ...
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Swords /> Forge Match Simulator</CardTitle>
        <CardDescription>Enter two decklists to simulate a match. Card names will be validated and canonicalized against the card pool.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player 1 & 2 sections remain the same */}
        </div>

        {/* Display Validation or Simulation Errors */}
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
            <><Hourglass className="size-4 mr-2 animate-spin" /> Validating Decklists...</>
          ) : (
            <><ShieldCheck className="size-4 mr-2" /> Validate & Simulate Match</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
