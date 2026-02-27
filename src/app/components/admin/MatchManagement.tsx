// src/app/components/admin/MatchManagement.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { getWeekMatches, createMatch, updateMatch, getMatchGames, type Match, type MatchGame } from "@/app/actions/matchActions";
import { getTeamsWithMembers } from "@/app/actions/teamActions";
import { getAiProfiles } from "@/app/actions/adminActions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Input } from "@/app/components/ui/input";
import { Swords, Wand, Bot, ArrowRight } from 'lucide-react';

// Interfaces
interface BasicTeam {
  id: string;
  name: string;
  emoji: string;
}

export interface AiProfile {
  id: string;
  profile_name: string;
  description?: string;
}

// New Simulator Component
function ForgeMatchSimulator() {
  const [profiles, setProfiles] = useState<AiProfile[]>([]);
  const [player1, setPlayer1] = useState({ decklist: '', deckName: 'AI Player 1', aiProfile: '' });
  const [player2, setPlayer2] = useState({ decklist: '', deckName: 'AI Player 2', aiProfile: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
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
    setError(null);
    if (!player1.aiProfile || !player2.aiProfile || !player1.decklist.trim() || !player2.decklist.trim()) {
      setError('Please select an AI profile and provide a decklist for both players.');
      return;
    }

    const query = new URLSearchParams({
      p1_deck: player1.decklist,
      p1_name: player1.deckName,
      p1_ai: player1.aiProfile,
      p2_deck: player2.decklist,
      p2_name: player2.deckName,
      p2_ai: player2.aiProfile,
    });

    router.push(`/admin/match-viewer?${query.toString()}`);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Wand className="size-5" />
          Forge AI Match Simulator
        </CardTitle>
        <CardDescription>
          Manually create a simulated match between two AI players with custom decklists to view in the live viewer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player 1 Controls */}
          <div className="space-y-4 p-4 border rounded-lg bg-background">
            <h3 className="font-semibold flex items-center gap-2"><Bot className="size-4" /> Player 1</h3>
            <div className="space-y-2">
              <Label htmlFor="p1-deck-name">Deck Name</Label>
              <Input id="p1-deck-name" value={player1.deckName} onChange={(e) => setPlayer1({ ...player1, deckName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p1-profile">AI Profile</Label>
              <Select onValueChange={(value) => setPlayer1({ ...player1, aiProfile: value })}>
                <SelectTrigger id="p1-profile"><SelectValue placeholder="Select AI Profile..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p1-decklist">Decklist</Label>
              <Textarea id="p1-decklist" value={player1.decklist} onChange={(e) => setPlayer1({ ...player1, decklist: e.target.value })} placeholder="1 Black Lotus&#10;59 Swamp" className="h-48 font-mono text-xs" />
            </div>
          </div>
          {/* Player 2 Controls */}
          <div className="space-y-4 p-4 border rounded-lg bg-background">
            <h3 className="font-semibold flex items-center gap-2"><Bot className="size-4" /> Player 2</h3>
            <div className="space-y-2">
              <Label htmlFor="p2-deck-name">Deck Name</Label>
              <Input id="p2-deck-name" value={player2.deckName} onChange={(e) => setPlayer2({ ...player2, deckName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2-profile">AI Profile</Label>
              <Select onValueChange={(value) => setPlayer2({ ...player2, aiProfile: value })}>
                <SelectTrigger id="p2-profile"><SelectValue placeholder="Select AI Profile..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.profile_name}>{p.profile_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2-decklist">Decklist</Label>
              <Textarea id="p2-decklist" value={player2.decklist} onChange={(e) => setPlayer2({ ...player2, decklist: e.target.value })} placeholder="1 Ancestral Recall&#10;59 Island" className="h-48 font-mono text-xs" />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSimulate} disabled={loading}>
            Simulate Match <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


// Your existing MatchManagement component
export function MatchManagement() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<BasicTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchGames, setMatchGames] = useState<MatchGame[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [bestOf, setBestOf] = useState(3);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editHomeWins, setEditHomeWins] = useState(0);
  const [editAwayWins, setEditAwayWins] = useState(0);
  const [editStatus, setEditStatus] = useState("scheduled");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const matchResult = await getWeekMatches(null);
      const teamResult = await getTeamsWithMembers();
      if (matchResult.success && matchResult.matches) {
        setMatches(matchResult.matches);
      }
      setTeams(teamResult);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!homeTeamId || !awayTeamId) {
      alert("❌ Please select both home and away teams");
      return;
    }
    if (homeTeamId === awayTeamId) {
      alert("❌ Home and away teams must be different");
      return;
    }
    const result = await createMatch({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      best_of: bestOf,
    });
    if (result.success) {
      alert("✅ " + result.message);
      setShowCreateForm(false);
      setHomeTeamId("");
      setAwayTeamId("");
      setBestOf(3);
      loadData();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleViewMatch = async (match: Match) => {
    setSelectedMatch(match);
    setEditingMatch(null);
    const gamesResult = await getMatchGames(match.id);
    if (!gamesResult.error && gamesResult.games) {
      setMatchGames(gamesResult.games);
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match.id);
    setEditHomeWins(match.home_team_wins);
    setEditAwayWins(match.away_team_wins);
    setEditStatus(match.status);
    setEditNotes(match.admin_notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingMatch) return;
    const result = await updateMatch(editingMatch, {
      home_team_wins: editHomeWins,
      away_team_wins: editAwayWins,
      status: editStatus as "scheduled" | "in_progress" | "completed" | "cancelled",
      admin_notes: editNotes,
    });
    if (result.success) {
      alert("✅ " + result.message);
      setEditingMatch(null);
      loadData();
    } else {
      alert("❌ " + result.error);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? `${team.emoji} ${team.name}` : teamId;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. The new Forge Simulator is now at the top of this component */}
      <ForgeMatchSimulator />

      {/* 2. Your existing Human Match Management is below */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Swords className="size-5" />
              Human Match Management
            </CardTitle>
            <CardDescription>Create and manage matches between user teams.</CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Cancel" : "+ Create Match"}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {showCreateForm && (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Create New Human Match</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Home Team</Label>
                  <Select onValueChange={setHomeTeamId} value={homeTeamId}>
                    <SelectTrigger><SelectValue placeholder="Select Home Team" /></SelectTrigger>
                    <SelectContent>{teams.map((team) => (<SelectItem key={team.id} value={team.id}>{team.emoji} {team.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Away Team</Label>
                  <Select onValueChange={setAwayTeamId} value={awayTeamId}>
                    <SelectTrigger><SelectValue placeholder="Select Away Team" /></SelectTrigger>
                    <SelectContent>{teams.map((team) => (<SelectItem key={team.id} value={team.id}>{team.emoji} {team.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Best Of</Label>
                  <Select onValueChange={(val) => setBestOf(parseInt(val))} defaultValue="3">
                    <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Best of 1</SelectItem>
                      <SelectItem value="3">Best of 3</SelectItem>
                      <SelectItem value="5">Best of 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateMatch} className="mt-4 w-full">Create Match</Button>
            </div>
          )}
          
          <div className="pt-6">
            <h3 className="text-lg font-bold mb-4">All Human Matches ({matches.length})</h3>
            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No human matches created yet.</div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <div key={match.id} className="p-4 border rounded-lg bg-background">
                    {editingMatch === match.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="block text-sm font-semibold mb-2">Home Wins</Label>
                            <Input type="number" value={editHomeWins} onChange={(e) => setEditHomeWins(parseInt(e.target.value))} />
                          </div>
                          <div>
                            <Label className="block text-sm font-semibold mb-2">Away Wins</Label>
                            <Input type="number" value={editAwayWins} onChange={(e) => setEditAwayWins(parseInt(e.target.value))} />
                          </div>
                        </div>
                        <div>
                          <Label className="block text-sm font-semibold mb-2">Status</Label>
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="block text-sm font-semibold mb-2">Admin Notes</Label>
                          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEdit} className="flex-1" variant="default">Save</Button>
                          <Button onClick={() => setEditingMatch(null)} className="flex-1" variant="secondary">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="font-bold">{getTeamName(match.home_team_id)}</div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{match.home_team_wins} - {match.away_team_wins}</div>
                            <div className="text-xs text-muted-foreground">Best of {match.best_of}</div>
                          </div>
                          <div className="font-bold">{getTeamName(match.away_team_id)}</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${match.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{match.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleViewMatch(match)} variant="outline">View</Button>
                          <Button onClick={() => handleEditMatch(match)} variant="secondary">Edit</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Match Details</h3>
                <p className="text-muted-foreground">{getTeamName(selectedMatch.home_team_id)} vs {getTeamName(selectedMatch.away_team_id)}</p>
              </div>
              <Button onClick={() => setSelectedMatch(null)} variant="ghost" size="icon">✕</Button>
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold">{selectedMatch.home_team_wins} - {selectedMatch.away_team_wins}</div>
                <div className="text-sm text-muted-foreground">Best of {selectedMatch.best_of}</div>
              </div>
              {matchGames.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Game Results:</h4>
                  {matchGames.map((game) => (
                    <div key={game.id} className="flex items-center justify-between p-3 bg-background rounded-lg mb-2">
                      <span className="font-semibold">Game {game.game_number}</span>
                      <span>Winner: {getTeamName(game.winner_team_id)}</span>
                      {game.duration_minutes && <span className="text-sm text-muted-foreground">({game.duration_minutes} min)</span>}
                    </div>
                  ))}
                </div>
              )}
              {selectedMatch.admin_notes && (
                <div>
                  <h4 className="font-bold mb-2">Admin Notes:</h4>
                  <p className="text-muted-foreground">{selectedMatch.admin_notes}</p>
                </div>
              )}
            </div>
            <Button onClick={() => setSelectedMatch(null)} className="mt-6 w-full" variant="secondary">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
