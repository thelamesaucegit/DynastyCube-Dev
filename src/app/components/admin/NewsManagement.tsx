// src/app/components/admin/NewsManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAllAdminNews,
  createAdminNews,
  updateAdminNews,
  deleteAdminNews,
  publishAdminNews,
  unpublishAdminNews,
  type AdminNewsPost,
} from "@/app/actions/adminNewsActions";

export const NewsManagement: React.FC = () => {
  const [news, setNews] = useState<AdminNewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_published: false,
  });

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllAdminNews();
      if (result.error) {
        setError(result.error);
      } else {
        setNews(result.news);
      }
    } catch (err) {
      console.error("Error loading news:", err);
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.title || !formData.content) {
      setError("Title and content are required");
      return;
    }

    try {
      if (editingId) {
        // Update existing news
        const result = await updateAdminNews(editingId, formData);
        if (result.success) {
          setSuccess("News updated successfully!");
          resetForm();
          loadNews();
        } else {
          setError(result.error || "Failed to update news");
        }
      } else {
        // Create new news
        const result = await createAdminNews(formData);
        if (result.success) {
          setSuccess("News created successfully!");
          resetForm();
          loadNews();
        } else {
          setError(result.error || "Failed to create news");
        }
      }
    } catch (err) {
      console.error("Error submitting news:", err);
      setError("An unexpected error occurred");
    }
  };

  const handleEdit = (newsItem: AdminNewsPost) => {
    setEditingId(newsItem.id!);
    setFormData({
      title: newsItem.title,
      content: newsItem.content,
      is_published: newsItem.is_published || false,
    });
    setIsCreating(true);
  };

  const handleDelete = async (newsId: string) => {
    if (!confirm("Are you sure you want to delete this news post?")) return;

    setError(null);
    setSuccess(null);

    try {
      const result = await deleteAdminNews(newsId);
      if (result.success) {
        setSuccess("News deleted successfully!");
        loadNews();
      } else {
        setError(result.error || "Failed to delete news");
      }
    } catch (err) {
      console.error("Error deleting news:", err);
      setError("An unexpected error occurred");
    }
  };

  const handleTogglePublish = async (newsId: string, currentStatus: boolean) => {
    setError(null);
    setSuccess(null);

    try {
      const result = currentStatus
        ? await unpublishAdminNews(newsId)
        : await publishAdminNews(newsId);

      if (result.success) {
        setSuccess(
          currentStatus
            ? "News unpublished successfully!"
            : "News published successfully!"
        );
        loadNews();
      } else {
        setError(result.error || "Failed to update publish status");
      }
    } catch (err) {
      console.error("Error toggling publish status:", err);
      setError("An unexpected error occurred");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      is_published: false,
    });
    setEditingId(null);
    setIsCreating(false);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading news...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">📢 News Management</h2>
        <p className="admin-section-description">
          Create and publish news posts to the community
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
            + Create New News Post
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {editingId ? "Edit News Post" : "Create New News Post"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Enter news title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-[150px]"
                placeholder="Enter news content..."
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="publish"
                checked={formData.is_published}
                onChange={(e) =>
                  setFormData({ ...formData, is_published: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="publish"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Publish immediately
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                {editingId ? "Update News" : "Create News"}
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

      {/* News List */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          All News Posts ({news.length})
        </h3>

        {news.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No news posts yet. Create one to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((newsItem) => (
              <div
                key={newsItem.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {newsItem.title}
                      </h4>
                      {newsItem.is_published ? (
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs px-3 py-1 rounded-full font-semibold">
                          Published
                        </span>
                      ) : (
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-3 py-1 rounded-full font-semibold">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                      {newsItem.content}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(newsItem.created_at!).toLocaleDateString()} •{" "}
                      {newsItem.updated_at &&
                        `Updated ${new Date(newsItem.updated_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(newsItem)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      handleTogglePublish(
                        newsItem.id!,
                        newsItem.is_published || false
                      )
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      newsItem.is_published
                        ? "bg-gray-600 hover:bg-gray-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {newsItem.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => handleDelete(newsItem.id!)}
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
