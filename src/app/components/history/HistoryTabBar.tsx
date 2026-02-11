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
    <div className="history-tabs">
      <button
        className={`history-tab ${activeTab === "league" ? "active" : ""}`}
        onClick={() => onTabChange("league")}
      >
        The League
      </button>
      {teams.map((team) => (
        <button
          key={team.id}
          className={`history-tab ${activeTab === team.id ? "active" : ""}`}
          onClick={() => onTabChange(team.id)}
        >
          {team.emoji} {team.name}
        </button>
      ))}
    </div>
  );
};
