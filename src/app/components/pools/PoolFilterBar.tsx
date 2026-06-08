// src/app/components/pools/PoolFilterBar.tsx
"use client";

import React from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

export const COLOR_OPTIONS = [
  { value: "all", label: "All", emoji: "🌈" },
  { value: "W", label: "White", emoji: "⚪" },
  { value: "U", label: "Blue", emoji: "🔵" },
  { value: "B", label: "Black", emoji: "⚫" },
  { value: "R", label: "Red", emoji: "🔴" },
  { value: "G", label: "Green", emoji: "🟢" },
  { value: "colorless", label: "Colorless", emoji: "◇" },
];

export const DEFAULT_CUBUCKS_RANGES = [
  { value: "all", label: "All Costs" },
  { value: "0-1", label: "0-1 Çubucks" },
  { value: "2-3", label: "2-3 Çubucks" },
  { value: "4-5", label: "4-5 Çubucks" },
  { value: "6-9", label: "6-9 Çubucks" },
  { value: "10+", label: "10+ Çubucks" },
];

interface PoolFilterBarProps {
  searchTerm: string; setSearchTerm: (val: string) => void;
  filterColors: string[]; setFilterColors: (val: string[] | ((prev: string[]) => string[])) => void;
  matchAllColors: boolean; setMatchAllColors: (val: boolean) => void;
  excludeUnselected: boolean; setExcludeUnselected: (val: boolean) => void;
  filterType: string; setFilterType: (val: string) => void;
  filterRarity: string; setFilterRarity: (val: string) => void;
  filterCmc: string; setFilterCmc: (val: string) => void;
  filterCubucks: string; setFilterCubucks: (val: string) => void;
  sortBy: string; setSortBy: (val: string) => void;
  sortOrder: "asc" | "desc"; setSortOrder: (val: "asc" | "desc") => void;
  
  uniqueTypes: string[];
  cubucksRanges?: { value: string; label: string }[];
  
  // Optional Status Filter (Used by Draft Pool, ignored by others)
  showStatusFilter?: boolean;
  filterStatus?: string;
  setFilterStatus?: (val: string) => void; // <-- THE FIX: Strict typing 'string' instead of 'any'
  
  // Footer Stats
  filteredCount: number;
  totalCount: number;
  currentPage: number;
  cardsPerPage: number;
}

export function PoolFilterBar({
  searchTerm, setSearchTerm, filterColors, setFilterColors, matchAllColors, setMatchAllColors,
  excludeUnselected, setExcludeUnselected, filterType, setFilterType, filterRarity, setFilterRarity,
  filterCmc, setFilterCmc, filterCubucks, setFilterCubucks, sortBy, setSortBy, sortOrder, setSortOrder,
  uniqueTypes, cubucksRanges = DEFAULT_CUBUCKS_RANGES, showStatusFilter = false, filterStatus, setFilterStatus,
  filteredCount, totalCount, currentPage, cardsPerPage
}: PoolFilterBarProps) {

  const toggleColor = (value: string) => {
    if (value === "all") {
      setFilterColors([]);
      return;
    }
    setFilterColors((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  return (
    <Card className="mb-8">
      <CardContent className="pt-6 space-y-6">
        {/* Row 1: Search & Colors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="text" maxLength={100} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Card name or text..." className="pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Color <span className="text-xs font-normal opacity-60">(select multiple)</span></label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => {
                const isActive = color.value === "all" ? filterColors.length === 0 : filterColors.includes(color.value);
                return (
                  <button key={color.value} onClick={() => toggleColor(color.value)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {color.emoji} {color.label}
                  </button>
                );
              })}
            </div>
            {/* Strict Color Toggles */}
            {filterColors.length > 0 && (
              <div className="mt-3 flex flex-col sm:flex-row gap-4 sm:gap-6">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  <input type="checkbox" checked={matchAllColors} onChange={(e) => setMatchAllColors(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                  Must include ALL selected
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  <input type="checkbox" checked={excludeUnselected} onChange={(e) => setExcludeUnselected(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                  Exclude unselected colors
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* Row 2: Select Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {showStatusFilter && setFilterStatus && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="All Cards" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Cards</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="drafted">Drafted</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Rarity</label>
            <Select value={filterRarity} onValueChange={setFilterRarity}>
              <SelectTrigger><SelectValue placeholder="All Rarities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="uncommon">Uncommon</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
                <SelectItem value="mythic">Mythic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Mana Cost</label>
            <Select value={filterCmc} onValueChange={setFilterCmc}>
              <SelectTrigger><SelectValue placeholder="All CMC" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All CMC</SelectItem><SelectItem value="0-1">0–1 Mana</SelectItem><SelectItem value="2-3">2–3 Mana</SelectItem><SelectItem value="4-5">4–5 Mana</SelectItem><SelectItem value="6+">6+ Mana</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Cubucks</label>
            <Select value={filterCubucks} onValueChange={setFilterCubucks}>
              <SelectTrigger><SelectValue placeholder="All Costs" /></SelectTrigger>
              <SelectContent>
                {cubucksRanges.map(range => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 3: Sorting */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="card_name">Card Name</SelectItem>
                <SelectItem value="cmc">Mana Cost (CMC)</SelectItem>
                <SelectItem value="cubucks_cost">Cubucks Cost</SelectItem>
                <SelectItem value="elo">ELO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Order</label>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  <SelectValue placeholder="Order" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground pt-2 border-t border-border/50">
          {filteredCount === 0
            ? `0 of ${totalCount} cards`
            : `Showing ${Math.min((currentPage - 1) * cardsPerPage + 1, filteredCount)}–${Math.min(currentPage * cardsPerPage, filteredCount)} of ${filteredCount} cards`
          }
        </div>
      </CardContent>
    </Card>
  );
}
