// src/app/components/history/HistoryRequestForm.tsx
"use client";

import React, { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { HistorySection } from "@/app/actions/historyActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Info } from "lucide-react";

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
      <div className="mt-4">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg text-sm mb-3">
          <Info className="size-4 shrink-0" />
          Pending requests: {pendingCount} / {maxAllowed}
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          disabled={atLimit}
        >
          {atLimit ? "Request Limit Reached" : "Request an Update"}
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold mb-3">Request History Update</p>

          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg text-sm mb-4">
            <Info className="size-4 shrink-0" />
            Pending requests: {pendingCount} / {maxAllowed}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Request Type
            </label>
            <select
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as "append_entry" | "new_section")}
              disabled={loading}
            >
              <option value="append_entry">Add entry to existing section</option>
              <option value="new_section">Create new section</option>
            </select>
          </div>

          {requestType === "append_entry" && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Target Section
              </label>
              <select
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={loading}
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
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Proposed Section Title
              </label>
              <Input
                type="text"
                value={proposedTitle}
                onChange={(e) => setProposedTitle(e.target.value)}
                placeholder="Section title..."
                disabled={loading}
              />
            </div>
          )}

          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Proposed Content
          </label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your proposed content in markdown..."
            disabled={loading}
          />

          <div className="flex gap-2 mt-3 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !content.trim() || atLimit}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
