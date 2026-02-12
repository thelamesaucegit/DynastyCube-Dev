// src/app/news/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminNews, type AdminNews } from "@/app/actions/homeActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Loader2, CalendarDays, User, ArrowLeft, Newspaper, AlertCircle } from "lucide-react";

export default function NewsPage() {
  const [news, setNews] = useState<AdminNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all published news (no limit)
      const result = await getAdminNews(100);
      if (result.error) {
        setError(result.error);
      } else {
        setNews(result.news);
      }
    } catch (err) {
      console.error("Error loading news:", err);
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading news...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Community News
        </h1>
        <p className="text-lg text-muted-foreground">
          Stay updated with the latest announcements from The Dynasty Cube
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* News List */}
      {news.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              No News Yet
            </h2>
            <p className="text-muted-foreground">
              Check back soon for updates and announcements!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Featured Post (first item) */}
          {news.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>Latest</Badge>
                </div>
                <CardTitle className="text-3xl">
                  {news[0].title}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(news[0].created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {news[0].author_name}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed whitespace-pre-line">
                  {news[0].content}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Remaining posts in grid */}
          {news.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {news.slice(1).map((newsItem) => (
                <Card key={newsItem.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl line-clamp-2">
                      {newsItem.title}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(newsItem.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {newsItem.author_name}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4">
                      {newsItem.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Back to Home Link */}
      <div className="mt-8 text-center">
        <Button variant="ghost" asChild>
          <Link href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
