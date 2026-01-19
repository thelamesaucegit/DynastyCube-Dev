// src/app/components/admin/CardRatingSync.tsx
"use client";

import React, { useState } from "react";
import {
  updateAllCardRatings,
  updatePoolCardRatings,
  updateDraftPickRatings,
  getCardRating,
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
      const res = await updateAllCardRatings();

      if (!res.success) {
        setError(res.message || "Failed to sync ratings");
        return;
      }

      const poolMsg = res.poolResult?.message || "";
      const draftMsg = res.draftResult?.message || "";

      setResult(
        `✅ Sync Complete!\n\nCard Pools: ${poolMsg}\n\nDraft Picks: ${draftMsg}\n\nOverall: ${res.message}`
      );

      // Log any errors
      if (res.poolResult?.errors && res.poolResult.errors.length > 0) {
        console.error("Pool sync errors:", res.poolResult.errors);
      }
      if (res.draftResult?.errors && res.draftResult.errors.length > 0) {
        console.error("Draft pick sync errors:", res.draftResult.errors);
      }
    } catch (err) {
      console.error("Unexpected error during sync:", err);
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
      const res = await updatePoolCardRatings();

      if (!res.success) {
        setError(res.message || "Failed to sync pool ratings");
        return;
      }

      setResult(`✅ Pool Sync Complete!\n\n${res.message}`);

      if (res.errors && res.errors.length > 0) {
        console.error("Pool sync errors:", res.errors);
      }
    } catch (err) {
      console.error("Unexpected error during pool sync:", err);
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
      const res = await updateDraftPickRatings();

      if (!res.success) {
        setError(res.message || "Failed to sync draft pick ratings");
        return;
      }

      setResult(`✅ Draft Pick Sync Complete!\n\n${res.message}`);

      if (res.errors && res.errors.length > 0) {
        console.error("Draft pick sync errors:", res.errors);
      }
    } catch (err) {
      console.error("Unexpected error during draft pick sync:", err);
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

    setTestResult("Searching...");

    try {
      const res = await getCardRating(testCardName.trim());

      if (!res.success) {
        setTestResult(`❌ ${res.message}`);
        return;
      }

      if (res.card) {
        const edhrecInfo = res.card.edhrec_rank
          ? `EDHREC Rank: ${res.card.edhrec_rank.toLocaleString()}`
          : "EDHREC Rank: N/A";

        setTestResult(`✅ Found: ${res.card.name}\n${edhrecInfo}\nSet: ${res.card.set_name} (${res.card.set})\nScryfall ID: ${res.card.id}`);
      }
    } catch (err) {
      setTestResult(`Error: ${err}`);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">📊 Card Rating Sync</h2>
        <p className="admin-section-description">
          Sync card power ratings from Scryfall (EDHREC Rank)
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ About Card Ratings
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
          <li>
            <strong>EDHREC Rank:</strong> Lower numbers = more popular cards
          </li>
          <li>Based on real deck usage data from EDHREC</li>
          <li>Syncs data from Scryfall API (rate-limited to 10 req/sec)</li>
          <li>Updates take ~1 minute per 750 cards</li>
          <li>Not all cards have ratings (new/obscure cards may be missing)</li>
        </ul>
      </div>

      {/* Test Single Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🔍 Test Single Card
        </h3>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={testCardName}
            onChange={(e) => setTestCardName(e.target.value)}
            placeholder="Enter card name (e.g., Lightning Bolt)"
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
          <span className="font-semibold">Sync Card Pools</span>
          <span className="text-sm opacity-80">
            Update ratings for pool cards
          </span>
        </button>

        <button
          onClick={handleSyncDrafts}
          disabled={syncing}
          className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6"
        >
          <span className="text-2xl">📑</span>
          <span className="font-semibold">Sync Draft Picks</span>
          <span className="text-sm opacity-80">
            Update ratings for drafted cards
          </span>
        </button>

        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="admin-btn admin-btn-primary flex flex-col items-center gap-2 py-6 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <span className="text-2xl">🔄</span>
          <span className="font-semibold">Sync Everything</span>
          <span className="text-sm opacity-80">
            Update all cards at once
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
                Syncing ratings...
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This may take a few minutes depending on the number of cards.
                Please don&apos;t close this page.
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

      {/* CubeCobra Info */}
      <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
          🎲 Future: CubeCobra ELO
        </h4>
        <p className="text-sm text-purple-800 dark:text-purple-200">
          CubeCobra ELO ratings are not yet available via public API. If
          CubeCobra releases a public API in the future, we can add that as an
          additional rating source. The database is already prepared with a{" "}
          <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">
            cubecobra_elo
          </code>{" "}
          column.
        </p>
      </div>
    </div>
  );
};
