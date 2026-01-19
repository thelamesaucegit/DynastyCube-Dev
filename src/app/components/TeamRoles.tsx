// src/app/components/TeamRoles.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTeamMembersWithRoles,
  assignRoleToMember,
  removeRoleFromMember,
  getUserTeamRoles,
} from "@/app/actions/roleActions";
import type { TeamMemberWithRoles } from "@/app/actions/roleActions";
import {
  getRoleDescription,
  getRoleEmoji,
  getRoleDisplayName,
  type TeamRole,
} from "@/utils/roleUtils";

interface TeamRolesProps {
  teamId: string;
}

const ALL_ROLES: TeamRole[] = ["captain", "broker", "historian", "pilot"];

export const TeamRoles: React.FC<TeamRolesProps> = ({ teamId }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMemberWithRoles[]>([]);
  const [userRoles, setUserRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const isCaptain = userRoles.includes("captain");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load team members with roles
      const { members: teamMembers, error: membersError } =
        await getTeamMembersWithRoles(teamId);

      if (membersError) {
        setError(membersError);
      } else {
        setMembers(teamMembers);
      }

      // Load current user's roles
      if (user) {
        const { roles, error: rolesError } = await getUserTeamRoles(user.id, teamId);
        if (!rolesError) {
          setUserRoles(roles);
        }
      }
    } catch (err) {
      console.error("Error loading team roles:", err);
      setError("Failed to load team roles");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (memberId: string, role: TeamRole) => {
    const result = await assignRoleToMember(memberId, role);

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
    const result = await removeRoleFromMember(memberId, role);

    if (result.success) {
      setSuccess(`${getRoleDisplayName(role)} role removed successfully!`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to remove role");
      setTimeout(() => setError(null), 3000);
    }
  };

  const getMemberHasRole = (member: TeamMemberWithRoles, role: TeamRole): boolean => {
    return member.roles.includes(role);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading team roles...</p>
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

      {/* Role Descriptions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Team Role Descriptions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALL_ROLES.map((role) => (
            <div
              key={role}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getRoleEmoji(role)}</span>
                <h4 className="font-bold text-gray-900 dark:text-gray-100">
                  {getRoleDisplayName(role)}
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getRoleDescription(role)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Permission Notice */}
      {!isCaptain && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            ℹ️ Only team captains can assign or remove roles. Contact your team captain to request
            a role change.
          </p>
        </div>
      )}

      {/* Team Members with Roles */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Team Members & Roles
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            <p className="text-lg mb-2">No team members yet</p>
            <p className="text-sm">Add members to your team to assign roles</p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.member_id}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Member Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {member.user_display_name || member.user_email}
                      </h4>
                      {member.user_id === user?.id && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>

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

                  {/* Role Management (Captain Only) */}
                  {isCaptain && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          setSelectedMember(
                            selectedMember === member.member_id ? null : member.member_id
                          )
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {selectedMember === member.member_id ? "Close" : "Manage Roles"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Role Assignment Panel */}
                {isCaptain && selectedMember === member.member_id && (
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
            ))}
          </div>
        )}
      </div>

      {/* Your Roles Summary */}
      {user && userRoles.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
            Your Team Roles
          </h3>
          <div className="flex flex-wrap gap-3">
            {userRoles.map((role) => (
              <div
                key={role}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700"
              >
                <span className="text-2xl">{getRoleEmoji(role)}</span>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {getRoleDisplayName(role)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {getRoleDescription(role)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
