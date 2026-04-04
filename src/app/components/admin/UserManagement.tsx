// src/app/components/admin/UserManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAllUsers,
  updateUserAdminStatus,
  updateUserDisplayName,
  removeUserFromTeam,
  type UserWithDetails,
} from "@/app/actions/userManagementActions";
import {
  assignRoleToMember,
  removeRoleFromMember,
} from "@/app/actions/roleActions";
import {
  getRoleDisplayName,
  getRoleEmoji,
  type TeamRole,
} from "@/utils/roleUtils";

const ALL_ROLES: TeamRole[] = ["captain", "broker", "historian", "pilot"];

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getAllUsers();

      if (result.success) {
        setUsers(result.users);
      } else {
        setError(result.error || "Failed to load users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: UserWithDetails) => {
    setEditingUser(user);
    setEditDisplayName(user.display_name || user.discord_username || "");
    setEditIsAdmin(user.is_admin);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      // Update display name if changed
      if (editDisplayName !== (editingUser.display_name || editingUser.discord_username || "")) {
        const result = await updateUserDisplayName(editingUser.id, editDisplayName);
        if (!result.success) {
          alert("❌ " + result.error);
          setSaving(false);
          return;
        }
      }

      // Update admin status if changed
      if (editIsAdmin !== editingUser.is_admin) {
        const result = await updateUserAdminStatus(editingUser.id, editIsAdmin);
        if (!result.success) {
          alert("❌ " + result.error);
          setSaving(false);
          return;
        }
      }

      alert("✅ User updated successfully");
      setEditingUser(null);
      await fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      alert("❌ Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRole = async (memberId: string, role: TeamRole, hasRole: boolean) => {
    setSaving(true);
    try {
      const result = hasRole
        ? await removeRoleFromMember(memberId, role)
        : await assignRoleToMember(memberId, role);

      if (result.success) {
        await fetchUsers();
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error("Error toggling role:", error);
      alert("❌ Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromTeam = async (memberId: string, teamName: string) => {
    if (!confirm(`Remove user from ${teamName}?`)) return;

    setSaving(true);
    try {
      const result = await removeUserFromTeam(memberId);
      if (result.success) {
        alert("✅ User removed from team");
        await fetchUsers();
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error("Error removing from team:", error);
      alert("❌ Failed to remove user from team");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.discord_username?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">👥 User Management</h2>
        <p className="admin-section-description">
          View and manage Dynasty Cube users, permissions, and team roles
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200">❌ {error}</p>
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            {searchTerm ? "No users found matching your search" : "No users found"}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {user.avatar_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.avatar_url}
                      alt="Avatar"
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {user.display_name || user.discord_username || "Unknown User"}
                      </h3>
                      {user.is_admin && (
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {user.email}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                      <span>
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        Teams: {user.teams?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="admin-btn admin-btn-secondary"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Edit User: {editingUser.display_name || editingUser.discord_username || editingUser.email}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Admin Status */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsAdmin}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Admin Access
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Admins have full access to the admin panel and all management features
                </p>
              </div>

              {/* Teams & Roles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Team Memberships & Roles
                </h3>
                {(!editingUser.teams || editingUser.teams.length === 0) ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This user is not a member of any teams
                  </p>
                ) : (
                  <div className="space-y-4">
                    {editingUser.teams.map((team) => (
                      <div
                        key={team.team_id}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {team.team_emoji} {team.team_name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Joined: {new Date(team.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFromTeam(team.member_id, team.team_name)}
                            disabled={saving}
                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove from Team
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Team Roles:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_ROLES.map((role) => {
                              const hasRole = team.roles.includes(role);
                              return (
                                <button
                                  key={role}
                                  onClick={() => handleToggleRole(team.member_id, role, hasRole)}
                                  disabled={saving}
                                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    hasRole
                                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  <span>{getRoleEmoji(role)}</span>
                                  <span>{getRoleDisplayName(role)}</span>
                                  {hasRole && <span className="ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex gap-3">
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
