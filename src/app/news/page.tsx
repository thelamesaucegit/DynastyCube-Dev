// src/app/news/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminNews, type AdminNews } from "@/app/actions/homeActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Loader2, CalendarDays, User, ArrowLeft, Newspaper, AlertCircle, ArrowRight, X } from "lucide-react";
import { TargetedGlitchedText } from "@/app/components/lore/TargetedGlitchedText";


export default function NewsPage() {
  const [news, setNews] = useState<AdminNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<AdminNews | null>(null); // <-- NEW STATE
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    setError(null);
    try {
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
        <h1 className="text-4xl font-bold tracking-tight mb-2">League News</h1>
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
            <h2 className="text-2xl font-bold mb-2">No News Yet</h2>
            <p className="text-muted-foreground">Check back soon for updates and announcements!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Featured Post (first item) */}
          {news.length > 0 && (
            <Card 
              className="overflow-hidden cursor-pointer transition-all hover:shadow-lg border-transparent hover:border-primary/50 group"
              onClick={() => setSelectedNews(news[0])}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>Latest</Badge>
                </div>
                <CardTitle className="text-3xl group-hover:text-primary transition-colors">
                  <TargetedGlitchedText text={news[0].title}/>
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(news[0].created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {news[0].author_name}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {/* Truncated view */}
                <p className="leading-relaxed whitespace-pre-line text-muted-foreground line-clamp-4">
                  <TargetedGlitchedText text={news[0].content}/>
                </p>
                <div className="mt-4 flex justify-end">
                   <span className="text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    Read full story <ArrowRight className="ml-1 size-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remaining posts in grid */}
          {news.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {news.slice(1).map((newsItem) => (
                <Card 
                  key={newsItem.id} 
                  className="transition-all hover:shadow-md cursor-pointer border-transparent hover:border-primary/50 group flex flex-col"
                  onClick={() => setSelectedNews(newsItem)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
                      <TargetedGlitchedText text={newsItem.title}/>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(newsItem.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {newsItem.author_name}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4 flex-1">
                      <TargetedGlitchedText text={newsItem.content}/>
                    </p>
                    <div className="mt-4 flex justify-end">
                       <span className="text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                        Read full story <ArrowRight className="ml-1 size-3" />
                      </span>
                    </div>
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

      {/* --- MODAL OVERLAY --- */}
      {selectedNews && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedNews(null)}
        >
          <div 
            className="bg-background border border-border shadow-2xl rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex justify-between items-start bg-muted/30">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  <TargetedGlitchedText text={selectedNews.title}/>
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(selectedNews.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {selectedNews.author_name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNews(null)}
                className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="whitespace-pre-line text-base md:text-lg leading-relaxed text-foreground/90">
                <TargetedGlitchedText text={selectedNews.content}/>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
