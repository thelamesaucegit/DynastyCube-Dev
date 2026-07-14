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
  getPendingMottos,
  updateMottoStatus,
  initiatePostseasonTeamVotes,
  type Poll,
  type VoteType,
  type TypedPollResults,
  type BlessingCalculatedOdds, 
  type BlessingTeamChance, 
  type TeamPollResult,
  type MottoSubmission
} from "@/app/actions/voteActions";
import { manuallyTriggerDeckVotesForWeek } from "@/app/actions/adminActions";
import { getActiveSeason } from "@/app/actions/cubucksActions";
import { Loader2, Plus, Sparkles, Check, X, ShieldAlert, Archive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"; 

export function VoteManagement() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pendingMottos, setPendingMottos] = useState<MottoSubmission[]>([]); 
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<TypedPollResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [initiating, setInitiating] = useState(false);
 const [activeTab, setActiveTab] = useState("active"); 
  
  const [formData, setFormData] = useState({
    title: "", description: "", endsAt: "", allowMultipleVotes: false,
    showResultsBeforeEnd: true, voteType: "individual" as VoteType,
    options: ["", ""], activateOnChampionship: false, isMultipleWinner: false,
  });

  useEffect(() => {
  loadAllData();
  }, []);
   const loadAllData = async () => {
      setLoading(true);
      await Promise.all([loadPolls(), loadMottos()]);
      setLoading(false);
  };

  const loadPolls = async () => {
    setLoading(true);
    try {
      const result = await getAllPolls();
      if (result.success) setPolls(result.polls as Poll[]);
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMottos = async () => {
    const result = await getPendingMottos();
    if (result.mottos) setPendingMottos(result.mottos);
  };

  const handleCreatePoll = async () => {
    if (!user) return;
    if (!formData.title.trim()) return alert("❌ Title is required");
    if (!formData.endsAt) return alert("❌ End date is required");
    
    const validOptions = formData.options.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) return alert("❌ At least 2 options are required");

    const result = await createPoll(
      formData.title, formData.description || null, formData.endsAt, formData.allowMultipleVotes,
      formData.showResultsBeforeEnd, validOptions, user.id, formData.voteType,
      formData.activateOnChampionship ? 'championship_match_start' : null,
      formData.isMultipleWinner 
    );
    if (result.success) {
      alert("✅ " + result.message);
      setShowCreateForm(false);
      setFormData({
        title: "", description: "", endsAt: "", allowMultipleVotes: false,
        showResultsBeforeEnd: true, voteType: "individual", options: ["", ""],
        activateOnChampionship: false, isMultipleWinner: false
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
    
    if (isNaN(weekNumber) || weekNumber < 1) return alert("❌ Please enter a valid week number.");
    if (!confirm(`Are you sure you want to generate deck votes for ALL teams for Week ${weekNumber}?`)) return;
    
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

  // --- NEW: Handle Postseason Automation ---
  const handleInitiatePostseasonVotes = async () => {
    if (!confirm("Are you sure you want to generate the Team Captain and Team Motto polls for the upcoming Off-Season? (This requires an End Date to be set on the active season).")) return;
    
    setInitiating(true);
    const result = await initiatePostseasonTeamVotes();
    if (result.success) {
        alert(`✅ ${result.message}`);
        loadPolls();
        loadMottos(); // Refresh the list to hide the 'polled' mottos
    } else {
        alert(`❌ ${result.error}`);
    }
    setInitiating(false);
  };

  // --- NEW: Handle Motto Approvals ---
  const handleMottoStatus = async (id: string, status: 'approved' | 'rejected') => {
      const result = await updateMottoStatus(id, status);
      if (result.success) {
          loadMottos();
      } else {
          alert(`❌ Failed to update motto: ${result.error}`);
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
    setResults(null); 
    try {
      const result = await getPollResultsByType(poll.id);
      if (result.success && result.results) {
        setResults(result.results);
      } else {
        console.error("Failed to fetch poll results:", result.error);
        setResults({ type: poll.vote_type, results: [], team_results: [], league_result: undefined, rawData: [] });
      }
    } catch (e) {
        console.error("Critical error in handleViewResults:", e);
        setResults({ type: poll.vote_type, results: [], team_results: [], league_result: undefined, rawData: [] });
    }
  };
  
  const handleResolveBlessings = async (pollId: string) => {
    if (!confirm("Resolve this blessing event now? This will roll the random lottery for all blessings in this poll.")) return;
    const result = await resolveBlessingEvent(pollId);
    if (result.success) {
      alert("✅ " + result.message);
      loadPolls(); 
    } else {
      alert("❌ " + result.error);
    }
  };

  const addOption = () => setFormData((prev) => ({ ...prev, options: [...prev.options, ""] }));
  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return alert("❌ At least 2 options are required");
    setFormData((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };
  const updateOption = (index: number, value: string) => setFormData((prev) => ({ ...prev, options: prev.options.map((opt, i) => (i === index ? value : opt)) }));
  
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const getDefaultEndDate = () => { const date = new Date(); date.setDate(date.getDate() + 7); return date.toISOString().slice(0, 16); };

  const activePolls = polls.filter(p => p.is_active && new Date(p.ends_at) > new Date());
  const archivedPolls = polls.filter(p => !p.is_active || new Date(p.ends_at) <= new Date());

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 border-b-2 border-blue-600 mx-auto animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading polls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🗳️ Voting System Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage community polls</p>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
          {showCreateForm ? "Cancel" : "+ Create New Poll"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-1">Manual Action: Missing Deck Votes</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">Trigger weekly matchups if the cron job failed.</p>
            <button onClick={handleInitiateFirstVotes} disabled={initiating} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors disabled:bg-yellow-400 disabled:cursor-not-allowed">
                {initiating ? "Initiating..." : "Trigger Deck Votes"}
            </button>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
            <h4 className="font-bold text-indigo-800 dark:text-indigo-200 mb-1">Automation: Postseason Transition</h4>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">Generates Captain & Motto polls for all teams instantly.</p>
            <button onClick={handleInitiatePostseasonVotes} disabled={initiating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed">
                {initiating ? "Generating..." : "Initiate Postseason Votes"}
            </button>
          </div>
      </div>

      {/* --- NEW PENDING MOTTOS PANEL --- */}
      {pendingMottos.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                  <ShieldAlert className="size-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Pending Motto Submissions ({pendingMottos.length})</h3>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {pendingMottos.map(motto => (
                      <div key={motto.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-md bg-muted/20">
                          <div>
                              <p className="font-bold text-lg italic text-foreground">&quot;{motto.motto_text}&quot;</p>
                              <div className="flex gap-2 mt-1 text-sm text-muted-foreground font-medium">
                                  <span>{motto.team_name}</span>
                                  {motto.identity_key && <span className="bg-primary/10 text-primary px-1.5 rounded">{motto.identity_key}</span>}
                                  <span>•</span>
                                  <span>Submitted by {motto.user_name}</span>
                              </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                              <button onClick={() => handleMottoStatus(motto.id, 'approved')} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 rounded-md transition-colors"><Check className="size-5" /></button>
                              <button onClick={() => handleMottoStatus(motto.id, 'rejected')} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-md transition-colors"><X className="size-5" /></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

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
              </p>
            </div>
            
            {formData.voteType === "republic" && (
              <label className="flex items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer">
                <input type="checkbox" checked={formData.isMultipleWinner} onChange={(e) => setFormData({ ...formData, isMultipleWinner: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Seasonal Rules (Multiple Winners)</span>
                  <p className="text-xs text-blue-700 dark:text-blue-300">If checked, ANY option that receives a majority consensus (%gt;50&percnt; of active voting teams) will be declared a winner.</p>                </div>
              </label>
            )}
            
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

    {/* --- TABS FOR ACTIVE/ARCHIVED POLLS --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Polls ({activePolls.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedPolls.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
              <div className="space-y-4 mt-4">
                  {activePolls.length > 0 ? activePolls.map(poll => (
                      <PollCard key={poll.id} poll={poll} onToggleActive={handleToggleActive} onDelete={handleDeletePoll} onViewResults={handleViewResults} onResolveBlessings={handleResolveBlessings} 
 />
                  )) : <p className="text-center py-8 text-muted-foreground">No active polls.</p>}
              </div>
          </TabsContent>
          <TabsContent value="archived">
              <div className="space-y-4 mt-4">
                  {archivedPolls.length > 0 ? archivedPolls.map(poll => (
                      <PollCard key={poll.id} poll={poll} onToggleActive={handleToggleActive} onDelete={handleDeletePoll} onViewResults={handleViewResults}  onResolveBlessings={handleResolveBlessings} 
 />
                  )) : <p className="text-center py-8 text-muted-foreground">No archived polls.</p>}
              </div>
          </TabsContent>
      </Tabs>
      

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
                {/* --- INDIVIDUAL RESULTS --- */}
                {results.type === "individual" && results.results && results.results.length > 0 && (
                  <div className="space-y-4">
                    {results.results.map((result) => (
                      <div key={result.option_id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{result.option_text}</span>
                          <span className="text-gray-600 dark:text-gray-400">{result.vote_count} votes ({result.percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full" style={{ width: `${result.percentage}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                )}
                {/* --- TEAM & REPUBLIC RESULTS --- */}
                {(results.type === "team" || results.type === "republic") && results.team_results && results.team_results.length > 0 && (
                    <div className="space-y-6">
                        {results.type === 'republic' && results.league_result?.winning_option_text && (
                          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                            <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">League Winner</h4>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{results.league_result.winning_option_text}</p>
                          </div>
                        )}
                        <div>
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
                    </div>
                )}
                {/*  Display Blessing Event Raw Data */}
            {results.type === "blessing_event" && results.rawData && results.rawData.length > 0 && (
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
function PollCard({ poll, onToggleActive, onDelete, onViewResults, onResolveBlessings }: { 
    poll: Poll, 
    onToggleActive: (id: string, current: boolean) => void, 
    onDelete: (id: string) => void, 
    onViewResults: (poll: Poll) => void,
    onResolveBlessings: (id: string) => void
}) {
    const formatDate = (dateString: string) => new Date(dateString).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    const now = new Date();
    const endsAt = new Date(poll.ends_at);
    const isEnded = endsAt < now;
    const statusColor = poll.is_active ? isEnded ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300" : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
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
          <button onClick={() => onViewResults(poll)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors">
            View Results
          </button>
          <button onClick={() => onToggleActive(poll.id, poll.is_active)} className={`px-4 py-2 rounded font-semibold transition-colors ${poll.is_active ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
            {poll.is_active ? "Deactivate" : "Activate"}
          </button>
          
          {poll.vote_type === 'blessing_event' && (isEnded || !poll.is_active) && (
            <button onClick={() => onResolveBlessings(poll.id)} className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded font-semibold flex items-center gap-1 transition-colors">
              <Sparkles className="size-4" /> Resolve Lottery
            </button>
          )}
          <button onClick={() => onDelete(poll.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors">
            Delete
          </button>
        </div>
      </div>
    );
}
