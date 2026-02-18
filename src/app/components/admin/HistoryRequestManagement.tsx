// src/app/components/admin/HistoryRequestManagement.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getAllHistoryRequests,
  getAllHistorians,
  approveHistoryRequest,
  rejectHistoryRequest,
  updateHistorianRequestLimit,
  type HistoryUpdateRequest,
  type HistorianUser,
} from "@/app/actions/historyActions";
import { HistoryEntryRenderer } from "../history/HistoryEntryRenderer";

type FilterStatus = "pending" | "approved" | "rejected";

export const HistoryRequestManagement: React.FC = () => {
  const [requests, setRequests] = useState<HistoryUpdateRequest[]>([]);
  const [historians, setHistorians] = useState<HistorianUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [limitUserId, setLimitUserId] = useState("");
  const [limitValue, setLimitValue] = useState("1");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestsResult, historiansResult] = await Promise.all([
        getAllHistoryRequests(activeFilter),
        getAllHistorians(),
      ]);
      if (requestsResult.error) {
        setError(requestsResult.error);
      } else {
        setRequests(requestsResult.requests);
      }
      if (historiansResult.historians) {
        setHistorians(historiansResult.historians);
      }
    } catch {
      setError("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await approveHistoryRequest(requestId, adminNotes || undefined);
      if (result.success) {
        setSuccess("Request approved and content applied!");
        setReviewingId(null);
        setAdminNotes("");
        loadRequests();
      } else {
        setError(result.error || "Failed to approve");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  const handleReject = async (requestId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await rejectHistoryRequest(requestId, adminNotes || undefined);
      if (result.success) {
        setSuccess("Request rejected.");
        setReviewingId(null);
        setAdminNotes("");
        loadRequests();
      } else {
        setError(result.error || "Failed to reject");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitUserId.trim()) return;
    setError(null);
    setSuccess(null);
    try {
      const result = await updateHistorianRequestLimit(
        limitUserId.trim(),
        parseInt(limitValue, 10)
      );
      if (result.success) {
        setSuccess("Request limit updated!");
        setLimitUserId("");
        setLimitValue("1");
      } else {
        setError(result.error || "Failed to update limit");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  const filters: { id: FilterStatus; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading history requests...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">History Update Requests</h2>
        <p className="admin-section-description">
          Review and manage historian requests for cross-team and league history edits
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 mb-6 text-green-800 dark:text-green-200">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {filters.map((f) => (
          <button
            key={f.id}
            className={`admin-btn ${activeFilter === f.id ? "admin-btn-primary" : "admin-btn-secondary"}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {requests.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6">
          No {activeFilter} requests found.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {req.request_type === "new_section" ? "New Section" : "Append Entry"}
                    {req.proposed_title && (
                      <span style={{ color: "#6b7280", fontWeight: 400 }}>
                        {" "}
                        &mdash; &ldquo;{req.proposed_title}&rdquo;
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
                    By: {req.requester_display_name || "Unknown"} &bull;{" "}
                    Target: {req.target_owner_type === "league" ? "The League" : req.target_team_name || "Unknown Team"}
                    {req.target_section_title && ` > ${req.target_section_title}`}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: req.status === "pending" ? "#fef3c7" : req.status === "approved" ? "#d1fae5" : "#fee2e2",
                    color: req.status === "pending" ? "#92400e" : req.status === "approved" ? "#065f46" : "#991b1b",
                  }}
                >
                  {req.status}
                </span>
              </div>

              {/* Content preview */}
              <details style={{ marginBottom: "0.75rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#6b7280" }}>
                  View proposed content
                </summary>
                <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#ffffff", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                  className="dark:bg-gray-900 dark:border-gray-600"
                >
                  <HistoryEntryRenderer content={req.proposed_content} />
                </div>
              </details>

              {/* Admin notes */}
              {req.admin_notes && (
                <div style={{ padding: "0.5rem", background: "#eff6ff", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                  <strong>Admin notes:</strong> {req.admin_notes}
                </div>
              )}

              {/* Review actions (only for pending) */}
              {req.status === "pending" && (
                <>
                  {reviewingId === req.id ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <textarea
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Admin notes (optional)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button
                          className="admin-btn admin-btn-success"
                          onClick={() => handleApprove(req.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-btn admin-btn-danger"
                          onClick={() => handleReject(req.id)}
                        >
                          Reject
                        </button>
                        <button
                          className="admin-btn admin-btn-secondary"
                          onClick={() => {
                            setReviewingId(null);
                            setAdminNotes("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="admin-btn admin-btn-primary"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => setReviewingId(req.id)}
                    >
                      Review
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Historian limit management */}
      <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "2px solid #f3f4f6" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Adjust Historian Request Limits
        </h3>
        <form onSubmit={handleUpdateLimit} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
              Historian
            </label>
            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-100"
              value={limitUserId}
              onChange={(e) => setLimitUserId(e.target.value)}
            >
              <option value="">Select a historian...</option>
              {historians.map((h) => (
                <option key={h.user_id} value={h.user_id}>
                  {h.display_name} ({h.team_emoji} {h.team_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
              Max Pending
            </label>
            <input
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-100"
              type="number"
              min="1"
              max="10"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              style={{ width: "80px" }}
            />
          </div>
          <button type="submit" className="admin-btn admin-btn-primary">
            Update Limit
          </button>
        </form>
      </div>
    </div>
  );
};
