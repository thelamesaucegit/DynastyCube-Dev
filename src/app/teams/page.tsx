// src/app/page.tsx
import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

export default function Page() {
  const teams = [
    {
      name: "Alara Shards",
      href: "/teams/shards",
      emoji: "🌟",
      motto: "Why not both?"
    },
    {
      name: "Kamigawa Ninja",
      href: "/teams/ninja",
      emoji: "⛩",
      motto: "Omae wa mou shindeiru."
    },
    {
      name: "Innistrad Creeps",
      href: "/teams/creeps",
      emoji: "🧟",
      motto: "Graveyard, Gatekeep, Girlboss"
    },
    {
      name: "Theros Demigods",
      href: "/teams/demigods",
      emoji: "🌞",
      motto: "The Fates will decide"
    },
    {
      name: "Ravnica Guildpact",
      href: "/teams/guildpact",
      emoji: "🔗",
      motto: "A Championship is won and lost before ever entering the battlefield"
    },
    {
      name: "Lorwyn Changelings",
      href: "/teams/changelings",
      emoji: "👽",
      motto: "Expect the unexpected"
    },
    {
      name: "Zendikar Hedrons",
      href: "/teams/hedrons",
      emoji: "💠",
      motto: "Good Vibes, No Escape"
    },
    {
      name: "Tarkir Dragons",
      href: "/teams/dragons",
      emoji: "🐲",
      motto: "No cost too great"
    }
  ];

  return (
    <Layout>
      <div className="text-center text-gray-300">
        <div className="hero-section">
          <h3 className="text-2xl font-semibold">Teams</h3>
          <p className="hero-subtitle">Meet the Teams</p>
        </div>
        
        <div className="teams-container">
          {teams.map((team, index) => (
            <div key={index} className="team-item">
              <span className="team-emoji">{team.emoji}</span>
              <Link href={team.href} className="team-link text-blue-400">
                <strong>{team.name}</strong>
              </Link>
              <div className="team-motto">
                &quot;{team.motto}&quot;
              </div>
            </div>
          ))}
        </div>
        
        <div className="content-divider mt-8"></div>
      </div>
    </Layout>
  );
}