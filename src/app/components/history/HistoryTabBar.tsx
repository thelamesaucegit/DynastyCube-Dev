// src/app/components/history/HistoryTabBar.tsx
"use client";

import React from "react";
import type { TeamBasic } from "@/app/actions/historyActions";

interface HistoryTabBarProps {
  teams: TeamBasic[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const HistoryTabBar: React.FC<HistoryTabBarProps> = ({
  teams,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto mb-6 pb-0">
      <button
        className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
          activeTab === "league"
            ? "text-primary border-primary"
            : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50"
        } -mb-px`}
        onClick={() => onTabChange("league")}
      >
        The League
      </button>
      {teams.map((team) => (
        <button
          key={team.id}
          className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === team.id
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50"
          } -mb-px`}
          onClick={() => onTabChange(team.id)}
        >
          {team.emoji} {team.name}
        </button>
      ))}
    </div>
  );
};
