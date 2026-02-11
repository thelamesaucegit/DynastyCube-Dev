// src/app/components/history/HistoryEntryForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";

interface HistoryEntryFormProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const HistoryEntryForm: React.FC<HistoryEntryFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content.trim());
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="history-form">
      <div className="history-form-title">Add Entry</div>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="Write your entry in markdown..."
        disabled={loading}
      />
      <div className="history-form-actions">
        <button
          type="button"
          className="history-btn history-btn-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="history-btn history-btn-primary"
          disabled={loading || !content.trim()}
        >
          {loading ? "Adding..." : "Add Entry"}
        </button>
      </div>
    </form>
  );
};
