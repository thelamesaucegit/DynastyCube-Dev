// src/app/components/admin/TeamManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getTeamsWithMembers,
  addMemberToTeam,
  removeMemberFromTeam,
} from "@/app/actions/teamActions";

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  user_email: string;
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members?: TeamMember[];
}

interface TeamManagementProps {
  onUpdate?: () => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ onUpdate }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load teams from database on mount
  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const teamsData = await getTeamsWithMembers();
      setTeams(teamsData);
    } catch (err) {
      console.error("Error loading teams:", err);
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!userEmail.trim()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const result = await addMemberToTeam(teamId, userEmail.trim());

    if (result.success) {
      setSuccess(`Successfully added ${userEmail} to team!`);
      setUserEmail("");
      setShowAddMember(false);
      setSelectedTeam(null);
      // Reload teams to get updated data
      await loadTeams();
      // Update parent stats
      onUpdate?.();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to add member");
    }

    setActionLoading(false);
  };

  const handleRemoveMember = async (teamId: string, memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from this team?`)) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const result = await removeMemberFromTeam(teamId, memberEmail);

    if (result.success) {
      setSuccess(`Successfully removed ${memberEmail} from team!`);
      // Reload teams to get updated data
      await loadTeams();
      // Update parent stats
      onUpdate?.();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to remove member");
    }

    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="admin-section">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">👥 Team Management</h2>
        <p className="admin-section-description">
          Manage team memberships and assignments
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
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

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Members ({team.members?.length || 0})
                </span>
                <button
                  onClick={() => {
                    setSelectedTeam(team.id);
                    setShowAddMember(true);
                    setError(null);
                  }}
                  disabled={actionLoading}
                  className="admin-btn admin-btn-primary text-xs"
                >
                  + Add Member
                </button>
              </div>

              {!team.members || team.members.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                  No members yet
                </p>
              ) : (
                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded p-2"
                    >
                      <div className="flex-1">
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {member.user_email}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                          (Joined: {new Date(member.joined_at).toLocaleDateString()})
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(team.id, member.user_email)}
                        disabled={actionLoading}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showAddMember && selectedTeam === team.id && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded">
                <input
                  type="email"
                  placeholder="Enter user email..."
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={actionLoading}
                  className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !actionLoading) {
                      handleAddMember(team.id);
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddMember(team.id)}
                    disabled={actionLoading || !userEmail.trim()}
                    className="admin-btn admin-btn-primary text-sm flex-1"
                  >
                    {actionLoading ? "Adding..." : "Add"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMember(false);
                      setUserEmail("");
                      setSelectedTeam(null);
                      setError(null);
                    }}
                    disabled={actionLoading}
                    className="admin-btn admin-btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
          ✅ Database Persistence Active
        </h4>
        <p className="text-sm text-green-800 dark:text-green-200">
          Team assignments are now saved to the database! Make sure you&apos;ve run the schema.sql file to create the necessary tables.
        </p>
        <ul className="text-sm text-green-800 dark:text-green-200 mt-2 ml-4 list-disc">
          <li>✓ Teams are loaded from the &quot;teams&quot; table</li>
          <li>✓ Members are stored in the &quot;team_members&quot; table</li>
          <li>✓ Changes are persisted automatically</li>
        </ul>
      </div>
    </div>
  );
};
