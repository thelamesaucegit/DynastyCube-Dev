// src/app/components/admin/AdminRoleManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAllTeamsWithRoles,
  adminAssignRole,
  adminRemoveRole,
  type TeamWithMembers,
  type TeamMemberWithRoles,
} from "@/app/actions/adminRoleActions";
import {
  getRoleDescription,
  getRoleEmoji,
  getRoleDisplayName,
  type TeamRole,
} from "@/utils/roleUtils";

const ALL_ROLES: TeamRole[] = ["captain", "broker", "historian", "pilot"];

export const AdminRoleManager: React.FC = () => {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [managingMember, setManagingMember] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { teams: teamsData, error: loadError } = await getAllTeamsWithRoles();

      if (loadError) {
        setError(loadError);
      } else {
        setTeams(teamsData);
        // Expand all teams by default
        setExpandedTeams(new Set(teamsData.map((t) => t.id)));
      }
    } catch (err) {
      console.error("Error loading teams:", err);
      setError("Failed to load teams and roles");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (memberId: string, role: TeamRole) => {
    const result = await adminAssignRole(memberId, role);

    if (result.success) {
      setSuccess(`${getRoleDisplayName(role)} role assigned successfully!`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to assign role");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRemoveRole = async (memberId: string, role: TeamRole) => {
    const result = await adminRemoveRole(memberId, role);

    if (result.success) {
      setSuccess(`${getRoleDisplayName(role)} role removed successfully!`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to remove role");
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleTeam = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getMemberHasRole = (member: TeamMemberWithRoles, role: TeamRole): boolean => {
    return member.roles.includes(role);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading teams and roles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      {/* Role Descriptions Reference */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Team Role Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_ROLES.map((role) => (
            <div
              key={role}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{getRoleEmoji(role)}</span>
                <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                  {getRoleDisplayName(role)}
                </h4>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {getRoleDescription(role)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {teams.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Teams</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {teams.reduce((acc, team) => acc + team.members.length, 0)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Members</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {teams.reduce(
              (acc, team) =>
                acc + team.members.reduce((sum, m) => sum + m.roles.length, 0),
              0
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total Role Assignments
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-4">
        {teams.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No teams found</p>
            <p className="text-sm">Create teams to manage roles</p>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Team Header */}
              <button
                onClick={() => toggleTeam(team.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{team.emoji}</span>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {team.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {team.members.length} member{team.members.length !== 1 ? "s" : ""} •{" "}
                      {team.members.reduce((sum, m) => sum + m.roles.length, 0)} role
                      {team.members.reduce((sum, m) => sum + m.roles.length, 0) !== 1
                        ? "s"
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="text-gray-400">
                  {expandedTeams.has(team.id) ? "▼" : "▶"}
                </div>
              </button>

              {/* Team Members */}
              {expandedTeams.has(team.id) && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  {team.members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-500">
                      <p>No members in this team</p>
                    </div>
                  ) : (
                    team.members.map((member) => (
                      <div
                        key={member.member_id}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Member Info */}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {member.user_display_name || member.user_email}
                            </h4>

                            {/* Current Roles */}
                            <div className="flex flex-wrap gap-2">
                              {member.roles.length === 0 ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  No roles assigned
                                </span>
                              ) : (
                                member.roles.map((role) => (
                                  <div
                                    key={role}
                                    className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium"
                                  >
                                    <span>{getRoleEmoji(role)}</span>
                                    <span>{getRoleDisplayName(role)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Role Management */}
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() =>
                                setManagingMember(
                                  managingMember === member.member_id
                                    ? null
                                    : member.member_id
                                )
                              }
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              {managingMember === member.member_id
                                ? "Close"
                                : "Manage Roles"}
                            </button>
                          </div>
                        </div>

                        {/* Role Assignment Panel */}
                        {managingMember === member.member_id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Assign or remove roles:
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {ALL_ROLES.map((role) => {
                                const hasRole = getMemberHasRole(member, role);
                                return (
                                  <button
                                    key={role}
                                    onClick={() =>
                                      hasRole
                                        ? handleRemoveRole(member.member_id, role)
                                        : handleAssignRole(member.member_id, role)
                                    }
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
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
