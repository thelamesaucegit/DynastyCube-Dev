// src/app/glossary/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { GlossaryList } from "@/components/glossary/GlossaryList";
import {
  getGlossaryItems,
  type GlossaryItem,
} from "@/app/actions/glossaryActions";
import "@/styles/pages/glossary.css";
import "@/styles/pages/history.css";

export default function GlossaryPage() {
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadGlossary = async () => {
      try {
        const result = await getGlossaryItems();
        if (result.error) {
          setError(result.error);
        } else {
          setItems(result.items);
        }
      } catch {
        setError("Failed to load glossary");
      } finally {
        setLoading(false);
      }
    };

    loadGlossary();
  }, []);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Extract unique first letters for quick-jump navigation
  const uniqueLetters = useMemo(() => {
    const letters = new Set<string>();
    filteredItems.forEach((item) => {
      const firstChar = item.term.charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      letters.add(letter);
    });
    return Array.from(letters).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [filteredItems]);

  return (
    <Layout>
      <div className="glossary-page">
        {/* Header */}
        <div className="glossary-header">
          <h1>Glossary</h1>
          <p>Terms, rules, and mechanics of the Dynasty Cube</p>
        </div>

        {/* Search Bar */}
        <div className="glossary-search">
          <input
            type="text"
            className="glossary-search-input"
            placeholder="Search terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="glossary-search-clear"
              onClick={() => setSearchQuery("")}
            >
              Clear
            </button>
          )}
        </div>

        {/* Alphabet Quick Jump */}
        {uniqueLetters.length > 0 && !loading && (
          <div className="glossary-alphabet">
            {uniqueLetters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="glossary-alphabet-link"
              >
                {letter}
              </a>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading glossary...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : (
          <GlossaryList items={filteredItems} />
        )}
      </div>
    </Layout>
  );
}
