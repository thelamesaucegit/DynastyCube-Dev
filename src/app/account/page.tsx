// src/app/account/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import DiscordLogin from "../components/auth/DiscordLogin";
import AccountLinking from "../components/AccountLinking";
import { TeamSelection } from "../components/TeamSelection";
import { DisplayNameEditor } from "../components/DisplayNameEditor";
import { TimezoneSelector } from "../components/TimezoneSelector";
import { getUserTeam } from "../actions/teamActions";
import { useUserTimezone } from "../hooks/useUserTimezone";
import { formatDate } from "../utils/timezoneUtils";

interface Team {
    id: string;
    name: string;
    emoji: string;
    motto: string;
}

export default function AccountPage() {
    const { user, signOut } = useAuth();
    const [showLinking, setShowLinking] = useState(false);
    const [userTeam, setUserTeam] = useState<Team | null>(null);
    const [loadingTeam, setLoadingTeam] = useState(true);
    const { timezone } = useUserTimezone();

    useEffect(() => {
        if (user?.email) {
            loadUserTeam();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email]);

    const loadUserTeam = async () => {
        if (!user?.email) return;

        setLoadingTeam(true);
        try {
            const { team } = await getUserTeam(user.email);
            setUserTeam(team);
        } catch (error) {
            console.error("Error loading user team:", error);
        } finally {
            setLoadingTeam(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
    };

    const UserProfile = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md">
                {user?.user_metadata?.avatar_url && (
                    <Image
                        src={user.user_metadata.avatar_url}
                        alt="Discord Avatar"
                        className="rounded-full border-2 border-blue-500 dark:border-blue-400"
                        width={60}
                        height={60}
                    />
                )}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Welcome,{" "}
                        {user?.user_metadata?.full_name ||
                            user?.user_metadata?.username ||
                            "Dynasty Cube Member"}
                        !
                    </h2>
                    {user?.user_metadata?.username && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            @{user.user_metadata.username || "Unknown"}
                        </p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Account Information</h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    <p>
                        <strong className="text-gray-900 dark:text-gray-100">Discord Username:</strong>{" "}
                        {user?.user_metadata?.full_name || user?.user_metadata?.username}
                    </p>
                    <p>
                        <strong className="text-gray-900 dark:text-gray-100">Email:</strong> {user?.email}
                    </p>
                    <p>
                        <strong className="text-gray-900 dark:text-gray-100">Member since:</strong>{" "}
                        {user?.created_at ? formatDate(user.created_at, timezone) : "N/A"}
                    </p>
                    <p>
                        <strong className="text-gray-900 dark:text-gray-100">Last sign in:</strong>{" "}
                        {user?.last_sign_in_at ? formatDate(user.last_sign_in_at, timezone) : "N/A"}
                    </p>
                </div>
            </div>

            {/* Display Name Editor */}
            <DisplayNameEditor />

            {/* Timezone Settings */}
            <TimezoneSelector />

            {/* Team Section */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">My Team</h3>
                {loadingTeam ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Loading team...</p>
                    </div>
                ) : userTeam ? (
                    <Link href={`/teams/${userTeam.id}`}>
                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer hover:shadow-lg">
                            <div className="flex items-center gap-4">
                                <span className="text-5xl">{userTeam.emoji}</span>
                                <div className="flex-1">
                                    <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {userTeam.name}
                                    </h4>
                                    <p className="text-gray-700 dark:text-gray-300 italic mt-1">
                                        &quot;{userTeam.motto}&quot;
                                    </p>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">
                                        → View Team Page
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ) : user?.email ? (
                    <TeamSelection userEmail={user.email} onTeamJoined={loadUserTeam} />
                ) : null}
            </div>

            {/* Account Linking Toggle */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Manage Authentication Methods</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Link additional sign-in methods to your account for easier access.
                </p>
                <button
                    onClick={() => setShowLinking(!showLinking)}
                    className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                    {showLinking ? "Hide Account Linking" : "Manage Linked Accounts"}
                </button>
            </div>

            {/* Account Linking Section */}
            {showLinking && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
                    <AccountLinking />
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={handleSignOut}
                    className="bg-red-600 dark:bg-red-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="py-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">My Account</h1>
                <ProtectedRoute fallback={<DiscordLogin />}>
                    <UserProfile />
                </ProtectedRoute>
            </div>
        </Layout>
    );
}
