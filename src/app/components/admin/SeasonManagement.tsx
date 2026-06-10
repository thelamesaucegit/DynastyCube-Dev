// src/app/components/admin/SeasonManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { FullSeasonScheduler } from "./FullSeasonScheduler"; 
import {
  getSeasons,
  createSeasonWithSchedule,
  activateSeason,
  createTestSeason,
  type Season,
  type SeasonScheduleParams,
} from "@/app/actions/cubucksActions";
import {
  rolloverSeasonCosts,
  initializeSeasonCosts,
  deleteFullSeason,
  executeSeasonRollover,
  setSeasonDayNightStatus, // <-- NEW ACTION IMPORT
  type CardCostChange,
} from "@/app/actions/seasonActions";

import { SeasonPauseControl } from "./SeasonPauseControl";
import { WeekCreator } from "./WeekCreator";
import { MatchScheduler } from "./MatchScheduler";
import { ScheduleOverview } from "./ScheduleOverview";
import { MatchExtensionManager } from "./MatchExtensionManager";
import { MoonStar, Sun, Eclipse } from "lucide-react"; // <-- NEW ICONS

type SeasonSubTab = "management" | "schedule";

interface ScheduleTabContentProps {
    seasonId: string;
    activeSeason: Season | undefined;
}

function TestSeasonStarter({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleCreateTestSeason = async () => {
    if (!confirm("This will create a rapid 5-week test season with 3 games per matchup and a 5-second auto-draft. Continue?")) return;
    
    setLoading(true);
    try {
        const result = await createTestSeason();
        if (result.success) {
            alert(`Test Season Created! Season ID: ${result.seasonId}`);
            onComplete(); 
        } else {
            alert(`Error creating test season: ${result.error}`);
        }
    } catch (err) {
        console.error(err);
        alert("A critical error occurred while triggering the test season.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button 
        onClick={handleCreateTestSeason} 
        disabled={loading}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-lg mt-4 shadow-lg flex items-center justify-center gap-2"
    >
        {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : "⚡ Quick Start Rapid Test Season"}
    </button>
  );
}

function ManualSeasonRollover({ onComplete }: { onComplete: (result: { success: boolean; error?: string }) => void }) {
  const [loading, setLoading] = useState(false);

  const handleManualRollover = async () => {
    if (!confirm("DANGER: This will immediately execute the full season rollover process. This includes calculating curation, creating a new season, generating a draft order, and scheduling the draft. This action is irreversible. Are you absolutely sure?")) return;
    setLoading(true);
    try {
      const result = await executeSeasonRollover();
      onComplete(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown critical error occurred.";
      onComplete({ success: false, error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-700 rounded-xl">
        <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">🚨 Danger Zone</h3>
        <p className="text-sm text-red-800 dark:text-red-200 mb-4">
            Manually trigger the end-of-season process. This should only be used if the automated cron job fails or for emergency administrative purposes.
        </p>
        <button
            onClick={handleManualRollover}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 disabled:bg-red-800 disabled:cursor-not-allowed"
        >
            {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : "Manual Season Rollover"}
        </button>
    </div>
  );
}

export const SeasonManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SeasonSubTab>("management");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status flags for the new Day/Night toggles
  const [updatingAlignment, setUpdatingAlignment] = useState(false);

  const [draftStartTime, setDraftStartTime] = useState("12:00"); 
  const [showPlanner, setShowPlanner] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [cubucksAllocation, setCubucksAllocation] = useState("100");
  const [scheduleParams, setScheduleParams] = useState<Omit<SeasonScheduleParams, 'draft_start_time'>>({
      draft_start_date: '',
      draft_duration_days: 7,
      draft_total_rounds: 40,
      draft_hours_per_pick: 1,
      regular_season_weeks: 5,
      include_rivals_week: false,
  });

  const [creating, setCreating] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);
  const [rolloverChanges, setRolloverChanges] = useState<CardCostChange[]>([]);
  const [showRolloverDetails, setShowRolloverDetails] = useState(false);

  useEffect(() => { loadSeasons(); }, []);

  const loadSeasons = async () => {
    setLoading(true);
    try {
      const { seasons: data } = await getSeasons();
      setSeasons(data);
    } catch (error) {
      console.error("Error loading seasons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeason = async (seasonId: string, seasonName: string) => {
    if (!confirm(`ARE YOU ABSOLUTELY SURE?\n\nThis will permanently delete "${seasonName}" and all of its associated data.`)) return;
    const result = await deleteFullSeason(seasonId);
    if (result.success) {
        setMessage({ type: "success", text: `Successfully deleted season "${seasonName}".` });
        loadSeasons();
    } else {
        setMessage({ type: "error", text: `Error: ${result.error}` });
    }
  };

  const handleCreateSeason = async () => {
    const seasonNum = parseInt(newSeasonNumber);
    const allocation = parseInt(cubucksAllocation);
    if (isNaN(seasonNum) || !newSeasonName || isNaN(allocation) || !scheduleParams.draft_start_date || !draftStartTime) {
      setMessage({ type: "error", text: "Please fill in all Season Planner fields correctly." });
      return;
    }
    setCreating(true);

    try {
      const fullScheduleParams: SeasonScheduleParams = {
          ...scheduleParams,
          draft_start_time: draftStartTime,
      };
      
      const result = await createSeasonWithSchedule(seasonNum, newSeasonName, allocation, fullScheduleParams);
      
      if (result.success) {
        setMessage({ type: "success", text: `Season ${seasonNum} and its schedule have been created successfully!` });
        setShowPlanner(false);
        setNewSeasonNumber(""); setNewSeasonName(""); setCubucksAllocation("100");
        setDraftStartTime("12:00"); 
        setScheduleParams({ 
            draft_start_date: '', 
            draft_duration_days: 7, 
            draft_total_rounds: 40, 
            draft_hours_per_pick: 1, 
            regular_season_weeks: 5, 
            include_rivals_week: false 
        });
        loadSeasons();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to create season" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setCreating(false);
    }
  };

  const handleActivateSeason = async (seasonId: string) => {
    if (!confirm("Activate this season? This will deactivate all other seasons.")) return;
    try {
      const result = await activateSeason(seasonId);
      if (result.success) {
        setMessage({ type: "success", text: "Season activated successfully!" });
        loadSeasons();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to activate season" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleRolloverCosts = async () => {
    const activeSeason = seasons.find((s) => s.is_active);
    if (!activeSeason) {
      setMessage({ type: "error", text: "No active season found" });
      return;
    }

    const previousSeason = seasons.filter((s) => s.season_number < activeSeason.season_number).sort((a, b) => b.season_number - a.season_number)[0];
    if (!previousSeason) {
      setMessage({ type: "error", text: "No previous season found. Use Initialize instead for Season 1." });
      return;
    }

    if (!confirm(`Roll over card costs from ${previousSeason.season_name} to ${activeSeason.season_name}?\n\n- Drafted cards: cost +1\n- Undrafted cards: cost -1 (min 1)\n\nThis cannot be undone!`)) return;

    setRollingOver(true);
    try {
      const result = await rolloverSeasonCosts(activeSeason.id, previousSeason.id);
      if (result.success && result.changes) {
        setRolloverChanges(result.changes);
        setShowRolloverDetails(true);
        
        const increased = result.changes.filter((c) => c.new_cost > c.old_cost).length;
        const decreased = result.changes.filter((c) => c.new_cost < c.old_cost).length;
        const unchanged = result.changes.filter((c) => c.new_cost === c.old_cost).length;
        
        setMessage({ type: "success", text: `Rollover complete! ${increased} increased, ${decreased} decreased, ${unchanged} unchanged` });
      } else {
        setMessage({ type: "error", text: result.error || "Rollover failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    } finally {
      setRollingOver(false);
    }
  };

  const handleInitializeCosts = async () => {
    if (!confirm("Initialize all cards to 1 Cubuck for the current season?\n\nThis is typically only done for Season 1.\n\nThis will overwrite any existing costs!")) return;
    try {
      const result = await initializeSeasonCosts();
      if (result.success) {
        setMessage({ type: "success", text: "All cards initialized to 1 Cubuck!" });
      } else {
        setMessage({ type: "error", text: result.error || "Initialization failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: String(error) });
    }
  };

  const handleCosmicAlignment = async (status: 'day' | 'night' | 'neutral', isOverride: boolean) => {
      setUpdatingAlignment(true);
      try {
          const result = await setSeasonDayNightStatus(status, isOverride);
          if (result.success) {
              setMessage({ type: "success", text: `Cosmic Alignment locked to ${status.toUpperCase()}!`});
              loadSeasons(); // Refresh to get the active season's new status (if it was returned in your getSeasons fetch)
          } else {
              setMessage({ type: "error", text: result.error || "Failed to update cosmic alignment." });
          }
      } catch (err) {
          setMessage({ type: "error", text: String(err) });
      } finally {
          setUpdatingAlignment(false);
      }
  };

  if (loading) {
    return (
      <div className="admin-section text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading seasons...</p>
      </div>
    );
  }

  const activeSeason = seasons.find((s) => s.is_active);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">🏆 Season Management</h2>
        <p className="admin-section-description">Manage seasons, scheduling, and dynamic card pricing</p>
      </div>

      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button onClick={() => setActiveSubTab("management")} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeSubTab === "management" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
            📊 Season Management
          </button>
          <button onClick={() => setActiveSubTab("schedule")} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeSubTab === "schedule" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
            🗓️ Schedule
          </button>
        </div>
      </div>

      {activeSubTab === "management" && (
        <>
          {activeSeason && (
            <div className="mb-8 space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Season Flow Controls</h3>
              <SeasonPauseControl seasonId={activeSeason.id} seasonName={activeSeason.season_name} />
              
              {/* THE FIX: NEW COSMIC ALIGNMENT CONTROL PANEL */}
              <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                          <h4 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                              <Eclipse className="size-5" /> Cosmic Alignment (Lorwyn/Shadowmoor)
                          </h4>
                          <p className="text-sm text-indigo-800 dark:text-indigo-300 mt-1">
                              Force a cosmic shift. Overriding the alignment locks it permanently until reset, overriding the organic end-of-draft reset.
                          </p>
                      </div>
                      
                      {/* You can display the current status here if your getSeasons() query returns day_night_status! */}
                      {/* <Badge variant="outline" className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">Current: {activeSeason.day_night_status}</Badge> */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button 
                          onClick={() => handleCosmicAlignment('day', true)} 
                          disabled={updatingAlignment}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
                      >
                          <Sun className="size-4" /> Force Day (Override)
                      </button>
                      
                      <button 
                          onClick={() => handleCosmicAlignment('night', true)} 
                          disabled={updatingAlignment}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all bg-slate-800 hover:bg-slate-900 text-slate-100 border border-slate-700 dark:bg-slate-950 dark:hover:bg-black dark:text-slate-300 dark:border-slate-800"
                      >
                          <MoonStar className="size-4" /> Force Night (Override)
                      </button>

                      <button 
                          onClick={() => handleCosmicAlignment('neutral', false)} 
                          disabled={updatingAlignment}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold transition-all bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-200 dark:border-indigo-700"
                      >
                          <Eclipse className="size-4" /> Reset to Neutral
                      </button>
                  </div>
              </div>

            </div>
          )}

          {message && (
            <div className={`mb-6 p-4 rounded-lg border flex justify-between items-start ${message.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200" : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"}`}>
                <p>{message.text}</p>
                <button onClick={() => setMessage(null)} className="text-sm opacity-70 hover:opacity-100 font-bold p-1">✕</button>
            </div>
          )}

          <div className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl">
            <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-3">💡 Dynamic Pricing System</h3>
            <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                <div className="flex items-start gap-2"><span className="font-semibold min-w-[120px]">Starting Cost:</span><span>(Nearly) All cards begin at 1 Cubuck</span></div>
                <div className="flex items-start gap-2"><span className="font-semibold min-w-[120px]">If Drafted:</span><span>Cost increases by +1 Cubuck next Season</span></div>
                <div className="flex items-start gap-2"><span className="font-semibold min-w-[120px]">If Undrafted:</span><span>Cost decreases by half or -1 Cubuck, whichever is greater</span></div>
                <div className="flex items-start gap-2"><span className="font-semibold min-w-[120px]">If Cubuck cost = 0:</span><span>Cards reduced to 0 are removed from the Draft Pool and can instead be claimed as &quot;Free Agents&quot;</span></div>
                <div className="flex items-start gap-2"><span className="font-semibold min-w-[120px]">Result:</span><span>Popular cards become expensive, unpopular cards stay cheap!</span></div>
            </div>
          </div>

          {activeSeason && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">{activeSeason.season_name} (Season {activeSeason.season_number})</h3>
                        <p className="text-sm text-blue-800 dark:text-blue-200">Allocation: {activeSeason.cubucks_allocation} Cubucks per team</p>
                    </div>
                    <span className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium">Active</span>
                </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button onClick={handleRolloverCosts} disabled={rollingOver || !activeSeason} className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6">
                <span className="text-3xl">🔄</span><span className="font-semibold">Rollover Card Costs</span><span className="text-sm opacity-90">Calculate new costs for active season</span>
            </button>
            <button onClick={handleInitializeCosts} disabled={!activeSeason} className="admin-btn admin-btn-secondary flex flex-col items-center gap-2 py-6">
                <span className="text-3xl">🎯</span><span className="font-semibold">Initialize All Cards</span><span className="text-sm opacity-90">Set all cards to 1 Cubuck (Season 1 only)</span>
            </button>
          </div>

          <div className="mb-6">
            {!showPlanner ? (
              <div className="flex flex-col gap-4">
                  <button onClick={() => setShowPlanner(true)} className="w-full admin-btn admin-btn-primary py-4 text-base">
                    + Plan New Season
                  </button>
                  <TestSeasonStarter onComplete={loadSeasons} />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border-2 border-blue-400 rounded-lg p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Season Planner</h3>
                  <button onClick={() => setShowPlanner(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Season Number</label>
                    <input type="number" value={newSeasonNumber} onChange={(e) => setNewSeasonNumber(e.target.value)} placeholder="e.g., 2" className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Season Name</label>
                    <input type="text" value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} placeholder="e.g., Season Two" className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cubucks Allocation</label>
                    <input type="number" value={cubucksAllocation} onChange={(e) => setCubucksAllocation(e.target.value)} placeholder="100" className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                </div>
                
                <div className="border-t pt-6">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Scheduling</h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draft Start Date</label>
                      <input type="date" value={scheduleParams.draft_start_date} onChange={(e) => setScheduleParams(p => ({ ...p, draft_start_date: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draft Start Time</label>
                        <input type="time" value={draftStartTime} onChange={(e) => setDraftStartTime(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draft Duration (Days)</label>
                      <input type="number" value={scheduleParams.draft_duration_days} onChange={(e) => setScheduleParams(p => ({ ...p, draft_duration_days: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Draft Rounds</label>
                      <input type="number" value={scheduleParams.draft_total_rounds} onChange={(e) => setScheduleParams(p => ({ ...p, draft_total_rounds: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hours Per Pick</label>
                      <input type="number" value={scheduleParams.draft_hours_per_pick} onChange={(e) => setScheduleParams(p => ({ ...p, draft_hours_per_pick: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Regular Season (Weeks)</label>
                      <input type="number" value={scheduleParams.regular_season_weeks} onChange={(e) => setScheduleParams(p => ({ ...p, regular_season_weeks: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Include All-Rivals Week</label>
                      <input type="checkbox" checked={scheduleParams.include_rivals_week} onChange={(e) => setScheduleParams(p => ({ ...p, include_rivals_week: e.target.checked }))} className="mt-1 size-5 rounded" />
                    </div>
                  </div>
                  <button onClick={handleCreateSeason} disabled={creating} className="admin-btn admin-btn-primary w-full mt-4">
                    {creating ? "Creating Season..." : "Create & Schedule Season"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">All Seasons</h3>
            <div className="space-y-3">
              {seasons.map((season) => (
                <div key={season.id} className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${season.is_active ? "border-blue-500 dark:border-blue-400 shadow-md" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{season.season_name}</h4>
                            {season.is_active && (<span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">Active</span>)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Season {season.season_number} • {season.cubucks_allocation} Cubucks per team</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Started: {new Date(season.start_date).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!season.is_active && (<button onClick={() => handleActivateSeason(season.id)} className="admin-btn admin-btn-secondary text-sm">Activate</button>)}
                        <button onClick={() => handleDeleteSeason(season.id, season.season_name)} className="admin-btn admin-btn-danger text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ManualSeasonRollover onComplete={(result) => {
              if (result.success) {
                setMessage({ type: 'success', text: 'Season rollover initiated successfully!' });
              } else {
                setMessage({ type: 'error', text: `Rollover failed: ${result.error}` });
              }
              loadSeasons(); 
          }} />
          
        </>
      )}

      {activeSubTab === "schedule" && activeSeason && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <ScheduleTabContent seasonId={activeSeason.id} activeSeason={activeSeason} />
          </div>
        </div>
      )}

      {activeSubTab === "schedule" && !activeSeason && (
        <div className="text-center py-12">
          <div className="mb-4 text-6xl">📅</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Active Season</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please create and activate a season first before managing the schedule.</p>
          <button onClick={() => setActiveSubTab("management")} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">Go to Season Management</button>
        </div>
      )}
    </div>
  );
};

const ScheduleTabContent: React.FC<ScheduleTabContentProps> = ({ seasonId, activeSeason }) => {
  const [scheduleTab, setScheduleTab] = useState<"overview" | "create-week" | "schedule-matches" | "extensions">("overview");

  return (
    <>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <FullSeasonScheduler seasonId={seasonId} />
      </div>
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button onClick={() => setScheduleTab("overview")} className={`flex-1 min-w-[150px] px-4 py-3 text-sm font-medium transition-colors ${scheduleTab === "overview" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
          📋 Schedule Overview
        </button>
        <button onClick={() => setScheduleTab("create-week")} className={`flex-1 min-w-[150px] px-4 py-3 text-sm font-medium transition-colors ${scheduleTab === "create-week" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
          ➕ Create Week
        </button>
        <button onClick={() => setScheduleTab("schedule-matches")} className={`flex-1 min-w-[150px] px-4 py-3 text-sm font-medium transition-colors ${scheduleTab === "schedule-matches" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
          🎮 Schedule Matches
        </button>
        <button onClick={() => setScheduleTab("extensions")} className={`flex-1 min-w-[150px] px-4 py-3 text-sm font-medium transition-colors ${scheduleTab === "extensions" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
          ⏰ Extensions
        </button>
      </div>

      <div className="p-6">
        {scheduleTab === "overview" && <ScheduleOverview seasonId={seasonId} />}
        {scheduleTab === "create-week" && activeSeason && (
            <WeekCreator seasonId={seasonId} seasonNumber={activeSeason.season_number} />
        )}
        {scheduleTab === "schedule-matches" && <MatchScheduler seasonId={seasonId} />}
        {scheduleTab === "extensions" && <MatchExtensionManager seasonId={seasonId} />}
      </div>
    </>
  );
};
