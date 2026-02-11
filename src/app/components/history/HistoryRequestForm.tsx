// src/app/components/history/HistoryRequestForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { HistorySection } from "@/app/actions/historyActions";

interface HistoryRequestFormProps {
  sections: HistorySection[];
  pendingCount: number;
  maxAllowed: number;
  onSubmit: (params: {
    requestType: "append_entry" | "new_section";
    targetSectionId?: string;
    proposedTitle?: string;
    proposedContent: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const HistoryRequestForm: React.FC<HistoryRequestFormProps> = ({
  sections,
  pendingCount,
  maxAllowed,
  onSubmit,
  loading = false,
}) => {
  const [requestType, setRequestType] = useState<"append_entry" | "new_section">(
    "append_entry"
  );
  const [sectionId, setSectionId] = useState(sections[0]?.id || "");
  const [proposedTitle, setProposedTitle] = useState("");
  const [content, setContent] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const atLimit = pendingCount >= maxAllowed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (requestType === "new_section" && !proposedTitle.trim()) return;
    if (requestType === "append_entry" && !sectionId) return;

    await onSubmit({
      requestType,
      targetSectionId: requestType === "append_entry" ? sectionId : undefined,
      proposedTitle: requestType === "new_section" ? proposedTitle.trim() : undefined,
      proposedContent: content.trim(),
    });

    setContent("");
    setProposedTitle("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div style={{ marginTop: "1rem" }}>
        <div className="history-limit-info">
          Pending requests: {pendingCount} / {maxAllowed}
        </div>
        <button
          className="history-btn history-btn-primary"
          onClick={() => setIsOpen(true)}
          disabled={atLimit}
        >
          {atLimit ? "Request Limit Reached" : "Request an Update"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="history-form" style={{ marginTop: "1rem" }}>
      <div className="history-form-title">Request History Update</div>
      <div className="history-limit-info">
        Pending requests: {pendingCount} / {maxAllowed}
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
          Request Type
        </label>
        <select
          className="history-select"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as "append_entry" | "new_section")}
          disabled={loading}
          style={{ width: "100%" }}
        >
          <option value="append_entry">Add entry to existing section</option>
          <option value="new_section">Create new section</option>
        </select>
      </div>

      {requestType === "append_entry" && (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
            Target Section
          </label>
          <select
            className="history-select"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={loading}
            style={{ width: "100%" }}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            {sections.length === 0 && (
              <option value="" disabled>
                No sections available
              </option>
            )}
          </select>
        </div>
      )}

      {requestType === "new_section" && (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
            Proposed Section Title
          </label>
          <input
            className="history-input"
            type="text"
            value={proposedTitle}
            onChange={(e) => setProposedTitle(e.target.value)}
            placeholder="Section title..."
            disabled={loading}
          />
        </div>
      )}

      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: "#6b7280" }}>
        Proposed Content
      </label>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="Write your proposed content in markdown..."
        disabled={loading}
      />

      <div className="history-form-actions">
        <button
          type="button"
          className="history-btn history-btn-secondary"
          onClick={() => setIsOpen(false)}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="history-btn history-btn-primary"
          disabled={loading || !content.trim() || atLimit}
        >
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </form>
  );
};
