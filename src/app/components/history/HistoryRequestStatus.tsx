// src/app/components/history/HistoryRequestStatus.tsx
"use client";

import React from "react";
import type { HistoryUpdateRequest } from "@/app/actions/historyActions";
import { HistoryEntryRenderer } from "./HistoryEntryRenderer";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";

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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary" as const;
      case "approved":
        return "default" as const;
      case "rejected":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

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
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-3">
        My Requests ({pendingCount} / {maxAllowed} pending)
      </h3>
      <div className="space-y-3">
        {requests.map((req) => (
          <Card key={req.id}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">
                  {req.request_type === "new_section" ? "New Section" : "Append Entry"}
                  {req.proposed_title && `: ${req.proposed_title}`}
                </span>
                <Badge variant={getStatusVariant(req.status)}>
                  {getStatusLabel(req.status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Submitted {new Date(req.created_at).toLocaleDateString()}
              </p>
              <details>
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  View proposed content
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <HistoryEntryRenderer content={req.proposed_content} />
                </div>
              </details>
              {req.admin_notes && (
                <div className="mt-2 p-3 bg-blue-500/10 rounded-md text-xs">
                  <strong>Admin notes:</strong> {req.admin_notes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
