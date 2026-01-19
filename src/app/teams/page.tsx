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
      <div className="text-center">
        <div className="py-8">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Teams</h3>
          <p className="text-lg text-gray-700 dark:text-gray-300">Meet the Teams</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 my-8">
          {teams.map((team, index) => (
            <button
              key={index}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all text-center group"
              onClick={() => handleTeamClick(team.href, team.name)}
              onKeyDown={(e) => handleKeyDown(e, team.href, team.name)}
              aria-label={`View ${team.name} team page - ${team.motto}`}
              type="button"
            >
              <span className="text-5xl mb-3 block group-hover:scale-110 transition-transform" aria-hidden="true">
                {team.emoji}
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 block mb-2">{team.name}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 italic block">&quot;{team.motto}&quot;</span>
            </button>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-300 dark:border-gray-700"></div>
      </div>
    </Layout>
  );
}
