// src/app/page.tsx
"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

export default function Page() {
  const router = useRouter();

  const teams = [
    {
      name: "Alara Shards",
      href: "/teams/shards",
      emoji: "🌟",
      motto: "Why not both?",
    },
    {
      name: "Kamigawa Ninja",
      href: "/teams/ninja",
      emoji: "⛩",
      motto: "Omae wa mou shindeiru.",
    },
    {
      name: "Innistrad Creeps",
      href: "/teams/creeps",
      emoji: "🧟",
      motto: "Graveyard, Gatekeep, Girlboss",
    },
    {
      name: "Theros Demigods",
      href: "/teams/demigods",
      emoji: "🌞",
      motto: "The Fates will decide",
    },
    {
      name: "Ravnica Guildpact",
      href: "/teams/guildpact",
      emoji: "🔗",
      motto:
        "A Championship is won and lost before ever entering the battlefield",
    },
    {
      name: "Lorwyn Changelings",
      href: "/teams/changelings",
      emoji: "👽",
      motto: "Expect the unexpected",
    },
    {
      name: "Zendikar Hedrons",
      href: "/teams/hedrons",
      emoji: "💠",
      motto: "Good Vibes, No Escape",
    },
    {
      name: "Tarkir Dragons",
      href: "/teams/dragons",
      emoji: "🐲",
      motto: "No cost too great",
    },
  ];

  const handleTeamClick = (href: string, teamName: string) => {
    // possible antalytics
    console.log(`Navigating to ${teamName}`);
    router.push(href);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent,
    href: string,
    teamName: string,
  ) => {
    // Handle Enter and Space key presses for accessibility
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTeamClick(href, teamName);
    }
  };

  return (
    <Layout>
      <div className="text-center text-gray-300">
        <div className="hero-section">
          <h3 className="text-2xl font-semibold">Teams</h3>
          <p className="hero-subtitle">Meet the Teams</p>
        </div>

        <div className="teams-grid">
          {teams.map((team, index) => (
            <button
              key={index}
              className="team-card"
              onClick={() => handleTeamClick(team.href, team.name)}
              onKeyDown={(e) => handleKeyDown(e, team.href, team.name)}
              aria-label={`View ${team.name} team page - ${team.motto}`}
              type="button"
            >
              <span className="team-emoji" aria-hidden="true">
                {team.emoji}
              </span>
              <span className="team-name">{team.name}</span>
              <span className="team-motto">&quot;{team.motto}&quot;</span>
            </button>
          ))}
        </div>

        <div className="content-divider mt-8"></div>
      </div>
    </Layout>
  );
}
