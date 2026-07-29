// src/app/support/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getPublicExpenseStats, type PublicExpenseSummary, type PublicMonthlyExpense } from "@/app/actions/devExpenseActions";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Loader2, DollarSign, ChevronDown, ChevronUp, ExternalLink, Code } from "lucide-react";
import { TargetedGlitchedText } from '@/app/components/lore/TargetedGlitchedText';

export default function SupportPage() {
  const [stats, setStats] = useState<PublicExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({}); 


   useEffect(() => {
    async function load() {
      const { stats: fetchedStats } = await getPublicExpenseStats();
      if (fetchedStats) {
        setStats(fetchedStats);
        if (fetchedStats.yearlyBreakdown.length > 0) {
          const latestYear = fetchedStats.yearlyBreakdown[0];
          setExpandedYears({ [latestYear.year]: true });
          if (latestYear.monthlyBreakdown.length > 0) {
            // Auto-expand the most recent month of the most recent year
            setExpandedMonths({ [latestYear.monthlyBreakdown[0].month]: true });
          }
        }
      }
      setLoading(false);
    }
    load();
  }, []);

   const toggleYear = (year: string) => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  const toggleMonth = (month: string) => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] })); 

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 className="animate-spin h-10 w-10 mx-auto mb-4 text-blue-600" />
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (!stats) return null;

  const totalOwedRemaining = Math.max(0, stats.grandTotalDevOwed - stats.grandTotalDevPaid);
  const totalFundingGap = Math.max(0, stats.grandTotalCost - stats.grandTotalRaised);
  const fundingPercentage = Math.min(100, (stats.grandTotalRaised / stats.grandTotalCost) * 100) || 0;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black tracking-tight mb-4">
          <TargetedGlitchedText>Support The Dynasty Cube</TargetedGlitchedText>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          We believe in 100% financial transparency. Every cent raised goes directly to paying our developer and keeping the servers running.
        </p>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-bold uppercase tracking-wider mb-2">Total Operating Cost</p>
            <p className="text-4xl font-black text-blue-950 dark:text-blue-100">{formatCurrency(stats.grandTotalCost)}</p>
            <p className="text-xs text-muted-foreground mt-2">Hosting & Dev Hours</p>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider mb-2">Community Funded</p>
            <p className="text-4xl font-black text-emerald-950 dark:text-emerald-100">{formatCurrency(stats.grandTotalRaised)}</p>
            <div className="w-full bg-emerald-200 dark:bg-emerald-950 h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${fundingPercentage}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-red-800 dark:text-red-300 font-bold uppercase tracking-wider mb-2">Remaining Deficit</p>
            <p className="text-4xl font-black text-red-950 dark:text-red-100">{formatCurrency(totalFundingGap)}</p>
            <p className="text-xs text-red-600/70 dark:text-red-400 mt-2">Funded out of pocket</p>
          </CardContent>
        </Card>
      </div>

      {/* THE PITCH */}
      <Card className="mb-12 border-primary shadow-lg relative overflow-hidden">
        
        <CardContent className="pt-8 text-center sm:text-left sm:flex gap-8 items-center">
          <div className="shrink-0 mb-6 sm:mb-0 hidden sm:block">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center border-4 border-background shadow-xl">
              <Code className="size-10 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-card-foreground">
              The Dynasty Cube is a 2-person dev team. I — THE COMMISSIONER — am happy to operate at a loss, as this is my passion project. However, my friend and dev partner <strong>(itstoxicqt)</strong> has more than earned what I can afford to pay him for his work.
            </p>
            <p className="text-lg leading-relaxed text-card-foreground mt-4">
              Every cent you donate to The Dynasty Cube <strong>FIRST</strong> goes to itstoxicqt to cover any outstanding balance for the hours he&apos;s worked. Then, it goes towards the historic hosting costs of this site. Anything we raise after that will be split evenly between itstoxicqt and I, and everything will always be visible right here.
            </p>
          </div>
        </CardContent>
      </Card>

     
      {/* YEARLY BREAKDOWN */}
      <h2 className="text-2xl font-black text-center mb-6">Historical Ledger</h2>
      <div className="space-y-4">
        {stats.yearlyBreakdown.map((yearStat) => {
          const isYearExpanded = expandedYears[yearStat.year];
          return (
            <Card key={yearStat.year} className="overflow-hidden">
              <div 
                className="bg-muted/50 p-4 cursor-pointer hover:bg-muted transition-colors flex justify-between items-center"
                onClick={() => toggleYear(yearStat.year)}
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold">{yearStat.year}</h3>
                  <Badge variant={yearStat.totalCost <= yearStat.raisedAmount ? "default" : "secondary"}>
                    {yearStat.totalCost <= yearStat.raisedAmount ? "Fully Funded" : "Deficit"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                  <span className="hidden sm:inline text-muted-foreground">
                    Cost: {formatCurrency(yearStat.totalCost)}
                  </span>
                  {isYearExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                </div>
              </div>
              
              {isYearExpanded && (
                <CardContent className="p-4 sm:p-6">
                  {/* Monthly Breakdown */}
                  <div className="space-y-2">
                    {yearStat.monthlyBreakdown.map((monthStat) => {
                      const isMonthExpanded = expandedMonths[monthStat.month];
                      return (
                        <div key={monthStat.month} className="border rounded-lg overflow-hidden">
                          <div
                            className="flex justify-between items-center p-3 bg-background cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleMonth(monthStat.month)}
                          >
                            <span className="font-semibold">{monthStat.monthLabel}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">{formatCurrency(monthStat.totalCost)}</span>
                              {isMonthExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </div>
                          </div>

                          {isMonthExpanded && (
                            <div className="p-4 border-t bg-muted/20">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <span className="text-muted-foreground">Dev Labor Cost:</span>
                                <span className="text-right font-medium">{formatCurrency(monthStat.devOwed)}</span>

                                <span className="text-muted-foreground">Dev Paid:</span>
                                <span className="text-right font-medium text-emerald-600">{formatCurrency(monthStat.devPaid)}</span>
                                
                                <span className="text-muted-foreground">Hosting Cost:</span>
                                <span className="text-right font-medium">{formatCurrency(monthStat.hostingCost)}</span>
                                
                                {monthStat.customCosts.map(c => (
                                  <React.Fragment key={c.id}>
                                    <span className="text-muted-foreground">{c.description}:</span>
                                    <span className="text-right font-medium">{formatCurrency(c.amount)}</span>
                                  </React.Fragment>
                                ))}

                                <span className="text-muted-foreground border-t pt-2 mt-2">Total Raised:</span>
                                <span className="text-right font-bold text-emerald-600 border-t pt-2 mt-2">{formatCurrency(monthStat.raisedAmount)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

       {/* DONATION WIDGETS */}
      <h2 className="text-2xl font-black text-center mb-6">Support The Dynasty Cube!</h2>
      <div className="grid sm:grid-cols-2 gap-6 mb-16">
        
        {/* PATREON */}
        <Card className="hover:shadow-lg transition-shadow border-orange-200 dark:border-orange-900/50">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#FF424D] rounded-full flex items-center justify-center mb-4 shadow-md">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604-3.13 1.48-4.71 4.28-4.303 7.82.359 3.126 2.754 5.372 5.56 6.3 1.745.576 3.59.882 5.433.916 3.65.068 7.375-.205 9.873-2.617 1.83-1.768 2.025-4.332 2.012-6.541zM2.87 23.998c0-3.328-.016-6.657.009-9.985.006-.826.353-1.258 1.107-1.391.758-.135 1.54-.035 2.308.066.906.12 1.25.565 1.256 1.472.014 2.872.008 5.744.004 8.616-.002.825-.333 1.286-1.11 1.408-.755.12-1.54.02-2.306-.067-.933-.105-1.257-.591-1.26-1.517-.006-2.868-.008-5.736-.008-8.602z"/>
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2">Become a Patron</h3>
            <p className="text-sm text-muted-foreground mb-6">Join the community on Patreon to get exclusive rewards and support continuous development.</p>
            <Button asChild className="w-full bg-[#FF424D] hover:bg-[#E63946] text-white">
              <a href="https://patreon.com/TheDynastyCube" target="_blank" rel="noopener noreferrer">
                Support on Patreon <ExternalLink className="size-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* KO-FI */}
        <Card className="hover:shadow-lg transition-shadow border-blue-200 dark:border-blue-900/50">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#29abe0] rounded-full flex items-center justify-center mb-4 shadow-md">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.46-.091-3.71.951-1.252 2.805-1.086 4.053.078.077.071.127.143.178.21.05-.067.1-.139.178-.209 1.248-1.164 3.103-1.33 4.053-.078.95 1.25.618 2.745-.091 3.71h.001zM20.936 9.87c-.15 1.63-1.42 2.308-2.613 2.493V7.753c1.077.013 2.561.47 2.732 1.488l-.119.629z"/>
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2">Buy Us a Coffee</h3>
            <p className="text-sm text-muted-foreground mb-6">Make a one-time donation easily through Ko-fi to help chip away at the deficit!</p>
            <Button asChild className="w-full bg-[#29abe0] hover:bg-[#2088b3] text-white">
              <a href="https://ko-fi.com/dynastycube" target="_blank" rel="noopener noreferrer">
                Support on Ko-fi <ExternalLink className="size-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
