// src/app/account/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import DiscordLogin from "../components/auth/DiscordLogin";
import AccountLinking from "../components/AccountLinking";
import { TeamSelection } from "../components/TeamSelection";
import { DisplayNameEditor } from "../components/DisplayNameEditor";
import { TimezoneSelector } from "../components/TimezoneSelector";
import { getUserTeam } from "../actions/teamActions";
import { getUserEssenceBalance, type EssenceBalance } from "../actions/essenceActions";
import { useUserTimezone } from "../hooks/useUserTimezone";
import { formatDate } from "../utils/timezoneUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Loader2, LogOut, Link2, ChevronRight, Users, Sparkles } from "lucide-react";

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
    const [essenceBalance, setEssenceBalance] = useState<EssenceBalance | null>(null);
    const { timezone } = useUserTimezone();

    useEffect(() => {
        if (user?.email) {
            loadUserTeam();
            loadEssenceBalance();
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

    const loadEssenceBalance = async () => {
        try {
            const { balance } = await getUserEssenceBalance();
            setEssenceBalance(balance);
        } catch (error) {
            console.error("Error loading essence balance:", error);
        }
    };

    const handleSignOut = async () => {
        await signOut();
    };

    const UserProfile = () => (
        <div className="space-y-6">
            {/* Profile Header Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        {user?.user_metadata?.avatar_url && (
                            <Image
                                src={user.user_metadata.avatar_url}
                                alt="Discord Avatar"
                                className="rounded-full border-2 border-primary"
                                width={60}
                                height={60}
                            />
                        )}
                        <div>
                            <h2 className="text-2xl font-bold">
                                Welcome,{" "}
                                {user?.user_metadata?.full_name ||
                                    user?.user_metadata?.username ||
                                    "Dynasty Cube Member"}
                                !
                            </h2>
                            {user?.user_metadata?.username && (
                                <p className="text-muted-foreground text-sm">
                                    @{user.user_metadata.username || "Unknown"}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Discord Username</span>
                            <span className="font-medium">
                                {user?.user_metadata?.full_name || user?.user_metadata?.username}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-medium">{user?.email}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Member since</span>
                            <span className="font-medium">
                                {user?.created_at ? formatDate(user.created_at, timezone) : "N/A"}
                            </span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">Last sign in</span>
                            <span className="font-medium">
                                {user?.last_sign_in_at ? formatDate(user.last_sign_in_at, timezone) : "N/A"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Essence Balance */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-teal-500" />
                        Essence Balance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {essenceBalance ? (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg p-6 text-center">
                                <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
                                    {essenceBalance.essence_balance} <span className="text-2xl">✨</span>
                                </div>
                                <p className="text-sm text-teal-700 dark:text-teal-300 mt-1">
                                    Available Essence
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="text-center p-3 bg-accent rounded-lg">
                                    <div className="font-semibold text-lg">{essenceBalance.essence_total_earned}</div>
                                    <div className="text-muted-foreground">Total Earned</div>
                                </div>
                                <div className="text-center p-3 bg-accent rounded-lg">
                                    <div className="font-semibold text-lg">{essenceBalance.essence_total_spent}</div>
                                    <div className="text-muted-foreground">Total Spent</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Loading balance...</p>
                    )}
                </CardContent>
            </Card>

            {/* Display Name Editor */}
            <DisplayNameEditor />

            {/* Timezone Settings */}
            <TimezoneSelector />

            {/* Team Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        My Team
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingTeam ? (
                        <div className="text-center py-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading team...</p>
                        </div>
                    ) : userTeam ? (
                        <Link href={`/teams/${userTeam.id}`}>
                            <div className="bg-accent rounded-lg p-6 hover:bg-accent/80 transition-all cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <span className="text-5xl">{userTeam.emoji}</span>
                                    <div className="flex-1">
                                        <h4 className="text-2xl font-bold">
                                            {userTeam.name}
                                        </h4>
                                        <p className="text-muted-foreground italic mt-1">
                                            &quot;{userTeam.motto}&quot;
                                        </p>
                                        <p className="text-sm text-primary mt-2 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                                            View Team Page
                                            <ChevronRight className="h-4 w-4" />
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ) : user?.email ? (
                        <TeamSelection userEmail={user.email} onTeamJoined={loadUserTeam} />
                    ) : null}
                </CardContent>
            </Card>

            {/* Account Linking Toggle */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Manage Authentication Methods
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        Link additional sign-in methods to your account for easier access.
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => setShowLinking(!showLinking)}
                    >
                        {showLinking ? "Hide Account Linking" : "Manage Linked Accounts"}
                    </Button>
                </CardContent>
            </Card>

            {/* Account Linking Section */}
            {showLinking && (
                <Card>
                    <CardContent className="pt-6">
                        <AccountLinking />
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-center">
                <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    className="gap-2"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">My Account</h1>
            <ProtectedRoute fallback={<DiscordLogin />}>
                <UserProfile />
            </ProtectedRoute>
        </div>
    );
}
