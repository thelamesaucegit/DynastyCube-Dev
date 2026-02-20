// src/app/components/admin/CardRatingSync.tsx
"use client";

import React, { useState } from "react";
import {
  updateAllCubecobraElo,
  updatePoolCubecobraElo,
  updateDraftPickCubecobraElo,
  testCubecobraElo,
} from "@/app/actions/cardRatingActions";

export const CardRatingSync: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testCardName, setTestCardName] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await updateAllCubecobraElo();

      if (!res.success) {
        setError(res.message || "Failed to sync CubeCobra ELO");
        return;
      }

      const poolMsg = res.poolResult?.message || "";
      const draftMsg = res.draftResult?.message || "";

      setResult(
        `✅ CubeCobra ELO Sync Complete!\n\nCard Pools: ${poolMsg}\n\nDraft Picks: ${draftMsg}\n\nOverall: ${res.message}`
      );

      if (res.poolResult?.errors && res.poolResult.errors.length > 0) {
        console.error("CubeCobra pool sync errors:", res.poolResult.errors);
      }
      if (res.draftResult?.errors && res.draftResult.errors.length > 0) {
        console.error("CubeCobra draft pick sync errors:", res.draftResult.errors);
      }
    } catch (err) {
      console.error("Unexpected error during CubeCobra sync:", err);
      setError(`Unexpected error: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncPools = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await updatePoolCubecobraElo();

      if (!res.success) {
        setError(res.message || "Failed to sync CubeCobra pool ELO");
        return;
      }

      setResult(`✅ CubeCobra Pool ELO Sync Complete!\n\n${res.message}`);

      if (res.errors && res.errors.length > 0) {
        console.error("CubeCobra pool sync errors:", res.errors);
      }
    } catch (err) {
      console.error("Unexpected error during CubeCobra pool sync:", err);
      setError(`Unexpected error: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncDrafts = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await updateDraftPickCubecobraElo();

      if (!res.success) {
        setError(res.message || "Failed to sync CubeCobra draft pick ELO");
        return;
      }

      setResult(`✅ CubeCobra Draft Pick ELO Sync Complete!\n\n${res.message}`);

      if (res.errors && res.errors.length > 0) {
        console.error("CubeCobra draft pick sync errors:", res.errors);
      }
    } catch (err) {
      console.error("Unexpected error during CubeCobra draft pick sync:", err);
      setError(`Unexpected error: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestCard = async () => {
    if (!testCardName.trim()) {
      setTestResult("Please enter a card name");
      return;
    }

    setTestResult("Searching CubeCobra...");

    try {
      const res = await testCubecobraElo(testCardName.trim());

      if (!res.success) {
        setTestResult(`❌ ${res.message}`);
        return;
      }

      setTestResult(
        `✅ Found: ${testCardName.trim()}\nCubeCobra ELO: ${res.elo?.toLocaleString()}\nCube: ${res.cubeName}`
      );
    } catch (err) {
      setTestResult(`Error: ${err}`);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">🎲 CubeCobra ELO Sync</h2>
        <p className="admin-section-description">
          Sync card ELO ratings from CubeCobra (The Dynasty Cube)
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
          ℹ️ About CubeCobra ELO
        </h4>
        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
          <li>
            <strong>CubeCobra ELO:</strong> Higher numbers = stronger cards
          </li>
          <li>Based on draft pick data from CubeCobra users</li>
          <li>Fetches from CubeCobra API (entire cube in one request)</li>
          <li>Only cards currently in the cube will have ELO ratings</li>
          <li>Cards not in the cube are gracefully skipped</li>
        </ul>
      </div>

      {/* Test Single Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🔍 Test CubeCobra ELO Lookup
        </h3>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={testCardName}
            onChange={(e) => setTestCardName(e.target.value)}
            placeholder="Enter card name (e.g., Sol Ring)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            onKeyDown={(e) => e.key === "Enter" && handleTestCard()}
          />
          <button
            onClick={handleTestCard}
            className="admin-btn admin-btn-secondary"
          >
            Test
          </button>
        </div>
        {testResult && (
          <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm whitespace-pre-wrap">
            {testResult}
          </pre>
        )}
      </div>

      {/* Sync Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={handleSyncPools}
          disabled={syncing}
          className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6"
        >
          <span className="text-2xl">🎴</span>
          <span className="font-semibold">Sync Pool ELO</span>
          <span className="text-sm opacity-80">
            Update CubeCobra ELO for pool cards
          </span>
        </button>

        <button
          onClick={handleSyncDrafts}
          disabled={syncing}
          className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6"
        >
          <span className="text-2xl">📑</span>
          <span className="font-semibold">Sync Draft ELO</span>
          <span className="text-sm opacity-80">
            Update CubeCobra ELO for drafted cards
          </span>
        </button>

        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <span className="text-2xl">🔄</span>
          <span className="font-semibold">Sync All ELO</span>
          <span className="text-sm opacity-80">
            Update all CubeCobra ELO at once
          </span>
        </button>
      </div>

      {/* Loading State */}
      {syncing && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Syncing CubeCobra ELO...
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Fetching cube data and updating ratings. Please don&apos;t close
                this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">❌ {error}</p>
        </div>
      )}

      {/* Success Message */}
      {result && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <pre className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
};
