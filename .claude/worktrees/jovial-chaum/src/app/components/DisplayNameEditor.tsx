// src/app/components/DisplayNameEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/supabase-browser";

interface DisplayNameEditorProps {
  onUpdate?: () => void;
}

export const DisplayNameEditor: React.FC<DisplayNameEditorProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user) {
      loadCurrentDisplayName();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCurrentDisplayName = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("display_name, discord_username")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading display name:", error);
        setMessage({ type: "error", text: "Failed to load current display name" });
        return;
      }

      setCurrentDisplayName(data?.display_name || null);
      setDiscordUsername(data?.discord_username || null);
      setDisplayName(data?.display_name || "");
    } catch (err) {
      console.error("Unexpected error loading display name:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate display name
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setMessage({ type: "error", text: "Display name cannot be empty" });
      return;
    }

    if (trimmedName.length < 2) {
      setMessage({ type: "error", text: "Display name must be at least 2 characters" });
      return;
    }

    if (trimmedName.length > 50) {
      setMessage({ type: "error", text: "Display name must be 50 characters or less" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: trimmedName })
        .eq("id", user.id);

      if (error) {
        console.error("Error updating display name:", error);
        setMessage({ type: "error", text: `Failed to update: ${error.message}` });
        return;
      }

      setCurrentDisplayName(trimmedName);
      setMessage({ type: "success", text: "Display name updated successfully!" });

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error("Unexpected error updating display name:", err);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to Discord username or current display name
    const resetValue = discordUsername || currentDisplayName || "";
    setDisplayName(resetValue);
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const hasChanges = displayName.trim() !== currentDisplayName;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        ✏️ Display Name
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">
        Your display name is shown to other users throughout the Dynasty Cube (messages, teams, etc.).
      </p>

      {discordUsername && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Discord Username:</strong> {discordUsername}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={50}
            disabled={saving}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {displayName.length}/50 characters
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              saving || !hasChanges
                ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
            }`}
          >
            {saving ? "Saving..." : "Save Display Name"}
          </button>

          {hasChanges && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisplayNameEditor;
