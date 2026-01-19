// src/app/components/admin/CMCDataManagement.tsx
"use client";

import React, { useState } from "react";
import { backfillAllCMCData } from "@/app/actions/adminActions";

export const CMCDataManagement: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    draftPicksUpdated: number;
    cardPoolsUpdated: number;
    totalFailed: number;
    errors: string[];
  } | null>(null);

  const handleBackfill = async () => {
    if (processing) return;

    const confirmed = window.confirm(
      "This will fetch CMC data from Scryfall for all cards missing this information. This may take a few minutes. Continue?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setResult(null);

    try {
      const response = await backfillAllCMCData();
      setResult(response);
    } catch (error) {
      console.error("Error during CMC backfill:", error);
      setResult({
        success: false,
        draftPicksUpdated: 0,
        cardPoolsUpdated: 0,
        totalFailed: 0,
        errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
      <div className="mb-4">
        <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          CMC Data Management
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Backfill missing Converted Mana Cost (CMC) data for cards in the pool and draft picks.
          This is required for mana curve statistics to display correctly.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 italic">
          This tool fetches card data from Scryfall API to populate missing CMC values.
        </p>
      </div>

      {/* Backfill Button */}
      <button
        onClick={handleBackfill}
        disabled={processing}
        className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition-all ${
          processing
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl"
        }`}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          "🔄 Backfill CMC Data"
        )}
      </button>

      {/* Results Display */}
      {result && (
        <div
          className={`mt-6 p-4 rounded-lg border ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {result.success ? "✅" : "❌"}
            </span>
            <div className="flex-1">
              <h4
                className={`font-semibold mb-2 ${
                  result.success
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {result.success ? "CMC Backfill Complete!" : "CMC Backfill Encountered Errors"}
              </h4>

              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Card Pools
                    </div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {result.cardPoolsUpdated}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Updated</div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Draft Picks
                    </div>
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {result.draftPicksUpdated}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Updated</div>
                  </div>

                  {result.totalFailed > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Failed
                      </div>
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">
                        {result.totalFailed}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Cards</div>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Errors:
                    </div>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc max-h-40 overflow-y-auto">
                      {result.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          💡 <strong>When to use:</strong> Run this tool if you notice mana curve statistics
          are not displaying correctly on team statistics pages. This typically happens when
          cards were added to the database before CMC tracking was implemented.
        </p>
      </div>
    </div>
  );
};
