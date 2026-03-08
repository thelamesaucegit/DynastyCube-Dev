// src/app/admin/match-runner/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Swords, Hourglass, ShieldCheck, ShieldX, Trophy } from 'lucide-react';
import { getAiProfiles, validateAndCanonicalizeDeck, getTestDecklists } from '@/app/actions/adminActions';
import { getAllTeams } from '@/app/actions/teamActions';

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [player1, setPlayer1] = useState({ decklist: '', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', aiProfile: '' });
  const [isSimulating, setIsSimulating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [testDecks, setTestDecks] = useState({ p1_deck: '', p2_deck: '' });

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [aiResult, teamResult, testDeckResult] = await Promise.all([ 
            getAiProfiles(), 
            getAllTeams(),
            getTestDecklists()
        ]);
        setProfiles(aiResult);
        if (teamResult.teams) setTeams(teamResult.teams);
        setTestDecks(testDeckResult);
      } catch (err: unknown) {
        setError(`Failed to load initial page data: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
    loadInitialData();
  }, []);

  const handleSimulate = async () => {
    setError(null);
    setValidationError(null);

    let p1Decklist = player1.decklist.trim();
    if (p1Decklist.toLowerCase() === 'test') {
        p1Decklist = testDecks.p1_deck;
    }

    let p2Decklist = player2.decklist.trim();
    if (p2Decklist.toLowerCase() === 'test') {
        p2Decklist = testDecks.p2_deck;
    }

    if (!team1Id || !team2Id) {
      setError('Please select a team for both players.');
      return;
    }
    
    const team1 = teams.find(t => t.id === team1Id);
    const team2 = teams.find(t => t.id === team2Id);

    if (!team1 || !team2) {
        setError('Could not find the selected team data. Please refresh and try again.');
        return;
    }
    
    if (!player1.aiProfile || !player2.aiProfile || !p1Decklist || !p2Decklist) {
      setError('Please provide a decklist and AI profile for both players.');
      return;
    }

    setIsValidating(true);
    setStatusMessage('Validating decklists...');

    const allCardNames = [...p1Decklist.split('\n'), ...p2Decklist.split('\n')].map(line => line.trim().replace(/^\d+\s/, ''));
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
    
    const correctedDeck1List = buildCorrectedDeckList(p1Decklist);
    const correctedDeck2List = buildCorrectedDeckList(p2Decklist);
    
    const deck1NameForSim = team1.id;
    const deck2NameForSim = team2.id;
    
    try {
      const response = await fetch('/api/match-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck1: { content: formatDecklistToDck(correctedDeck1List, deck1NameForSim), aiProfile: player1.aiProfile },
          deck2: { content: formatDecklistToDck(correctedDeck2List, deck2NameForSim), aiProfile: player2.aiProfile },
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
          console.error("Polling error:", pollError instanceof Error ? pollError.message : "Unknown polling error");
        }
      }, 5000);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
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
        {/* --- FIX: Replaced quotes with HTML entities to prevent build error --- */}
        <CardDescription>Select teams, AI profiles, and enter decklists to run a simulated match. Type &quot;Test&quot; to use the pre-defined test deck.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <Label htmlFor="p1_team">Player 1 Team</Label>
                <Select onValueChange={setTeam1Id}>
                    <SelectTrigger id="p1_team"><SelectValue placeholder={<span className="flex items-center gap-2"><Trophy className="size-4" /> Select Team...</span>} /></SelectTrigger>
                    <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team2Id}>{t.emoji} {t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block">Player 1 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block" htmlFor="p1_decklist">Player 1 Decklist</Label>
                <Textarea id="p1_decklist" placeholder="15 Lightning Bolt&#10;10 Shivan Dragon&#10;15 Mountain" value={player1.decklist} onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })} className="h-48"/>
            </div>
            <div className="space-y-4">
                <Label htmlFor="p2_team">Player 2 Team</Label>
                <Select onValueChange={setTeam2Id}>
                    <SelectTrigger id="p2_team"><SelectValue placeholder={<span className="flex items-center gap-2"><Trophy className="size-4" /> Select Team...</span>} /></SelectTrigger>
                    <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team1Id}>{t.emoji} {t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block">Player 2 AI Profile</Label>
                <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                    <SelectTrigger><SelectValue placeholder="Select AI..." /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="mt-2 block" htmlFor="p2_decklist">Player 2 Decklist</Label>
                <Textarea id="p2_decklist" placeholder="10 Savannah Lions&#10;10 White Knight&#10;5 Swords to Plowshares&#10;15 Plains" value={player2.decklist} onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })} className="h-48"/>
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
