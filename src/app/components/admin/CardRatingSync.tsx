"use client";
import { 
  updateAllCubecobraElo,
  debugEloSync // <-- ADD THIS
} from "@/app/actions/cardRatingActions";


import React, { useState } from "react";
import { updateAllCubecobraElo } from "@/app/actions/cardRatingActions";

export const CardRatingSync: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
// ... inside the CardRatingSync component
const [debugResult, setDebugResult] = useState<string | null>(null);

const handleDebug = async () => {
  setDebugResult("Running debug check...");
  const res = await debugEloSync();
  setDebugResult(JSON.stringify(res, null, 2)); // Pretty-print the JSON response
  console.log("Debug Result:", res);
};

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await updateAllCubecobraElo();
      if (!res.success) {
        setError(res.message || "Failed to sync CubeCobra ELO. Check server logs for more details.");
        return;
      }

      const poolMsg = res.poolResult?.message || "Pools: No action taken.";
      const draftMsg = res.draftResult?.message || "Drafts: No action taken.";
      setResult(
        `✅ CubeCobra ELO Sync Complete!\n\n${poolMsg}\n${draftMsg}\n\nOverall: ${res.message}`
      );

      if (res.poolResult?.errors && res.poolResult.errors.length > 0) {
        console.error("CubeCobra pool sync errors:", res.poolResult.errors);
      }
      if (res.draftResult?.errors && res.draftResult.errors.length > 0) {
        console.error("CubeCobra draft pick sync errors:", res.draftResult.errors);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Unexpected error during CubeCobra sync:", err);
      setError(`An unexpected error occurred: ${errorMessage}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">🎲 CubeCobra ELO Sync</h2>
        <p className="admin-section-description">
          Sync all card ELO ratings from the official CubeCobra public data source.
        </p>
      </div>

      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
          ℹ️ About the ELO Sync
        </h4>
        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
          <li>
            <strong>Source:</strong> Fetches data directly from CubeCobra&apos;s public S3 bucket, ensuring the most comprehensive and up-to-date ELO ratings.
          </li>
          <li>
            <strong>Process:</strong> This will update the ELO for all cards in both the main Card Pools and all drafted Team Picks in a single operation.
          </li>
          <li>This may take a few moments to complete as it processes the entire card database.</li>
        </ul>
      </div>
{/* --- DEBUG TOOL --- */}
<div className="mb-6 border-2 border-dashed border-red-500 p-4 rounded-lg">
    <h3 className="font-bold text-red-600">Debug Tool</h3>
    <p className="text-sm mb-3">If sync isn&apos;t working, click this to inspect the data matching.</p>
    <button onClick={handleDebug} className="admin-btn admin-btn-danger">
        Run Debug Check
    </button>
    {debugResult && (
        <pre className="mt-4 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-xs whitespace-pre-wrap font-mono">
            {debugResult}
        </pre>
    )}
</div>
{/* --- END DEBUG TOOL --- */}

      <div className="mb-6">
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="admin-btn admin-btn-primary w-full flex flex-col items-center gap-2 py-8 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-3xl">🔄</span>
          <span className="font-semibold text-lg">
            {syncing ? "Syncing ELO..." : "Sync All Card ELO from CubeCobra"}
          </span>
          <span className="text-sm opacity-80">
            Updates all cards in the database.
          </span>
        </button>
      </div>

      {syncing && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Syncing CubeCobra ELO...
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Fetching data from the S3 bucket and updating your database. Please don&apos;t close this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
          <h4 className="font-bold text-red-900 dark:text-red-100">Sync Failed</h4>
          <p className="text-red-800 dark:text-red-200 mt-1">❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <pre className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap font-mono">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
};
