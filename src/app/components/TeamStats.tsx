// src/app/components/TeamStats.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getTeamStatistics } from "@/app/actions/statsActions";
import type { TeamStatistics } from "@/app/actions/statsActions";

interface TeamStatsProps {
  teamId: string;
}

// Color mapping for MTG colors
const COLOR_MAP: { [key: string]: { name: string; color: string; emoji: string } } = {
  W: { name: "White", color: "#F8F6D8", emoji: "☀️" },
  U: { name: "Blue", color: "#0E68AB", emoji: "💧" },
  B: { name: "Black", color: "#150B00", emoji: "💀" },
  R: { name: "Red", color: "#D3202A", emoji: "🔥" },
  G: { name: "Green", color: "#00733E", emoji: "🌲" },
};

export const TeamStats: React.FC<TeamStatsProps> = ({ teamId }) => {
  const [stats, setStats] = useState<TeamStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { stats: teamStats, error: statsError } = await getTeamStatistics(teamId);
      if (statsError) {
        setError(statsError);
      } else {
        setStats(teamStats);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
        <p className="text-red-800 dark:text-red-200">
          {error || "Failed to load statistics"}
        </p>
      </div>
    );
  }

  const maxColorCount = Math.max(...Object.values(stats.colorDistribution), 1);
  const _maxTypeCount = Math.max(...Object.values(stats.typeDistribution), 1);
  const maxCMCCount = Math.max(...Object.values(stats.cmcDistribution), 1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {stats.totalCards}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            Total Cards
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
            {stats.totalDecks}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            Total Decks
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border border-green-200 dark:border-green-700 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
            {stats.averageCMC}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            Average CMC
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border border-orange-200 dark:border-orange-700 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
            {stats.recentPicks}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            Recent Picks (7d)
          </div>
        </div>
      </div>

      {/* Color Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          🎨 Color Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.colorDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([color, count]) => {
              const colorInfo = COLOR_MAP[color] || { name: color, color: "#999", emoji: "⚪" };
              const percentage = (count / stats.totalCards) * 100;
              const barWidth = (count / maxColorCount) * 100;

              return (
                <div key={color} className="flex items-center gap-3">
                  <div className="w-32 flex items-center gap-2">
                    <span className="text-xl">{colorInfo.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {colorInfo.name}
                    </span>
                  </div>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 flex items-center justify-end px-2"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: colorInfo.color,
                      }}
                    >
                      <span className="text-xs font-bold text-white mix-blend-difference">
                        {count}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm text-gray-600 dark:text-gray-400">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Card Type Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          📚 Card Type Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(stats.typeDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const percentage = (count / stats.totalCards) * 100;

              return (
                <div
                  key={type}
                  className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {count}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {type}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Mana Curve */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          📊 Mana Curve
        </h3>
        <div className="flex items-end justify-center gap-2 h-64">
          {Object.entries(stats.cmcDistribution)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .filter(([cmc]) => parseInt(cmc) <= 10) // Show CMC 0-10
            .map(([cmc, count]) => {
              const height = (count / maxCMCCount) * 100;
              const percentage = (count / stats.totalCards) * 100;

              return (
                <div key={cmc} className="flex flex-col items-center gap-1 flex-1 max-w-16">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {count}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden relative group">
                    <div
                      className="bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 transition-all duration-500 rounded-t-lg"
                      style={{ height: `${height * 2}px`, minHeight: count > 0 ? "4px" : "0" }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold text-white">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {cmc === "10" ? "10+" : cmc}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Rarity Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          💎 Rarity Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.rarityDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([rarity, count]) => {
              const percentage = (count / stats.totalCards) * 100;
              const rarityLower = rarity.toLowerCase();

              // Explicit class mappings for proper Tailwind compilation
              let cardClasses = "";
              let numberClasses = "";

              if (rarityLower === "common") {
                cardClasses = "bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600";
                numberClasses = "text-gray-600 dark:text-gray-300";
              } else if (rarityLower === "uncommon") {
                cardClasses = "bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-600";
                numberClasses = "text-blue-600 dark:text-blue-300";
              } else if (rarityLower === "rare") {
                cardClasses = "bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600";
                numberClasses = "text-yellow-700 dark:text-yellow-300";
              } else if (rarityLower === "mythic") {
                cardClasses = "bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-600";
                numberClasses = "text-orange-600 dark:text-orange-300";
              } else {
                cardClasses = "bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600";
                numberClasses = "text-gray-600 dark:text-gray-300";
              }

              return (
                <div
                  key={rarity}
                  className={`${cardClasses} rounded-lg p-4 text-center`}
                >
                  <div className={`text-3xl font-bold ${numberClasses} mb-1`}>
                    {count}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize mb-1">
                    {rarity}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
