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
        // If content provided, add it as first entry
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
    <div>
      {/* Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-3 mb-4 text-green-800 dark:text-green-200 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3 mb-4 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">📜</div>
          <div className="history-empty-text">No history recorded yet</div>
          <div className="history-empty-sub">
            {canEdit
              ? "Start recording history by creating a section below."
              : "Check back later for updates."}
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.id} className="history-section">
            <div className="history-section-header">
              {editingSectionTitle === section.id ? (
                <div style={{ display: "flex", gap: "0.5rem", flex: 1 }}>
                  <input
                    className="history-input"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="history-btn history-btn-primary history-btn-sm"
                    onClick={() => handleAdminUpdateTitle(section.id)}
                    disabled={loading}
                  >
                    Save
                  </button>
                  <button
                    className="history-btn history-btn-secondary history-btn-sm"
                    onClick={() => setEditingSectionTitle(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="history-section-title">{section.title}</h2>
                  <div className="history-section-actions">
                    {canEdit && (
                      <button
                        className="history-btn-icon"
                        title="Add entry"
                        onClick={() => setAddingEntryToSection(section.id)}
                      >
                        + Entry
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          className="history-btn-icon"
                          title="Edit title"
                          onClick={() => {
                            setEditingSectionTitle(section.id);
                            setEditTitleValue(section.title);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="history-btn-icon"
                          title="Delete section"
                          onClick={() => handleAdminDeleteSection(section.id)}
                          style={{ color: "#ef4444" }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Entries */}
            {section.entries && section.entries.length > 0 ? (
              section.entries.map((entry, idx) => (
                <div key={entry.id} className="history-entry">
                  {editingEntryId === entry.id ? (
                    <div>
                      <MarkdownEditor
                        value={editContentValue}
                        onChange={setEditContentValue}
                        placeholder="Edit entry content..."
                        disabled={loading}
                      />
                      <div className="history-form-actions" style={{ marginTop: "0.5rem" }}>
                        <button
                          className="history-btn history-btn-secondary history-btn-sm"
                          onClick={() => setEditingEntryId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="history-btn history-btn-primary history-btn-sm"
                          onClick={() => handleAdminUpdateContent(entry.id)}
                          disabled={loading}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <HistoryEntryRenderer content={entry.content} />
                      {(canEdit || isAdmin) && (
                        <div className="history-entry-actions">
                          {canEdit && section.entries && section.entries.length > 1 && (
                            <>
                              <button
                                className="history-btn-icon"
                                onClick={() => handleReorder(entry.id, "up")}
                                disabled={idx === 0}
                                title="Move up"
                              >
                                &uarr;
                              </button>
                              <button
                                className="history-btn-icon"
                                onClick={() => handleReorder(entry.id, "down")}
                                disabled={idx === (section.entries?.length || 0) - 1}
                                title="Move down"
                              >
                                &darr;
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                className="history-btn-icon"
                                title="Edit entry"
                                onClick={() => {
                                  setEditingEntryId(entry.id);
                                  setEditContentValue(entry.content);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="history-btn-icon"
                                title="Delete entry"
                                onClick={() => handleAdminDeleteEntry(entry.id)}
                                style={{ color: "#ef4444" }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "0.875rem" }}>
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
          </div>
        ))
      )}

      {/* New section form */}
      {canEdit && (
        <div style={{ marginTop: "1rem" }}>
          {showNewSection ? (
            <HistorySectionForm
              onSubmit={handleCreateSection}
              onCancel={() => setShowNewSection(false)}
              loading={loading}
            />
          ) : (
            <button
              className="history-btn history-btn-primary"
              onClick={() => setShowNewSection(true)}
            >
              + New Section
            </button>
          )}
        </div>
      )}
    </div>
  );
};
