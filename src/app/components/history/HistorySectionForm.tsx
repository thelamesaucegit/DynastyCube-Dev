// src/app/components/history/HistorySectionForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

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
    <Card className="mt-4">
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold mb-3">New Section</p>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title..."
            disabled={loading}
            className="mb-3"
          />
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="First entry content (optional, markdown supported)..."
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
              disabled={loading || !title.trim()}
            >
              {loading ? "Creating..." : "Create Section"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
