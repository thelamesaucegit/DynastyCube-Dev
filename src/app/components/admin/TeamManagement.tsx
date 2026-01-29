// src/app/components/admin/TeamManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getTeamsWithMembers,
  addMemberToTeamById,
  removeMemberFromTeam,
  getUsersForDropdown,
  type UserForDropdown,
} from "@/app/actions/teamActions";
import { assignRoleToMember } from "@/app/actions/roleActions";
import type { TeamRole } from "@/utils/roleUtils";
import {
  getRoleDisplayName,
  getRoleEmoji,
  getRoleDescription,
} from "@/utils/roleUtils";

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  user_email: string;
  user_display_name?: string;
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

const ALL_ROLES: TeamRole[] = ["captain", "broker", "historian", "pilot"];

export const TeamManagement: React.FC<TeamManagementProps> = ({ onUpdate }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<UserForDropdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<TeamRole[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load teams and users from database on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsData, usersData] = await Promise.all([
        getTeamsWithMembers(),
        getUsersForDropdown(),
      ]);
      setTeams(teamsData);
      setAllUsers(usersData.users);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const openAddMemberModal = (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedUserId("");
    setSelectedRoles([]);
    setUserSearchQuery("");
    setShowAddMemberModal(true);
    setError(null);
  };

  const closeAddMemberModal = () => {
    setShowAddMemberModal(false);
    setSelectedTeam(null);
    setSelectedUserId("");
    setSelectedRoles([]);
    setUserSearchQuery("");
    setError(null);
  };

  const toggleRole = (role: TeamRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Get users not already in the selected team
  const getAvailableUsers = () => {
    if (!selectedTeam) return [];
    const team = teams.find((t) => t.id === selectedTeam);
    const memberUserIds = new Set(team?.members?.map((m) => m.user_id) || []);
    return allUsers.filter((u) => !memberUserIds.has(u.id));
  };

  // Filter users by search query
  const filteredUsers = getAvailableUsers().filter((user) => {
    if (!userSearchQuery) return true;
    const query = userSearchQuery.toLowerCase();
    return (
      user.display_name.toLowerCase().includes(query) ||
      (user.discord_username?.toLowerCase().includes(query) ?? false)
    );
  });

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedTeam) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const selectedUser = allUsers.find((u) => u.id === selectedUserId);
    const userName = selectedUser?.display_name || "User";

    // Add member to team
    const result = await addMemberToTeamById(selectedTeam, selectedUserId);

    if (result.success && result.memberId) {
      // Assign selected roles if any
      if (selectedRoles.length > 0) {
        for (const role of selectedRoles) {
          await assignRoleToMember(result.memberId, role);
        }
      }

      const rolesText = selectedRoles.length > 0
        ? ` with roles: ${selectedRoles.map(r => getRoleDisplayName(r)).join(", ")}`
        : "";
      setSuccess(`Successfully added ${userName} to team${rolesText}!`);
      closeAddMemberModal();
      // Reload teams to get updated data
      await loadData();
      // Update parent stats
      onUpdate?.();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to add member");
    }

    setActionLoading(false);
  };

  const handleRemoveMember = async (teamId: string, memberEmail: string, memberName?: string) => {
    const displayName = memberName || memberEmail;
    if (!confirm(`Remove ${displayName} from this team?`)) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const result = await removeMemberFromTeam(teamId, memberEmail);

    if (result.success) {
      setSuccess(`Successfully removed ${displayName} from team!`);
      // Reload teams to get updated data
      await loadData();
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
                  onClick={() => openAddMemberModal(team.id)}
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
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {member.user_display_name || member.user_email}
                        </span>
                        {member.user_display_name && member.user_email && (
                          <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                            ({member.user_email})
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                          Joined: {new Date(member.joined_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(team.id, member.user_email, member.user_display_name)}
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
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Add Member to {teams.find((t) => t.id === selectedTeam)?.name}
              </h3>
              <button
                onClick={closeAddMemberModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
                ✗ {error}
              </div>
            )}

            {/* User Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search User
              </label>
              <input
                type="text"
                placeholder="Search by name or Discord username..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* User Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select User *
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto bg-white dark:bg-gray-900">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    {userSearchQuery ? "No users match your search" : "No available users"}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors ${
                        selectedUserId === user.id
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      <div className="font-medium">{user.display_name}</div>
                      {user.discord_username && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Discord: {user.discord_username}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign Roles (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      selectedRoles.includes(role)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                  >
                    <span className="text-xl">{getRoleEmoji(role)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {getRoleDisplayName(role)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {getRoleDescription(role)}
                      </div>
                    </div>
                    {selectedRoles.includes(role) && (
                      <span className="text-blue-600 dark:text-blue-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAddMember}
                disabled={actionLoading || !selectedUserId}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                {actionLoading ? "Adding..." : "Add Member"}
              </button>
              <button
                onClick={closeAddMemberModal}
                disabled={actionLoading}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
