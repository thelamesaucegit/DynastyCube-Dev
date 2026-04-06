// src/app/components/admin/ReportManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAllReports, updateReportStatus, getReportStats } from "@/app/actions/reportActions";

interface Report {
  id: string;
  report_type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  reporter_email?: string;
  reported_user_email?: string;
}

interface ReportStats {
  total: number;
  pending: number;
  inReview: number;
  resolved: number;
  dismissed: number;
}

export const ReportManagement: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_review" | "resolved">("pending");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsResult, statsResult] = await Promise.all([
        getAllReports(),
        getReportStats(),
      ]);

      console.log("Reports Result:", reportsResult);
      console.log("Stats Result:", statsResult);

      if (reportsResult.success) {
        console.log("Setting reports:", reportsResult.reports);
        setReports(reportsResult.reports as Report[]);
      } else {
        console.error("Failed to load reports:", reportsResult.error);
      }

      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    reportId: string,
    status: "pending" | "in_review" | "resolved" | "dismissed"
  ) => {
    setUpdating(true);
    try {
      const result = await updateReportStatus(reportId, status, adminNotes);
      if (result.success) {
        await loadData();
        setSelectedReport(null);
        setAdminNotes("");
      } else {
        alert(result.error || "Failed to update report");
      }
    } catch (error) {
      console.error("Error updating report:", error);
      alert("An error occurred");
    } finally {
      setUpdating(false);
    }
  };

  const getFilteredReports = () => {
    if (filter === "all") return reports;
    return reports.filter((r) => r.status === filter);
  };

  const getReportTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      bad_actor: "👤",
      bug: "🐛",
      issue: "⚙️",
      other: "💭",
    };
    return icons[type] || "📋";
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-400",
      medium: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-400",
      high: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-400",
      critical: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-400",
    };
    return colors[severity] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
      in_review: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
      resolved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
      dismissed: "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300",
    };
    return colors[status] || colors.pending;
  };

  const filteredReports = getFilteredReports();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Reports</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pending}</div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.inReview}</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">In Review</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.resolved}</div>
            <div className="text-sm text-green-600 dark:text-green-400">Resolved</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.dismissed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Dismissed</div>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-3 flex-wrap">
        {(["all", "pending", "in_review", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              filter === f
                ? "bg-orange-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace("_", " ")} (
            {f === "all" ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Reports Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filter === "all" ? "No reports have been submitted yet" : `No ${filter} reports`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getReportTypeIcon(report.report_type)}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {report.title}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(
                        report.severity
                      )}`}
                    >
                      {report.severity.toUpperCase()}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                        report.status || "pending"
                      )}`}
                    >
                      {report.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {report.description ? (
                      <>
                        {report.description.substring(0, 200)}
                        {report.description.length > 200 ? "..." : ""}
                      </>
                    ) : (
                      <em className="text-gray-500">No description provided</em>
                    )}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>
                      <strong>Type:</strong> {report.report_type?.replace("_", " ") || "Unknown"}
                    </span>
                    {report.reporter_email && (
                      <span>
                        <strong>Reporter:</strong> {report.reporter_email}
                      </span>
                    )}
                    {report.reported_user_email && (
                      <span>
                        <strong>Reported User:</strong> {report.reported_user_email}
                      </span>
                    )}
                    <span>
                      <strong>Created:</strong> {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReport(report)}
                  className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                >
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {getReportTypeIcon(selectedReport.report_type)} Report Details
              </h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Title</h3>
                <p className="text-gray-700 dark:text-gray-300">{selectedReport.title}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Description</h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedReport.description || <em className="text-gray-500">No description provided</em>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Type</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {selectedReport.report_type?.replace("_", " ") || "Unknown"}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Severity</h3>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(
                      selectedReport.severity || "medium"
                    )}`}
                  >
                    {selectedReport.severity?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Admin Notes</h3>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this report..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {selectedReport.status === "pending" && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReport.id, "in_review")}
                    disabled={updating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Mark as In Review
                  </button>
                )}
                <button
                  onClick={() => handleUpdateStatus(selectedReport.id, "resolved")}
                  disabled={updating}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Mark as Resolved
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReport.id, "dismissed")}
                  disabled={updating}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
