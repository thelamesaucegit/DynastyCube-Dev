// src/app/components/admin/CountdownTimerManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAllCountdownTimers,
  createCountdownTimer,
  updateCountdownTimer,
  deleteCountdownTimer,
  activateCountdownTimer,
  deactivateCountdownTimer,
  type CountdownTimerRecord,
} from "@/app/actions/countdownTimerActions";

export const CountdownTimerManagement: React.FC = () => {
  const [timers, setTimers] = useState<CountdownTimerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    end_time: "",
    link_url: "",
    link_text: "",
    is_active: false,
  });

  useEffect(() => {
    loadTimers();
  }, []);

  const loadTimers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllCountdownTimers();
      if (result.error) {
        setError(result.error);
      } else {
        setTimers(result.timers);
      }
    } catch (err) {
      console.error("Error loading timers:", err);
      setError("Failed to load timers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.title || !formData.end_time || !formData.link_url || !formData.link_text) {
      setError("All fields are required");
      return;
    }

    try {
      if (editingId) {
        const result = await updateCountdownTimer(editingId, {
          title: formData.title,
          end_time: new Date(formData.end_time).toISOString(),
          link_url: formData.link_url,
          link_text: formData.link_text,
        });
        if (result.success) {
          setSuccess("Timer updated successfully!");
          resetForm();
          loadTimers();
        } else {
          setError(result.error || "Failed to update timer");
        }
      } else {
        const result = await createCountdownTimer({
          title: formData.title,
          end_time: new Date(formData.end_time).toISOString(),
          link_url: formData.link_url,
          link_text: formData.link_text,
          is_active: formData.is_active,
        });
        if (result.success) {
          setSuccess("Timer created successfully!");
          resetForm();
          loadTimers();
        } else {
          setError(result.error || "Failed to create timer");
        }
      }
    } catch (err) {
      console.error("Error submitting timer:", err);
      setError("An unexpected error occurred");
    }
  };

  const handleEdit = (timer: CountdownTimerRecord) => {
    setEditingId(timer.id!);
    // Convert ISO string to datetime-local format
    const localDate = new Date(timer.end_time);
    const dateStr = localDate.getFullYear() +
      "-" + String(localDate.getMonth() + 1).padStart(2, "0") +
      "-" + String(localDate.getDate()).padStart(2, "0") +
      "T" + String(localDate.getHours()).padStart(2, "0") +
      ":" + String(localDate.getMinutes()).padStart(2, "0");

    setFormData({
      title: timer.title,
      end_time: dateStr,
      link_url: timer.link_url,
      link_text: timer.link_text,
      is_active: timer.is_active || false,
    });
    setIsCreating(true);
  };

  const handleDelete = async (timerId: string) => {
    if (!confirm("Are you sure you want to delete this timer?")) return;

    setError(null);
    setSuccess(null);

    try {
      const result = await deleteCountdownTimer(timerId);
      if (result.success) {
        setSuccess("Timer deleted successfully!");
        loadTimers();
      } else {
        setError(result.error || "Failed to delete timer");
      }
    } catch (err) {
      console.error("Error deleting timer:", err);
      setError("An unexpected error occurred");
    }
  };

  const handleToggleActive = async (timerId: string, currentlyActive: boolean) => {
    setError(null);
    setSuccess(null);

    try {
      const result = currentlyActive
        ? await deactivateCountdownTimer(timerId)
        : await activateCountdownTimer(timerId);

      if (result.success) {
        setSuccess(
          currentlyActive
            ? "Timer deactivated successfully!"
            : "Timer activated successfully!"
        );
        loadTimers();
      } else {
        setError(result.error || "Failed to update timer status");
      }
    } catch (err) {
      console.error("Error toggling timer status:", err);
      setError("An unexpected error occurred");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      end_time: "",
      link_url: "",
      link_text: "",
      is_active: false,
    });
    setEditingId(null);
    setIsCreating(false);
  };

  const isTimerExpired = (endTime: string) => {
    return new Date(endTime).getTime() <= Date.now();
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading timers...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Countdown Timer Management</h2>
        <p className="admin-section-description">
          Create and manage countdown timers displayed on the homepage. Only one timer can be active at a time.
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 mb-6 text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {!isCreating ? (
        <div className="mb-6">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Create New Timer
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {editingId ? "Edit Timer" : "Create New Timer"}
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
                placeholder="e.g., Season 2 Draft Begins"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time *
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Link URL *
              </label>
              <input
                type="url"
                value={formData.link_url}
                onChange={(e) =>
                  setFormData({ ...formData, link_url: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="https://example.com/draft"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Link Text *
              </label>
              <input
                type="text"
                value={formData.link_text}
                onChange={(e) =>
                  setFormData({ ...formData, link_text: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Join the Draft"
                required
              />
            </div>

            {!editingId && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="activate"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label
                  htmlFor="activate"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Activate immediately (deactivates any current timer)
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                {editingId ? "Update Timer" : "Create Timer"}
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

      {/* Timer List */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          All Timers ({timers.length})
        </h3>

        {timers.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No timers yet. Create one to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {timers.map((timer) => {
              const expired = isTimerExpired(timer.end_time);
              return (
                <div
                  key={timer.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {timer.title}
                        </h4>
                        {timer.is_active ? (
                          <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs px-3 py-1 rounded-full font-semibold">
                            Active
                          </span>
                        ) : (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-3 py-1 rounded-full font-semibold">
                            Inactive
                          </span>
                        )}
                        {expired ? (
                          <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs px-3 py-1 rounded-full font-semibold">
                            Expired
                          </span>
                        ) : (
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs px-3 py-1 rounded-full font-semibold">
                            Counting down
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>
                          <strong>Ends:</strong>{" "}
                          {new Date(timer.end_time).toLocaleString()}
                        </p>
                        <p>
                          <strong>Link:</strong>{" "}
                          <a
                            href={timer.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {timer.link_text}
                          </a>{" "}
                          ({timer.link_url})
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created{" "}
                          {new Date(timer.created_at!).toLocaleDateString()}
                          {timer.updated_at &&
                            ` • Updated ${new Date(timer.updated_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleEdit(timer)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleToggleActive(timer.id!, timer.is_active || false)
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        timer.is_active
                          ? "bg-gray-600 hover:bg-gray-700 text-white"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                    >
                      {timer.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(timer.id!)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
