// src/app/utils/seasonPhaseUtils.ts
// Client-side utility functions for season phase display

export type SeasonPhase = "preseason" | "season" | "playoffs" | "postseason";

/**
 * Get phase display name
 */
export function getPhaseDisplayName(phase: SeasonPhase): string {
  const names: Record<SeasonPhase, string> = {
    preseason: "Pre-Season",
    season: "Regular Season",
    playoffs: "Playoffs",
    postseason: "Post-Season",
  };
  return names[phase] || phase;
}

/**
 * Get phase icon
 */
export function getPhaseIcon(phase: SeasonPhase): string {
  const icons: Record<SeasonPhase, string> = {
    preseason: "🏗️",
    season: "⚔️",
    playoffs: "🏆",
    postseason: "🎉",
  };
  return icons[phase] || "📅";
}

/**
 * Get phase color
 */
export function getPhaseColor(phase: SeasonPhase): string {
  const colors: Record<SeasonPhase, string> = {
    preseason: "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 border-gray-400",
    season: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-400",
    playoffs: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-400",
    postseason: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-400",
  };
  return colors[phase] || colors.season;
}
