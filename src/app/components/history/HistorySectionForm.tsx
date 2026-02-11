// src/app/components/history/HistorySectionForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";

interface HistorySectionFormProps {
  onSubmit: (title: string, content: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const HistorySectionForm: React.FC<HistorySectionFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit(title.trim(), content.trim());
    setTitle("");
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="history-form">
      <div className="history-form-title">New Section</div>
      <input
        className="history-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section title..."
        disabled={loading}
        style={{ marginBottom: "0.75rem" }}
      />
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="First entry content (optional, markdown supported)..."
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
          disabled={loading || !title.trim()}
        >
          {loading ? "Creating..." : "Create Section"}
        </button>
      </div>
    </form>
  );
};
