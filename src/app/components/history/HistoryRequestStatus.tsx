// src/app/components/history/HistoryRequestStatus.tsx
"use client";

import React from "react";
import type { HistoryUpdateRequest } from "@/app/actions/historyActions";
import { HistoryEntryRenderer } from "./HistoryEntryRenderer";

interface HistoryRequestStatusProps {
  requests: HistoryUpdateRequest[];
  pendingCount: number;
  maxAllowed: number;
}

export const HistoryRequestStatus: React.FC<HistoryRequestStatusProps> = ({
  requests,
  pendingCount,
  maxAllowed,
}) => {
  if (requests.length === 0) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        My Requests ({pendingCount} / {maxAllowed} pending)
      </h3>
      {requests.map((req) => (
        <div key={req.id} className="history-request-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {req.request_type === "new_section" ? "New Section" : "Append Entry"}
              {req.proposed_title && `: ${req.proposed_title}`}
            </span>
            <span className={`history-request-status ${req.status}`}>
              {getStatusLabel(req.status)}
            </span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Submitted {new Date(req.created_at).toLocaleDateString()}
          </div>
          <details>
            <summary style={{ fontSize: "0.8rem", cursor: "pointer", color: "#6b7280" }}>
              View proposed content
            </summary>
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#f9fafb", borderRadius: "6px" }}>
              <HistoryEntryRenderer content={req.proposed_content} />
            </div>
          </details>
          {req.admin_notes && (
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#eff6ff", borderRadius: "6px", fontSize: "0.8rem" }}>
              <strong>Admin notes:</strong> {req.admin_notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
