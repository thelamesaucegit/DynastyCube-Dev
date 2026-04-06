// src/app/components/history/HistoryEntryForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

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
    <Card className="mt-4">
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold mb-3">Add Entry</p>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your entry in markdown..."
            disabled={loading}
          />
          <div className="flex gap-2 mt-3 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !content.trim()}
            >
              {loading ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
