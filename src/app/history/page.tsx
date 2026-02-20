// src/app/history/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HistoryTabBar } from "@/components/history/HistoryTabBar";
import { HistoryContent } from "@/components/history/HistoryContent";
import { HistoryRequestForm } from "@/components/history/HistoryRequestForm";
import { HistoryRequestStatus } from "@/components/history/HistoryRequestStatus";
import {
  getTeamsWithHistory,
  getHistoryByOwner,
  getCurrentUserHistorianInfo,
  getMyPendingRequests,
  submitHistoryUpdateRequest,
  type TeamBasic,
  type HistorySection,
  type HistoryUpdateRequest,
} from "@/app/actions/historyActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function HistoryPage() {
  const [teams, setTeams] = useState<TeamBasic[]>([]);
  const [activeTab, setActiveTab] = useState("league");
  const [sections, setSections] = useState<HistorySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User info
  const [isHistorian, setIsHistorian] = useState(false);
  const [historianTeamId, setHistorianTeamId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Request system
  const [myRequests, setMyRequests] = useState<HistoryUpdateRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [maxAllowed, setMaxAllowed] = useState(1);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  // Load teams and user info on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [teamsResult, userInfo] = await Promise.all([
          getTeamsWithHistory(),
          getCurrentUserHistorianInfo(),
        ]);

        if (teamsResult.teams) {
          setTeams(teamsResult.teams);
        }

        setIsHistorian(userInfo.isHistorian);
        setHistorianTeamId(userInfo.historianTeamId);
        setIsAdmin(userInfo.isAdmin);

        // Load requests if historian
        if (userInfo.isHistorian) {
          const reqResult = await getMyPendingRequests();
          setMyRequests(reqResult.requests);
          setPendingCount(reqResult.pendingCount);
          setMaxAllowed(reqResult.maxAllowed);
        }
      } catch {
        setError("Failed to initialize");
      }
    };

    init();
  }, []);

  // Load content when tab changes
  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ownerType = activeTab === "league" ? "league" : "team";
      const ownerId = activeTab === "league" ? null : activeTab;
      const result = await getHistoryByOwner(ownerType as "team" | "league", ownerId);
      if (result.error) {
        setError(result.error);
      } else {
        setSections(result.sections);
      }
    } catch {
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Determine if user can edit current tab
  const canEdit =
    isAdmin ||
    (isHistorian &&
      activeTab !== "league" &&
      historianTeamId === activeTab);

  // Show request form when historian views non-own-team content
  const showRequestForm =
    isHistorian &&
    !isAdmin &&
    (activeTab === "league" || (activeTab !== "league" && historianTeamId !== activeTab));

  const handleSubmitRequest = async (params: {
    requestType: "append_entry" | "new_section";
    targetSectionId?: string;
    proposedTitle?: string;
    proposedContent: string;
  }) => {
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const ownerType = activeTab === "league" ? "league" : "team";
      const ownerId = activeTab === "league" ? null : activeTab;

      const result = await submitHistoryUpdateRequest({
        requestType: params.requestType,
        targetOwnerType: ownerType as "team" | "league",
        targetOwnerId: ownerId,
        targetSectionId: params.targetSectionId,
        proposedTitle: params.proposedTitle,
        proposedContent: params.proposedContent,
      });

      if (result.success) {
        setRequestSuccess("Request submitted successfully!");
        // Refresh requests
        const reqResult = await getMyPendingRequests();
        setMyRequests(reqResult.requests);
        setPendingCount(reqResult.pendingCount);
        setMaxAllowed(reqResult.maxAllowed);
      } else {
        setRequestError(result.error || "Failed to submit request");
      }
    } catch {
      setRequestError("An unexpected error occurred");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">History</h1>
        <p className="text-lg text-muted-foreground">
          Records and chronicles of the Dynasty Cube league
        </p>
      </div>

      <HistoryTabBar
        teams={teams}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <HistoryContent
            sections={sections}
            ownerType={activeTab === "league" ? "league" : "team"}
            ownerId={activeTab === "league" ? null : activeTab}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onRefresh={loadContent}
          />

          {/* Request form for historians viewing other teams/league */}
          {showRequestForm && (
            <div className="mt-6 space-y-4">
              {requestSuccess && (
                <Card className="border-emerald-500/50">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="text-sm">{requestSuccess}</p>
                  </CardContent>
                </Card>
              )}
              {requestError && (
                <Card className="border-destructive">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    <p className="text-sm">{requestError}</p>
                  </CardContent>
                </Card>
              )}
              <HistoryRequestForm
                sections={sections}
                pendingCount={pendingCount}
                maxAllowed={maxAllowed}
                onSubmit={handleSubmitRequest}
                loading={requestLoading}
              />
              <HistoryRequestStatus
                requests={myRequests}
                pendingCount={pendingCount}
                maxAllowed={maxAllowed}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
