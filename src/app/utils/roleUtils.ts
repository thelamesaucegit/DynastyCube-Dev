// src/app/utils/roleUtils.ts

export type TeamRole = "captain" | "broker" | "historian" | "pilot";

/**
 * Get role description
 */
export function getRoleDescription(role: TeamRole): string {
  const descriptions: Record<TeamRole, string> = {
    captain: "Has full administrative control. Can assign roles, add members, and make all team decisions.",
    broker: "Handles draft picks and trades. Manages the team's card pool and negotiates with other teams.",
    historian: "Records team history. Documents matches, maintains statistics, and writes team narratives.",
    pilot: "Plays matches with team decks. Represents the team in competitive play and reports results.",
  };

  return descriptions[role];
}

/**
 * Get role emoji
 */
export function getRoleEmoji(role: TeamRole): string {
  const emojis: Record<TeamRole, string> = {
    captain: "👑",
    broker: "🤝",
    historian: "📜",
    pilot: "⚔️",
  };

  return emojis[role];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: TeamRole): string {
  const names: Record<TeamRole, string> = {
    captain: "Captain",
    broker: "Broker",
    historian: "Historian",
    pilot: "Pilot",
  };

  return names[role];
}
