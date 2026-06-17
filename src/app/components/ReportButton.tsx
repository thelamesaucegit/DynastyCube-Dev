// src/app/components/ReportButton.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom"; // <-- THE FIX: Import React Portal
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
  
  // Need to track mount status to safely use Portals in Next.js SSR
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenModal = async () => {
    setIsOpen(true);
    setSuccess(false);
    setError(null);
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

  // Define the modal content separately
 const modalContent = isOpen ? (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200 pointer-events-auto">
    <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between shrink-0 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>⚠️</span> Submit Report
          </h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Form Container (Scrollable inside popup) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm font-semibold animate-bounce">
              ✓ Report submitted successfully! Admins will review it shortly.
            </div>
          )}

          {/* Report Type */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "bad_actor", label: "👤 Bad Actor", desc: "User behavior" },
                { value: "bug", label: "🐛 Bug", desc: "Technical issue" },
                { value: "issue", label: "⚙️ Issue", desc: "General problem" },
                { value: "other", label: "💭 Other", desc: "Other concerns" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setReportType(type.value as "bad_actor" | "bug" | "issue" | "other")}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    reportType === type.value
                      ? "border-orange-600 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-600 bg-transparent"
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {type.label}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bad Actor User Selection */}
          {reportType === "bad_actor" && (
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                Select User
              </label>
              <select
                value={reportedUserId}
                onChange={(e) => setReportedUserId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
            <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">
              Severity
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "low", label: "Low", color: "bg-blue-500/20 dark:bg-blue-900/40 border-blue-400 text-blue-600 dark:text-blue-300" },
                { value: "medium", label: "Medium", color: "bg-yellow-500/20 dark:bg-yellow-900/40 border-yellow-400 text-yellow-600 dark:text-yellow-300" },
                { value: "high", label: "High", color: "bg-orange-500/20 dark:bg-orange-900/40 border-orange-400 text-orange-600 dark:text-orange-300" },
                { value: "critical", label: "Critical", color: "bg-red-500/20 dark:bg-red-900/40 border-red-400 text-red-600 dark:text-red-300" },
              ].map((sev) => (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => setSeverity(sev.value as "low" | "medium" | "high" | "critical")}
                  className={`p-2 border-2 rounded-lg text-xs font-bold transition-all ${
                    severity === sev.value
                      ? sev.color
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 bg-transparent text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Brief summary of the issue..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Provide detailed information about the issue..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-xs font-semibold">
              ✗ {error}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-bold transition-colors disabled:cursor-not-allowed text-sm"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

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

      {/* THE FIX: Use React Portal to teleport the modal outside the header's bounds! */}
      {mounted && createPortal(modalContent, document.body)}
    </>
  );
};
