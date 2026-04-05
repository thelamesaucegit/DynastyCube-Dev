//src/app/components/admin/SimMatchScheduler.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getAllTeams } from "@/app/actions/teamActions";
import { getAiProfiles } from "@/app/actions/adminActions";
import { 
    createScheduledSimMatch, 
    getScheduledSimMatches, 
    deleteScheduledSimMatch,
    getTeamCurrentDecklist,
    type ScheduledSimMatch 
} from "@/app/actions/simScheduleActions";

interface Team { id: string; name: string; emoji: string; }
interface AiProfile { id: string; profile_name: string; }

interface SimMatchSchedulerProps {
    activeSeasonNumber: number;
}

const STATUS_STYLES: Record<string, string> = {
    scheduled: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
    in_progress: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    sim_failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};

export const SimMatchScheduler: React.FC<SimMatchSchedulerProps> = ({ activeSeasonNumber }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [profiles, setProfiles] = useState<AiProfile[]>([]);
    const [scheduledMatches, setScheduledMatches] = useState<ScheduledSimMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
const [deckWarnings, setDeckWarnings] = useState<string[]>([]);
    // Form state
    const [team1Id, setTeam1Id] = useState("");
    const [team2Id, setTeam2Id] = useState("");
    const [weekNumber, setWeekNumber] = useState(1);
    const [matchDate, setMatchDate] = useState("");
    const [team1Profile, setTeam1Profile] = useState("");
    const [team2Profile, setTeam2Profile] = useState("");
    const [showDeckOverrides, setShowDeckOverrides] = useState(false);
    const [deck1Override, setDeck1Override] = useState("");
    const [deck2Override, setDeck2Override] = useState("");

    // Deck preview state
    const [team1DeckInfo, setTeam1DeckInfo] = useState<{ cardCount: number; available: boolean } | null>(null);
    const [team2DeckInfo, setTeam2DeckInfo] = useState<{ cardCount: number; available: boolean } | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [teamsResult, profilesResult, matchesResult] = await Promise.all([
                getAllTeams(),
                getAiProfiles(),
                getScheduledSimMatches({ season_number: activeSeasonNumber }),
            ]);
            if (teamsResult.teams) setTeams(teamsResult.teams);
            setProfiles(profilesResult);
            if (!matchesResult.error) setScheduledMatches(matchesResult.matches);
        } catch (e) {
            setError("Failed to load page data");
        } finally {
            setLoading(false);
        }
    }, [activeSeasonNumber]);

    useEffect(() => { loadData(); }, [loadData]);

    // Check deck availability when team selection changes
    useEffect(() => {
        if (!team1Id) { setTeam1DeckInfo(null); return; }
        getTeamCurrentDecklist(team1Id).then(result => {
            setTeam1DeckInfo({ 
                cardCount: result.cardCount, 
                available: !!result.decklist 
            });
        });
    }, [team1Id]);

    useEffect(() => {
        if (!team2Id) { setTeam2DeckInfo(null); return; }
        getTeamCurrentDecklist(team2Id).then(result => {
            setTeam2DeckInfo({ 
                cardCount: result.cardCount, 
                available: !!result.decklist 
            });
        });
    }, [team2Id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!team1Id || !team2Id) return setError("Please select both teams");
        if (team1Id === team2Id) return setError("Teams must be different");
        if (!team1Profile || !team2Profile) return setError("Please select AI profiles for both teams");
        if (!matchDate) return setError("Please set a match date");

        // Warn if no deck and no override
        if (team1DeckInfo && !team1DeckInfo.available && !deck1Override) {
            return setError("Team 1 has no draft picks. Please provide a manual deck override.");
        }
        if (team2DeckInfo && !team2DeckInfo.available && !deck2Override) {
            return setError("Team 2 has no draft picks. Please provide a manual deck override.");
        }

        setSubmitting(true);

        const result = await createScheduledSimMatch({
            team1_id: team1Id,
            team2_id: team2Id,
            season_number: activeSeasonNumber,
            week_number: weekNumber,
            match_date: new Date(matchDate).toISOString(),
            team1_ai_profile: team1Profile,
            team2_ai_profile: team2Profile,
            deck1_override: deck1Override || undefined,
            deck2_override: deck2Override || undefined,
        });

        if (result.success) {
            setSuccess(`Match scheduled for ${new Date(matchDate).toLocaleString()}. The sim will trigger automatically.`);
            setDeckWarnings(result.deckWarnings || []);
            // Reset form
            setTeam1Id(""); setTeam2Id("");
            setTeam1Profile(""); setTeam2Profile("");
            setMatchDate(""); setDeck1Override(""); setDeck2Override("");
            await loadData();
        } else {
            setError(result.error || "Failed to schedule match");
        }
        setSubmitting(false);
    };

    const handleDelete = async (id: string, label: string) => {
        if (!confirm(`Delete scheduled match: ${label}?\n\nThis cannot be undone.`)) return;
        const result = await deleteScheduledSimMatch(id);
        if (result.success) {
            setSuccess("Match deleted.");
            await loadData();
        } else {
            setError(result.error || "Failed to delete match");
        }
    };

    if (loading) return (
        <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p>
        </div>
    );

    const team1 = teams.find(t => t.id === team1Id);
    const team2 = teams.find(t => t.id === team2Id);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Schedule Simulated Match
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Season {activeSeasonNumber} — Decklists are auto-fetched from each team&apos;s current draft picks.
                </p>
            </div>

            {success && (
                <>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200 text-sm">
                        ✓ {success}
                    </div>
                    {deckWarnings.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-medium mb-1">⚠ Deck warnings:</p>
                            <ul className="list-disc list-inside space-y-1">
                                {deckWarnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    )}
                </>
            )}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm">
                    ✗ {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Week + Date row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Week Number
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={weekNumber}
                            onChange={e => setWeekNumber(Number(e.target.value))}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Match Date & Time
                        </label>
                        <input
                            type="datetime-local"
                            value={matchDate}
                            onChange={e => setMatchDate(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>

                {/* Team selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team 1 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Team 1
                        </label>
                        <select
                            value={team1Id}
                            onChange={e => setTeam1Id(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">Select team...</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id} disabled={t.id === team2Id}>
                                    {t.emoji} {t.name}
                                </option>
                            ))}
                        </select>

                        {/* Deck availability indicator */}
                        {team1DeckInfo && (
                            <p className={`text-xs ${team1DeckInfo.available ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
                                {team1DeckInfo.available 
                                    ? `✓ ${team1DeckInfo.cardCount} cards in draft picks` 
                                    : "⚠ No draft picks found — deck override required"}
                            </p>
                        )}

                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Team 1 AI Profile
                        </label>
                        <select
                            value={team1Profile}
                            onChange={e => setTeam1Profile(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">Select AI profile...</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.profile_name}>{p.profile_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Team 2 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Team 2
                        </label>
                        <select
                            value={team2Id}
                            onChange={e => setTeam2Id(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">Select team...</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id} disabled={t.id === team1Id}>
                                    {t.emoji} {t.name}
                                </option>
                            ))}
                        </select>

                        {team2DeckInfo && (
                            <p className={`text-xs ${team2DeckInfo.available ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
                                {team2DeckInfo.available 
                                    ? `✓ ${team2DeckInfo.cardCount} cards in draft picks` 
                                    : "⚠ No draft picks found — deck override required"}
                            </p>
                        )}

                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Team 2 AI Profile
                        </label>
                        <select
                            value={team2Profile}
                            onChange={e => setTeam2Profile(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">Select AI profile...</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.profile_name}>{p.profile_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Deck overrides toggle */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowDeckOverrides(v => !v)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        {showDeckOverrides ? "▲ Hide" : "▼ Show"} manual deck overrides
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Optional. If provided, overrides the auto-fetched draft pick decklist.
                    </p>
                    {showDeckOverrides && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {team1 ? `${team1.emoji} ${team1.name}` : "Team 1"} Deck Override
                                </label>
                                <textarea
                                    value={deck1Override}
                                    onChange={e => setDeck1Override(e.target.value)}
                                    rows={6}
                                    placeholder={`[metadata]\nName=team-id\n\n[Main]\n4 Lightning Bolt\n...`}
                                    className="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {team2 ? `${team2.emoji} ${team2.name}` : "Team 2"} Deck Override
                                </label>
                                <textarea
                                    value={deck2Override}
                                    onChange={e => setDeck2Override(e.target.value)}
                                    rows={6}
                                    placeholder={`[metadata]\nName=team-id\n\n[Main]\n4 Counterspell\n...`}
                                    className="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                    {submitting ? "Scheduling & Starting Sim..." : "Schedule & Run Sim"}
                </button>
            </form>

            {/* Scheduled matches list */}
            {scheduledMatches.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Season {activeSeasonNumber} — Scheduled Sim Matches
                    </h3>
                    <div className="space-y-3">
                        {scheduledMatches.map(match => {
                            const label = `${match.team1?.emoji} ${match.team1?.name} vs ${match.team2?.emoji} ${match.team2?.name}`;
                            return (
                                <div
                                    key={match.id}
                                    className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="space-y-1">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Week {match.week_number} · {new Date(match.match_date).toLocaleString()}
                                            </p>
                                            {match.sim_match_id && (
                                                <a
                                                    href={`/admin/match-viewer/${match.sim_match_id}`}
                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    View Replay →
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLES[match.status] || STATUS_STYLES.scheduled}`}>
                                                {match.status}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(match.id, label)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                                title="Delete"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
