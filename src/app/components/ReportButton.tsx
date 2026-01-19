// src/app/components/ReportButton.tsx
"use client";

import React, { useState } from "react";
import { submitReport } from "@/app/actions/reportActions";
import { getAllUsers } from "@/app/actions/messageActions";

export const ReportButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<"bad_actor" | "bug" | "issue" | "other">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [reportedUserId, setReportedUserId] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = async () => {
    setIsOpen(true);
    setSuccess(false);
    setError(null);

    // Load users for bad actor reports
    const result = await getAllUsers();
    if (result.success) {
      setUsers(result.users);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await submitReport(
        reportType,
        title,
        description,
        severity,
        reportType === "bad_actor" ? reportedUserId : undefined
      );

      if (result.success) {
        setSuccess(true);
        setTitle("");
        setDescription("");
        setReportedUserId("");
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
      } else {
        setError(result.error || "Failed to submit report");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("An error occurred while submitting the report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Report Button */}
      <button
        onClick={handleOpenModal}
        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors flex items-center gap-1.5 h-9"
        title="Report a problem or bad actor"
      >
        <span>⚠️</span>
        <span className="hidden lg:inline">Report</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[1050]">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ⚠️ Submit Report
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="m-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200">
                ✓ Report submitted successfully! Admins will review it shortly.
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "bad_actor", label: "👤 Bad Actor", desc: "Report inappropriate user behavior" },
                    { value: "bug", label: "🐛 Bug", desc: "Report a technical issue" },
                    { value: "issue", label: "⚙️ Issue", desc: "Report a general problem" },
                    { value: "other", label: "💭 Other", desc: "Other concerns" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setReportType(type.value as "bad_actor" | "bug" | "issue" | "other")}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        reportType === type.value
                          ? "border-orange-600 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {type.label}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bad Actor User Selection */}
              {reportType === "bad_actor" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Select User
                  </label>
                  <select
                    value={reportedUserId}
                    onChange={(e) => setReportedUserId(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Severity */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Severity
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "low", label: "Low", color: "bg-blue-100 dark:bg-blue-900/40 border-blue-400" },
                    { value: "medium", label: "Medium", color: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400" },
                    { value: "high", label: "High", color: "bg-orange-100 dark:bg-orange-900/40 border-orange-400" },
                    { value: "critical", label: "Critical", color: "bg-red-100 dark:bg-red-900/40 border-red-400" },
                  ].map((sev) => (
                    <button
                      key={sev.value}
                      type="button"
                      onClick={() => setSeverity(sev.value as "low" | "medium" | "high" | "critical")}
                      className={`p-3 border-2 rounded-lg font-semibold transition-all ${
                        severity === sev.value
                          ? sev.color
                          : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {sev.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Brief summary of the issue..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={6}
                  placeholder="Provide detailed information about the issue..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
                  ✗ {error}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
