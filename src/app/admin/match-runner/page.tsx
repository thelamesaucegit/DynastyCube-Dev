// src/app/admin/match-runner/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Swords, Hourglass, ShieldCheck, ShieldX, Trophy } from 'lucide-react';
import { getAiProfiles, validateAndCanonicalizeDeck } from '@/app/actions/adminActions';
// --- MODIFIED: Import action to get all teams ---
import { getAllTeams } from '@/app/actions/teamActions';

// --- MODIFIED: Added interface for Teams ---
interface Team {
  id: string;
  name: string;
  emoji: string;
}

interface AiProfile {
  id:string;
  profile_name: string;
}

function formatDecklistToDck(decklist: string, deckName: string): string {
  return `[metadata]\nName=${deckName}\n\n[Main]\n${decklist}`;
}

export default function MatchRunnerPage() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  // --- MODIFIED: State for teams and selected team IDs ---
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');

  const [player1, setPlayer1] = useState({ decklist: '', deckName: '', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: '', aiProfile: '' });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function loadInitialData() {
      try {
        // --- MODIFIED: Fetch both AI profiles and teams ---
        const [aiResult, teamResult] = await Promise.all([
          getAiProfiles(),
          getAllTeams()
        ]);
        setProfiles(aiResult);
        if (teamResult.teams) {
          setTeams(teamResult.teams);
        }
      } catch (err: unknown) {
        let message = "An unknown error occurred";
        if (err instanceof Error) message = err.message;
        setError(`Failed to load initial page data: ${message}`);
      }
    }
    loadInitialData();
  }, []);

  const handleSimulate = async () => {
    setError(null);
    setValidationError(null);

    // --- MODIFIED: Added new validation checks ---
    if (!team1Id || !team2Id) {
      setError('Please select a team for both players.');
      return;
    }
    if (!player1.deckName || !player2.deckName) {
        setError('Please provide a deck name for both players.');
        return;
    }
    if (/\s/.test(player1.deckName) || /\s/.test(player2.deckName)) {
        setError('Deck names must be a single word (no spaces).');
        return;
    }
    if (player1.deckName.toLowerCase() === player2.deckName.toLowerCase()) {
        setError('Deck names must be unique for the match.');
        return;
    }
    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist || !player2.decklist) {
      setError('Please provide a decklist and AI profile for both players.');
      return;
    }

    setIsValidating(true);
    setStatusMessage('Validating decklists...');
    const allCardNames = [...player1.decklist.split('\n'), ...player2.decklist.split('\n')]
      .map(line => line.trim().replace(/^\d+\s/, ''));
    const { valid, invalid } = await validateAndCanonicalizeDeck(allCardNames);
    if (invalid.length > 0) {
      setValidationError(`The following card names were not found: ${invalid.join(', ')}. Please correct them.`);
      setIsValidating(false);
      return;
    }
    setIsValidating(false);
    setIsSimulating(true);
    setStatusMessage('Validation successful. Submitting match...');
    const buildCorrectedDeckList = (decklist: string): string => {
      return decklist.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const match = trimmed.match(/^(\d+)\s+(.+)/);
        const cardName = match ? match[2] : trimmed;
        const count = match ? match[1] : '1';
        const canonicalName = valid.get(cardName.toLowerCase());
        return canonicalName ? `${count} ${canonicalName}` : line;
      }).filter(Boolean).join('\n');
    };
    
    const correctedDeck1List = buildCorrectedDeckList(player1.decklist);
    const correctedDeck2List = buildCorrectedDeckList(player2.decklist);
    const deck1Filename = player1.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    const deck2Filename = player2.deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
    
    try {
      const response = await fetch('/api/match-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- MODIFIED: Pass team IDs in the body ---
        body: JSON.stringify({
          deck1: { filename: deck1Filename, content: formatDecklistToDck(correctedDeck1List, player1.deckName), aiProfile: player1.aiProfile },
          deck2: { filename: deck2Filename, content: formatDecklistToDck(correctedDeck2List, player2.deckName), aiProfile: player2.aiProfile },
          team1Id: team1Id,
          team2Id: team2Id,
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
          const { winner, isReplayReady } = await statusRes.json();
          
          if (winner && isReplayReady) {
            clearInterval(poll);
            setStatusMessage(`Match complete! Winner: ${winner}. Redirecting to replay...`);
            window.location.href = `/admin/match-viewer/${matchId}`;
          }
        } catch (pollError: unknown) {
            let message = "An error occurred during polling.";
            if (pollError instanceof Error) message = pollError.message;
            console.error("Polling error:", message);
        }
      }, 5000);

    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("An unknown error occurred.");
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
        <CardDescription>Select teams, AI profiles, and enter decklists to run a simulated match.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                {/* --- MODIFIED: Team Selection UI --- */}
                <Label htmlFor="p1_team">Player 1 Team</Label>
                <Select onValueChange={setTeam1Id}>
                    <SelectTrigger id="p1_team">
                        <SelectValue placeholder={<span className="flex items-center gap-2"><Trophy className="size-4" /> Select Team...</span>} />
                    </SelectTrigger>
                    <SelectContent>
                        {teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team2Id}>{t.emoji} {t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Label htmlFor="p1_deck_name">Player 1 Deck Name</Label>
                <Input id="p1_deck_name" value={player1.deckName} onChange={(e) => setPlayer1({ ...player1, deckName: e.target.value })} placeholder="OneWordDeckName" />
                <Label className="mt-2 block">Player 1 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block" htmlFor="p1_decklist">Player 1 Decklist</Label>
                <Textarea id="p1_decklist" placeholder="25 Mountain&#10;15 Lightning Bolt" value={player1.decklist} onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })} className="h-48"/>
            </div>
            <div className="space-y-4">
                {/* --- MODIFIED: Team Selection UI --- */}
                <Label htmlFor="p2_team">Player 2 Team</Label>
                <Select onValueChange={setTeam2Id}>
                    <SelectTrigger id="p2_team">
                        <SelectValue placeholder={<span className="flex items-center gap-2"><Trophy className="size-4" /> Select Team...</span>} />
                    </SelectTrigger>
                    <SelectContent>
                        {teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team1Id}>{t.emoji} {t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Label htmlFor="p2_deck_name">Player 2 Deck Name</Label>
                <Input id="p2_deck_name" value={player2.deckName} onChange={(e) => setPlayer2({ ...player2, deckName: e.target.value })} placeholder="AnotherUniqueName" />
                <Label className="mt-2 block">Player 2 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block" htmlFor="p2_decklist">Player 2 Decklist</Label>
                <Textarea id="p2_decklist" placeholder="25 Plains&#10;15 Savannah Lions" value={player2.decklist} onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })} className="h-48"/>
            </div>
        </div>

        {validationError && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md flex items-start gap-3">
            <ShieldX className="size-5 mt-0.5 shrink-0" />
            <div><h4 className="font-semibold">Validation Failed</h4><p className="text-sm">{validationError}</p></div>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button onClick={handleSimulate} disabled={isValidating || isSimulating}>
          {isValidating ? <><Hourglass className="size-4 mr-2 animate-spin" /> Validating...</>
          : isSimulating ? <><Hourglass className="size-4 mr-2 animate-spin" /> Simulating...</>
          : <><ShieldCheck className="size-4 mr-2" /> Validate & Simulate Match</>}
        </Button>
      </CardContent>
    </Card>
  );
}
