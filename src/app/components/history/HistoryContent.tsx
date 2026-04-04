// src/app/components/history/HistoryContent.tsx
"use client";

import React, { useState } from "react";
import type { HistorySection } from "@/app/actions/historyActions";
import {
  appendHistoryEntry,
  reorderHistoryEntry,
  createHistorySection,
  adminUpdateSectionTitle,
  adminUpdateEntryContent,
  adminDeleteSection,
  adminDeleteEntry,
} from "@/app/actions/historyActions";
import { HistoryEntryRenderer } from "./HistoryEntryRenderer";
import { HistoryEntryForm } from "./HistoryEntryForm";
import { HistorySectionForm } from "./HistorySectionForm";
import { MarkdownEditor } from "./MarkdownEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AlertCircle, CheckCircle2, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ScrollText } from "lucide-react";

interface HistoryContentProps {
  sections: HistorySection[];
  ownerType: "team" | "league";
  ownerId: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
}

export const HistoryContent: React.FC<HistoryContentProps> = ({
  sections,
  ownerType,
  ownerId,
  canEdit,
  isAdmin,
  onRefresh,
}) => {
  const [addingEntryToSection, setAddingEntryToSection] = useState<string | null>(null);
  const [showNewSection, setShowNewSection] = useState(false);
  const [editingSectionTitle, setEditingSectionTitle] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editContentValue, setEditContentValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleAppendEntry = async (sectionId: string, content: string) => {
    setLoading(true);
    clearMessages();
    try {
      const result = await appendHistoryEntry(sectionId, content);
      if (result.success) {
        setSuccess("Entry added successfully!");
        setAddingEntryToSection(null);
        onRefresh();
      } else {
        setError(result.error || "Failed to add entry");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (entryId: string, direction: "up" | "down") => {
    clearMessages();
    try {
      const result = await reorderHistoryEntry(entryId, direction);
      if (result.success) {
        onRefresh();
      } else {
        setError(result.error || "Failed to reorder");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  const handleCreateSection = async (title: string, content: string) => {
    setLoading(true);
    clearMessages();
    try {
      const result = await createHistorySection(ownerType, ownerId, title);
      if (result.success) {
        if (content && result.sectionId) {
          await appendHistoryEntry(result.sectionId, content);
        }
        setSuccess("Section created successfully!");
        setShowNewSection(false);
        onRefresh();
      } else {
        setError(result.error || "Failed to create section");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminUpdateTitle = async (sectionId: string) => {
    if (!editTitleValue.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      const result = await adminUpdateSectionTitle(sectionId, editTitleValue.trim());
      if (result.success) {
        setSuccess("Title updated!");
        setEditingSectionTitle(null);
        onRefresh();
      } else {
        setError(result.error || "Failed to update title");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminUpdateContent = async (entryId: string) => {
    if (!editContentValue.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      const result = await adminUpdateEntryContent(entryId, editContentValue.trim());
      if (result.success) {
        setSuccess("Entry updated!");
        setEditingEntryId(null);
        onRefresh();
      } else {
        setError(result.error || "Failed to update entry");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDeleteSection = async (sectionId: string) => {
    if (!confirm("Delete this section and all its entries? This cannot be undone.")) return;
    clearMessages();
    try {
      const result = await adminDeleteSection(sectionId);
      if (result.success) {
        setSuccess("Section deleted!");
        onRefresh();
      } else {
        setError(result.error || "Failed to delete section");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  const handleAdminDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    clearMessages();
    try {
      const result = await adminDeleteEntry(entryId);
      if (result.success) {
        setSuccess("Entry deleted!");
        onRefresh();
      } else {
        setError(result.error || "Failed to delete entry");
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      {success && (
        <Card className="border-emerald-500/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm">{success}</p>
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ScrollText className="size-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No history recorded yet</p>
          <p className="text-sm mt-1">
            {canEdit
              ? "Start recording history by creating a section below."
              : "Check back later for updates."}
          </p>
        </div>
      ) : (
        sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              {editingSectionTitle === section.id ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleAdminUpdateTitle(section.id)}
                    disabled={loading}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSectionTitle(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  <div className="flex gap-1 items-center">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddingEntryToSection(section.id)}
                      >
                        <Plus className="size-4 mr-1" />
                        Entry
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSectionTitle(section.id);
                            setEditTitleValue(section.title);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleAdminDeleteSection(section.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Entries */}
              {section.entries && section.entries.length > 0 ? (
                <div className="divide-y divide-border">
                  {section.entries.map((entry, idx) => (
                    <div key={entry.id} className="py-4 first:pt-0 last:pb-0">
                      {editingEntryId === entry.id ? (
                        <div>
                          <MarkdownEditor
                            value={editContentValue}
                            onChange={setEditContentValue}
                            placeholder="Edit entry content..."
                            disabled={loading}
                          />
                          <div className="flex gap-2 mt-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingEntryId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAdminUpdateContent(entry.id)}
                              disabled={loading}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <HistoryEntryRenderer content={entry.content} />
                          {(canEdit || isAdmin) && (
                            <div className="flex gap-1 mt-2">
                              {canEdit && section.entries && section.entries.length > 1 && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorder(entry.id, "up")}
                                    disabled={idx === 0}
                                  >
                                    <ArrowUp className="size-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorder(entry.id, "down")}
                                    disabled={idx === (section.entries?.length || 0) - 1}
                                  >
                                    <ArrowDown className="size-3" />
                                  </Button>
                                </>
                              )}
                              {isAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingEntryId(entry.id);
                                      setEditContentValue(entry.content);
                                    }}
                                  >
                                    <Pencil className="size-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleAdminDeleteEntry(entry.id)}
                                  >
                                    <Trash2 className="size-3 mr-1" />
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">
                  No entries in this section yet.
                </p>
              )}

              {/* Add entry form */}
              {addingEntryToSection === section.id && (
                <HistoryEntryForm
                  onSubmit={(content) => handleAppendEntry(section.id, content)}
                  onCancel={() => setAddingEntryToSection(null)}
                  loading={loading}
                />
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* New section form */}
      {canEdit && (
        <div className="mt-4">
          {showNewSection ? (
            <HistorySectionForm
              onSubmit={handleCreateSection}
              onCancel={() => setShowNewSection(false)}
              loading={loading}
            />
          ) : (
            <Button onClick={() => setShowNewSection(true)}>
              <Plus className="size-4 mr-2" />
              New Section
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
