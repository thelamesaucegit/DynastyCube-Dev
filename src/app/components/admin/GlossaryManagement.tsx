// src/app/components/admin/GlossaryManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getGlossaryItems,
  createGlossaryItem,
  updateGlossaryItem,
  deleteGlossaryItem,
  type GlossaryItem,
} from "@/app/actions/glossaryActions";
import { MarkdownEditor } from "@/components/history/MarkdownEditor";
import { HistoryEntryRenderer } from "@/components/history/HistoryEntryRenderer";

export const GlossaryManagement: React.FC = () => {
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    term: "",
    definition: "",
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGlossaryItems();
      if (result.error) {
        setError(result.error);
      } else {
        setItems(result.items);
      }
    } catch (err) {
      console.error("Error loading glossary:", err);
      setError("Failed to load glossary items");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.term.trim() || !formData.definition.trim()) {
      setError("Term and definition are required");
      return;
    }

    try {
      if (editingId) {
        const result = await updateGlossaryItem(
          editingId,
          formData.term,
          formData.definition
        );
        if (result.success) {
          setSuccess("Term updated successfully!");
          resetForm();
          loadItems();
        } else {
          setError(result.error || "Failed to update term");
        }
      } else {
        const result = await createGlossaryItem(
          formData.term,
          formData.definition
        );
        if (result.success) {
          setSuccess("Term created successfully!");
          resetForm();
          loadItems();
        } else {
          setError(result.error || "Failed to create term");
        }
      }
    } catch (err) {
      console.error("Error submitting glossary item:", err);
      setError("An unexpected error occurred");
    }
  };

  const handleEdit = (item: GlossaryItem) => {
    setEditingId(item.id);
    setFormData({
      term: item.term,
      definition: item.definition,
    });
    setIsCreating(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this glossary term?")) return;

    setError(null);
    setSuccess(null);

    try {
      const result = await deleteGlossaryItem(itemId);
      if (result.success) {
        setSuccess("Term deleted successfully!");
        loadItems();
      } else {
        setError(result.error || "Failed to delete term");
      }
    } catch (err) {
      console.error("Error deleting glossary item:", err);
      setError("An unexpected error occurred");
    }
  };

  const resetForm = () => {
    setFormData({ term: "", definition: "" });
    setEditingId(null);
    setIsCreating(false);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading glossary...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">📖 Glossary Management</h2>
        <p className="admin-section-description">
          Add, edit, and remove glossary terms and definitions. Items are
          automatically sorted alphabetically on the public page.
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 mb-6 text-green-800 dark:text-green-200">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6 text-red-800 dark:text-red-200">
          ✗ {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {!isCreating ? (
        <div className="mb-6">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Add New Term
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {editingId ? "Edit Term" : "Add New Term"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Term *
              </label>
              <input
                type="text"
                value={formData.term}
                onChange={(e) =>
                  setFormData({ ...formData, term: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Enter term..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Definition * (Markdown supported)
              </label>
              <MarkdownEditor
                value={formData.definition}
                onChange={(val) =>
                  setFormData({ ...formData, definition: val })
                }
                placeholder="Write definition in markdown..."
                minHeight="150px"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                {editingId ? "Update Term" : "Create Term"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          All Terms ({items.length})
        </h3>

        {items.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No glossary terms yet. Add one to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {item.term}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Created{" "}
                      {new Date(item.created_at).toLocaleDateString()}
                      {item.updated_at !== item.created_at &&
                        ` • Updated ${new Date(item.updated_at).toLocaleDateString()}`}
                    </p>
                    {/* Toggle definition preview */}
                    {expandedId === item.id ? (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <HistoryEntryRenderer content={item.definition} />
                      </div>
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2">
                        {item.definition.length > 120
                          ? item.definition.substring(0, 120) + "..."
                          : item.definition}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setExpandedId(
                        expandedId === item.id ? null : item.id
                      )
                    }
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {expandedId === item.id ? "Collapse" : "Preview"}
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
