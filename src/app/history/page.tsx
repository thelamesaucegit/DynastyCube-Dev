// src/app/history/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
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
import "@/styles/pages/history.css";

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
    <Layout>
      <div className="history-page">
        <div className="history-header">
          <h1>History</h1>
          <p>Records and chronicles of the Dynasty Cube league</p>
        </div>

        <HistoryTabBar
          teams={teams}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
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
              <>
                {requestSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-3 mt-4 text-green-800 dark:text-green-200 text-sm">
                    {requestSuccess}
                  </div>
                )}
                {requestError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3 mt-4 text-red-800 dark:text-red-200 text-sm">
                    {requestError}
                  </div>
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
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
