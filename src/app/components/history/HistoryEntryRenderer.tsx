// src/app/components/history/HistoryEntryRenderer.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HistoryEntryRendererProps {
  content: string;
}

export const HistoryEntryRenderer: React.FC<HistoryEntryRendererProps> = ({
  content,
}) => {
  return (
    <div className="history-entry-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};
