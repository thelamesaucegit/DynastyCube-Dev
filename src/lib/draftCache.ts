// src/lib/draftCache.ts
"use server";

import { cache } from 'react';
import { createServerClient } from '@/lib/supabase'; // Make sure this path is correct for your project

/**
 * A simple module-level cache that will persist for the lifetime of the server process.
 * This provides a longer-lived cache across different user requests.
 */
let duplicateCardIdSet: Set<string> | null = null;

/**
 * An efficient, cached function to get a Set of all card_ids that have more than one instance in the pool.
 * It uses React's `cache` to prevent re-running the same DB query multiple times within a single request.
 * It also uses the module-level variable for a longer-lived cache.
 */
export const getDuplicateCardIdSet = cache(async (): Promise<Set<string>> => {
  if (duplicateCardIdSet) {
    console.log("Returning duplicate card ID set from module cache.");
    return duplicateCardIdSet;
  }

  console.log("No cache found. Querying database for duplicate cards.");
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('card_pools')
    .select('card_id');

  if (error) {
    console.error("Failed to query for duplicate cards:", error);
    return new Set<string>(); // Return an empty set on error
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
      if (row.card_id) {
        counts[row.card_id] = (counts[row.card_id] || 0) + 1;
      }
  }
  
  const duplicates = Object.keys(counts).filter(card_id => counts[card_id] > 1);
        
  const newSet = new Set(duplicates);
  duplicateCardIdSet = newSet;
  
  console.log(`Cached ${newSet.size} card IDs that have duplicates.`);
  return newSet;
});

/**
 * Call this function whenever the card pool is modified (cards added or removed)
 * to ensure the cache is cleared and re-fetched on the next request.
 */
export function invalidateDraftCache(): void {
  console.log("Draft cache invalidated due to card pool modification.");
  duplicateCardIdSet = null;
}
