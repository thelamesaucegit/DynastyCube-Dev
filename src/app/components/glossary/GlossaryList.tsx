// src/app/components/glossary/GlossaryList.tsx
"use client";

import React, { useMemo } from "react";
import { HistoryEntryRenderer } from "@/components/history/HistoryEntryRenderer";
import type { GlossaryItem } from "@/app/actions/glossaryActions";

interface GlossaryListProps {
  items: GlossaryItem[];
}

export const GlossaryList: React.FC<GlossaryListProps> = ({ items }) => {
  // Group items by uppercase first letter
  const groupedItems = useMemo(() => {
    const groups = new Map<string, GlossaryItem[]>();

    items.forEach((item) => {
      const firstChar = item.term.charAt(0).toUpperCase();
      // Group non-alpha characters under "#"
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";

      if (!groups.has(letter)) {
        groups.set(letter, []);
      }
      groups.get(letter)!.push(item);
    });

    // Sort the keys alphabetically, with "#" at the end
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    return sortedEntries;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="glossary-empty">
        <div className="glossary-empty-icon">📖</div>
        <div className="glossary-empty-text">No terms found</div>
        <div className="glossary-empty-sub">
          Try adjusting your search or check back later.
        </div>
      </div>
    );
  }

  return (
    <div>
      {groupedItems.map(([letter, letterItems]) => (
        <div key={letter} id={`letter-${letter}`} className="glossary-letter-group">
          <h2 className="glossary-letter-heading">{letter}</h2>
          {letterItems.map((item) => (
            <div key={item.id} className="glossary-entry">
              <h3 className="glossary-term">{item.term}</h3>
              <div className="glossary-definition">
                <HistoryEntryRenderer content={item.definition} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
