// src/app/glossary/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GlossaryList } from "@/components/glossary/GlossaryList";
import {
  getGlossaryItems,
  type GlossaryItem,
} from "@/app/actions/glossaryActions";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, Search, X, BookOpen, AlertCircle } from "lucide-react";

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
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Glossary</h1>
        <p className="text-lg text-muted-foreground">
          Terms, rules, and mechanics of the Dynasty Cube
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          className="pl-10 pr-10"
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Alphabet Quick Jump */}
      {uniqueLetters.length > 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {uniqueLetters.map((letter) => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="inline-flex"
            >
              <Badge
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer text-xs px-2 py-0.5"
              >
                {letter}
              </Badge>
            </a>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading glossary...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Terms Found</h2>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search query"
                : "The glossary is empty"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <GlossaryList items={filteredItems} />
      )}
    </div>
  );
}
