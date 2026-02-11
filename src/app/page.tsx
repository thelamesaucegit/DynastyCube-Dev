// src/app/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/Layout';
import '@/styles/pages/home.css';
import CountdownTimer from '@/components/CountdownTimer';
import {
  getRecentDraftPicks,
  getCurrentSeason,
  getAdminNews,
  getRecentGames,
  getActiveCountdownTimer,
  type RecentDraftPick,
  type CurrentSeason,
  type AdminNews,
  type RecentGame,
  type CountdownTimer as CountdownTimerType,
} from '@/app/actions/homeActions';

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export default function HomePage() {
  const [season, setSeason] = useState<CurrentSeason | null>(null);
  const [adminNews, setAdminNews] = useState<AdminNews[]>([]);
  const [recentPicks, setRecentPicks] = useState<RecentDraftPick[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [countdownTimer, setCountdownTimer] = useState<CountdownTimerType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seasonResult, newsResult, picksResult, gamesResult, timerResult] = await Promise.all([
        getCurrentSeason(),
        getAdminNews(3),
        getRecentDraftPicks(5),
        getRecentGames(5),
        getActiveCountdownTimer(),
      ]);

      setSeason(seasonResult.season);
      setAdminNews(newsResult.news);
      setRecentPicks(picksResult.picks);
      setRecentGames(gamesResult.games);
      setCountdownTimer(timerResult.timer);
    } catch (error) {
      console.error('Error loading home page data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWinnerName = (game: RecentGame) => {
    if (!game.winner_id) return 'Draw';
    return game.winner_id === game.team1_id ? game.team1_name : game.team2_name;
  };

  const getWinnerEmoji = (game: RecentGame) => {
    if (!game.winner_id) return '🤝';
    return game.winner_id === game.team1_id ? game.team1_emoji : game.team2_emoji;
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <div className="home-page-wrapper">
      <div className="home-page">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Welcome to The Dynasty Cube
        </h1>
        <div className="logo-container">
          <Image
            src="/images/logo/logo.jpg"
            alt="Dynasty Cube"
            width={300}
            height={300}
            className="hero-logo"
          />
        </div>
        <p className="hero-subtitle">
          A collaborative, living draft format
        </p>
      </div>

      {/* Countdown Timer */}
      {countdownTimer && (
        <CountdownTimer
          title={countdownTimer.title}
          endTime={countdownTimer.end_time}
          linkUrl={countdownTimer.link_url}
          linkText={countdownTimer.link_text}
        />
      )}

      {/* Current Season Banner */}
      {season && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800 text-white rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">{season.name}</h2>
              <p className="text-blue-100">
                Started {new Date(season.start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <span className={`inline-block px-4 py-2 rounded-full font-semibold ${
                season.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
              } text-white`}>
                {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* Admin News Section */}
        <div className="content-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Admin News
            </h2>
            <span className="text-2xl">📢</span>
          </div>
          {adminNews.length > 0 ? (
            <>
              <div className="space-y-4">
                {adminNews.map((news) => (
                  <div
                    key={news.id}
                    className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {news.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                      {news.content}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(news.created_at).toLocaleDateString()} • {news.author_name}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/news"
                className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
              >
                View all news →
              </Link>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No news available yet. Check back soon!
            </p>
          )}
        </div>

        {/* Recent Drafts Section */}
        <div className="content-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Recent Draft Picks
            </h2>
            <span className="text-2xl">🎴</span>
          </div>
          {recentPicks.length > 0 ? (
            <>
              <div className="space-y-3">
                {recentPicks.map((pick) => (
                  <div
                    key={pick.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-l-4 border-blue-500 dark:border-blue-400"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                          {pick.card_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span className="mr-1">{pick.team_emoji}</span>
                          <span className="font-medium">{pick.team_name}</span>
                          {pick.pick_number && <> • Pick #{pick.pick_number}</>}
                        </p>
                        <div className="flex items-center gap-2">
                          {pick.card_type && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                              {pick.card_type}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getRelativeTime(pick.drafted_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/pools"
                className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
              >
                View all draft picks →
              </Link>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No draft picks yet. Check back once the draft begins!
            </p>
          )}
        </div>
      </div>

      {/* Recent Games Section - Full Width */}
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Recent Games & Results
          </h2>
          <span className="text-2xl">🏆</span>
        </div>
        {recentGames.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-600">
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Matchup
                    </th>
                    <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Winner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((game) => (
                    <tr
                      key={game.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(game.played_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        <span className="mr-1">{game.team1_emoji}</span>
                        {game.team1_name} vs <span className="mr-1">{game.team2_emoji}</span>
                        {game.team2_name}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-900 dark:text-gray-100">
                        {game.team1_score}-{game.team2_score}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        <span className="inline-flex items-center">
                          <span className="mr-2">{getWinnerEmoji(game)}</span>
                          {getWinnerName(game)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              href="/schedule"
              className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              View full schedule & results →
            </Link>
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No games played yet. Check back once the season starts!
          </p>
        )}
      </div>

      {/* CubeCobra Link */}
      <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
        <p className="text-center text-amber-800 dark:text-amber-300">
          <a
            href="https://cubecobra.com/cube/overview/TheDynastyCube"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit our CubeCobra page
          </a>
          {" "}for complete cube details and card lists.
        </p>
      </div>
      </div>
    </div>
  );
}