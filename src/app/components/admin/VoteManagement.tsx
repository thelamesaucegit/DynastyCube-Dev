// src/app/components/admin/VoteManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllPolls,
  createPoll,
  deletePoll,
  togglePollActive,
  getPollResultsByType,
  resolveBlessingEvent,
  type Poll,
  type VoteType,
  type TypedPollResults,
  type BlessingCalculatedOdds, 
  type BlessingTeamChance, 
  type TeamPollResult,
} from "@/app/actions/voteActions";
import { manuallyTriggerDeckVotesForWeek } from "@/app/actions/adminActions";
import { getActiveSeason } from "@/app/actions/cubucksActions";
import { Loader2, Plus, Sparkles } from "lucide-react";

export function VoteManagement() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<TypedPollResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [initiating, setInitiating] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    endsAt: "",
    allowMultipleVotes: false,
    showResultsBeforeEnd: true,
    voteType: "individual" as VoteType,
    options: ["", ""],
    activateOnChampionship: false,
    isMultipleWinner: false,
  });

  useEffect(() => {
    loadPolls();
  }, []);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const result = await getAllPolls();
      if (result.success) {
        setPolls(result.polls as Poll[]);
      }
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!user) return;
    if (!formData.title.trim()) {
      alert("❌ Title is required");
      return;
    }
    if (!formData.endsAt) {
      alert("❌ End date is required");
      return;
    }
    const validOptions = formData.options.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) {
      alert("❌ At least 2 options are required");
      return;
    }

    const result = await createPoll(
      formData.title,
      formData.description || null,
      formData.endsAt,
      formData.allowMultipleVotes,
      formData.showResultsBeforeEnd,
      validOptions,
      user.id,
      formData.voteType,
      formData.activateOnChampionship ? 'championship_match_start' : null,
      formData.isMultipleWinner 
    );

    if (result.success) {
      alert("✅ " + result.message);
      setShowCreateForm(false);
      setFormData({
        title: "",
        description: "",
        endsAt: "",
        allowMultipleVotes: false,
        showResultsBeforeEnd: true,
        voteType: "individual",
        options: ["", ""],
        activateOnChampionship: false,
      });
      loadPolls();
    } else {
      alert("❌ " + (result.error || "An unknown error occurred."));
    }
  };

  const handleInitiateFirstVotes = async () => {
    const input = prompt("Enter the Week Number to generate deck votes for (e.g., 2):");
    if (!input) return;
    const weekNumber = parseInt(input, 10);
    
    if (isNaN(weekNumber) || weekNumber < 1) {
      alert("❌ Please enter a valid week number.");
      return;
    }
    if (!confirm(`Are you sure you want to generate deck votes for ALL teams for Week ${weekNumber}?`)) {
      return;
    }
    
    setInitiating(true);
    try {
      const { season, error: seasonError } = await getActiveSeason();
      if (seasonError || !season) {
        alert("❌ Could not find an active season.");
        setInitiating(false);
        return;
      }
      
      const result = await manuallyTriggerDeckVotesForWeek(season.id, weekNumber);
      if (result.success) {
        alert(`✅ Successfully created ${result.createdCount} deck vote polls for Week ${weekNumber}.`);
        loadPolls();
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error("Error initiating deck votes:", error);
      alert("❌ An unexpected client-side error occurred.");
    } finally {
      setInitiating(false);
    }
  };

  const handleToggleActive = async (pollId: string, currentStatus: boolean) => {
    const result = await togglePollActive(pollId, !currentStatus);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls();
    } else {
      alert("❌ " + result.error);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll? This cannot be undone.")) return;
    const result = await deletePoll(pollId);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls();
    } else {
      alert("❌ " + result.error);
    }
  };

 const handleViewResults = async (poll: Poll) => {
    setSelectedPoll(poll);
    setShowResults(true);
    setResults(null); // Clear previous results while loading
    
    try {
      const result = await getPollResultsByType(poll.id);
      if (result.success && result.results) {
        setResults(result.results);
      } else {
        console.error("Failed to fetch poll results:", result.error);
        // THE FIX: Set league_result to 'undefined' instead of 'null' to match the type definition.
        setResults({ 
          type: poll.vote_type, 
          results: [], 
          team_results: [], 
          league_result: undefined, 
          rawData: [] 
        });
      }
    } catch (e) {
        console.error("Critical error in handleViewResults:", e);
        setResults({ 
          type: poll.vote_type, 
          results: [], 
          team_results: [], 
          league_result: undefined, 
          rawData: [] 
        });
    }
  };

  
   const handleResolveBlessings = async (pollId: string) => {
    if (!confirm("Resolve this blessing event now? This will roll the random lottery for all blessings in this poll.")) return;
    
    const result = await resolveBlessingEvent(pollId);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls(); // Refresh to show it as ended
    } else {
      alert("❌ " + result.error);
    }
  };

  const addOption = () => setFormData((prev) => ({ ...prev, options: [...prev.options, ""] }));
  const removeOption = (index: number) => {
    if (formData.options.length <= 2) {
      alert("❌ At least 2 options are required");
      return;
    }
    setFormData((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };
  const updateOption = (index: number, value: string) => {
    setFormData((prev) => ({ ...prev, options: prev.options.map((opt, i) => (i === index ? value : opt)) }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  const getDefaultEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 border-b-2 border-blue-600 mx-auto animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading polls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🗳️ Voting System Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage community polls</p>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
          {showCreateForm ? "Cancel" : "+ Create New Poll"}
        </button>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-yellow-800 dark:text-yellow-200">Manual Actions</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Use these actions for manual overrides or to fix failed processes.</p>
          </div>
          <button onClick={handleInitiateFirstVotes} disabled={initiating} className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors disabled:bg-yellow-400 disabled:cursor-not-allowed">
            {initiating ? "Initiating..." : "Trigger Missing Deck Votes"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create New Poll</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Poll Title *</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="What should we vote on?" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description (optional)</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Provide additional context for voters..." rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Voting Ends At *</label>
              <input type="datetime-local" value={formData.endsAt || getDefaultEndDate()} onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vote Type *</label>
              <select value={formData.voteType} onChange={(e) => setFormData({ ...formData, voteType: e.target.value as VoteType })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <option value="individual">Individual Vote (1 person = 1 vote)</option>
                <option value="team">Team Internal Vote (Team members only)</option>
                <option value="republic">League Republic (Teams form consensus)</option>
                <option value="blessing_event">Team Blessings (Weighted Lottery)</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {formData.voteType === "individual" && "Standard voting where each user's vote counts equally toward a single global result."}
                {formData.voteType === "team" && "Members vote within their team, and each team gets its own internal result."}
                {formData.voteType === "republic" && "Electoral style: Individuals vote to determine their team's consensus. The option with the most team-consensus votes wins the league."}
                {formData.voteType === "blessing_event" && "A dynamic lottery where teams pool 'Yes' votes to increase their mathematical odds of receiving specific blessings."}
            {formData.voteType === "republic" && (
              <label className="flex items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer">
                <input type="checkbox" checked={formData.isMultipleWinner} onChange={(e) => setFormData({ ...formData, isMultipleWinner: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Seasonal Rules (Multiple Winners)</span>
                  <p className="text-xs text-blue-700 dark:text-blue-300">If checked, ANY option that receives a majority consensus (%gt;50&percnt; of active voting teams) will be declared a winner.</p>
                </div>
              </label>
            )}
              </p>
            </div>
            

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Poll Options * (minimum 2)</label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input type="text" value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`Option ${index + 1}`} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                    {formData.options.length > 2 && (
                      <button onClick={() => removeOption(index)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addOption} className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold">+ Add Another Option</button>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.allowMultipleVotes} onChange={(e) => setFormData({ ...formData, allowMultipleVotes: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow multiple selections</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.activateOnChampionship} onChange={(e) => setFormData({ ...formData, activateOnChampionship: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Activate when Championship begins</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">The poll will be created as Inactive and will be automatically activated when the Championship match starts.</p>
                </div>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.showResultsBeforeEnd} onChange={(e) => setFormData({ ...formData, showResultsBeforeEnd: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show results before voting ends</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={handleCreatePoll} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">Create Poll</button>
              <button onClick={() => setShowCreateForm(false)} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">All Polls ({polls.length})</h3>
        {polls.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 dark:text-gray-400">No polls created yet. Create your first poll to get started!</p>
          </div>
        ) : (
          polls.map((poll) => {
            const now = new Date();
            const endsAt = new Date(poll.ends_at);
            const isEnded = endsAt < now;
            const statusColor = poll.is_active ? isEnded ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300" : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";

            return (
              <div key={poll.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{poll.title}</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {poll.is_active ? (isEnded ? "Ended" : "Active") : "Inactive"}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        poll.vote_type === "individual" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" :
                        poll.vote_type === "team" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300" :
                        poll.vote_type === "blessing_event" ? "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300" :
                        "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                      }`}>
                        {poll.vote_type === "individual" && "Individual"}
                        {poll.vote_type === "team" && "Team Internal"}
                        {poll.vote_type === "republic" && "League Republic"}
                        {poll.vote_type === "blessing_event" && "Team Blessings"}
                      </span>
                    </div>
                    {poll.description && <p className="text-gray-600 dark:text-gray-400 mb-3">{poll.description}</p>}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>📊 {poll.total_votes} votes</span>
                      <span>⏰ Ends: {formatDate(poll.ends_at)}</span>
                      {poll.allow_multiple_votes && <span>✓ Multiple choice</span>}
                      {poll.show_results_before_end && <span>👁️ Results visible</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleViewResults(poll)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors">
                    View Results
                  </button>
                  <button onClick={() => handleToggleActive(poll.id, poll.is_active)} className={`px-4 py-2 rounded font-semibold transition-colors ${poll.is_active ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    {poll.is_active ? "Deactivate" : "Activate"}
                  </button>
                  
                  {poll.vote_type === 'blessing_event' && (isEnded || !poll.is_active) && (
                    <button onClick={() => handleResolveBlessings(poll.id)} className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded font-semibold flex items-center gap-1 transition-colors">
                      <Sparkles className="size-4" /> Resolve Lottery
                    </button>
                  )}

                  <button onClick={() => handleDeletePoll(poll.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showResults && selectedPoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{selectedPoll.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">Total Votes: {selectedPoll.total_votes}</p>
              </div>
              <button onClick={() => setShowResults(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">✕</button>
            </div>
            
            {!results ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-muted-foreground">Loading results...</p>
              </div>
            ) : (
              <>
                {/* --- REPUBLIC LEAGUE WINNER DISPLAY (THE FINAL FIX) --- */}
                {results.type === 'republic' && results.league_result && (
                  <div className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">
                      {results.is_multiple_winner ? 'League Winners (Majority Consensus)' : 'League Winner'}
                    </h4>
                    
                    {results.is_multiple_winner ? (
                      <div className="space-y-1">
                        {results.league_result.winning_options && results.league_result.winning_options.length > 0 ? (
                          results.league_result.winning_options.map(wo => (
                            <p key={wo.id} className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              <Check className="size-5 text-green-600" /> {wo.text}
                            </p>
                          ))
                        ) : (
                          <p className="text-lg font-bold text-gray-500 italic">No option reached a majority consensus.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {results.league_result.winning_option_text || "Awaiting consensus"}
                      </p>
                    )}
                  </div>
                )}
                
                {/* --- TEAM RESULTS (Works for both Republic and Team) --- */}
                {(results.type === "team" || results.type === "republic") && results.team_results && results.team_results.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{results.type === 'republic' ? 'Team Consensus' : 'Team Results'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.team_results.map((teamResult: TeamPollResult) => (
                        <div key={teamResult.team_id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{teamResult.team_emoji}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{teamResult.team_name}</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400">{teamResult.winning_option_text || "No votes yet"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{teamResult.total_weighted_votes} weighted votes</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- BLESSING EVENT RESULTS --- */}
                {results.type === "blessing_event" && results.rawData && (results.rawData as BlessingCalculatedOdds[]).length > 0 && (
                  <div className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Live Blessing Odds</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          These are the baseline mathematical odds based on current votes. During resolution, winning teams are eliminated from subsequent rolls, causing actual odds to shift dynamically.
                        </p>
                    </div>
                    {(results.rawData as BlessingCalculatedOdds[]).map((option) => (
                      <div key={option.option_id} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3 border-b border-purple-200 dark:border-purple-800 pb-2">
                            <h5 className="font-bold text-lg text-purple-900 dark:text-purple-300">{option.option_text}</h5>
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-400 bg-purple-200 dark:bg-purple-900/50 px-2 py-0.5 rounded">
                                {option.total_yes_votes} Total Votes
                            </span>
                        </div>
                        <div className="space-y-2">
                          {option.team_chances.map((tc: BlessingTeamChance) => (
                            <div key={tc.team_id} className={`flex items-center justify-between text-sm p-2 rounded-md ${tc.votes > 0 ? 'bg-white dark:bg-gray-800 shadow-sm' : 'opacity-60 grayscale'}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{tc.team_emoji}</span>
                                <span className={`font-medium ${tc.votes > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>{tc.team_name}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-500 w-16 text-right">{tc.votes} votes</span>
                                <span className={`font-bold w-12 text-right ${tc.votes > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                                    {tc.odds}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={() => setShowResults(false)} className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
