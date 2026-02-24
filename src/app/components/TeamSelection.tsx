// src/app/components/TeamSelection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getTeamsWithMembers, joinTeam } from "@/app/actions/teamActions";

interface Team {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  is_hidden?: boolean;
  members?: Array<{
    id: string;
    user_id: string;
    team_id: string;
    user_email: string;
    user_display_name?: string;
    joined_at: string;
  }>;
}

interface TeamSelectionProps {
  userEmail: string;
  onTeamJoined: () => void;
}

export const TeamSelection: React.FC<TeamSelectionProps> = ({ userEmail, onTeamJoined }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const teamsData = await getTeamsWithMembers();
      setTeams(teamsData.filter((team) => !team.is_hidden));
    } catch (err) {
      console.error("Error loading teams:", err);
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!selectedTeam || !userEmail) return;

    setJoining(true);
    setError(null);

    const result = await joinTeam(selectedTeam, userEmail);

    if (result.success) {
      onTeamJoined();
    } else {
      setError(result.error || "Failed to join team");
    }

    setJoining(false);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          🌟 Welcome to Dynasty Cube!
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          You&apos;re not currently on a team. Choose one of the teams below to join and start your journey!
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => setSelectedTeam(team.id)}
            disabled={joining}
            className={`
              relative text-left p-6 rounded-xl border-2 transition-all
              ${
                selectedTeam === team.id
                  ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-lg scale-105"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {selectedTeam === team.id && (
              <div className="absolute top-3 right-3 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{team.emoji}</span>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {team.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  &quot;{team.motto}&quot;
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {team.members?.length || 0} {team.members?.length === 1 ? "member" : "members"}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <button
          onClick={handleJoinTeam}
          disabled={!selectedTeam || joining}
          className="
            bg-gradient-to-r from-blue-600 to-blue-700
            dark:from-blue-500 dark:to-blue-600
            text-white px-8 py-3 rounded-lg font-semibold text-lg
            hover:from-blue-700 hover:to-blue-800
            dark:hover:from-blue-600 dark:hover:to-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg hover:shadow-xl transition-all
          "
        >
          {joining ? "Joining..." : selectedTeam ? "Join Selected Team" : "Select a Team"}
        </button>
      </div>
    </div>
  );
};
