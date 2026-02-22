// src/lib/draftCache.ts
import { cache } from 'react';
import { createServerClient } from '@/lib/supabase';

// This is a simple in-memory cache that will persist as long as the server process is alive.
// It's a fallback for environments where `cache` might not be sufficient.
let duplicateCardIdSet: Set<string> | null = null;

/**
 * An efficient, cached function to get a Set of all card_ids that have more than one instance in the pool.
 * It uses React's `cache` to prevent re-running the same DB query multiple times within a single request.
 * It also uses a module-level variable for a longer-lived cache across requests.
 */
export const getDuplicateCardIdSet = cache(async (): Promise<Set<string>> => {
  // If our longer-lived cache already has the data, return it immediately.
  if (duplicateCardIdSet) {
    console.log("Returning duplicate set from module cache.");
    return duplicateCardIdSet;
  }

  console.log("No cache found. Querying database for duplicate cards.");
  const supabase = await createServerClient();
  
  // This is the most efficient query to find card_ids with more than one entry.
  const { data, error } = await supabase
    .from('card_pools')
    .select('card_id, count:card_id')
    .gt('count', 1)
    .then(response => {
      // A trick to satisfy Supabase v2's GROUP BY which is not directly supported in the JS client.
      // We manually group and filter. This is less ideal but works with the library.
      // A cleaner way if you had direct SQL access would be GROUP BY + HAVING.
      if (response.error) return response;
      
      const counts: Record<string, number> = {};
      for (const row of response.data || []) {
          counts[row.card_id] = (counts[row.card_id] || 0) + 1;
      }
      
      const duplicates = Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([card_id]) => ({ card_id }));
        
      return { data: duplicates, error: null };
    });

  if (error) {
    console.error("Failed to query for duplicate cards:", error);
    return new Set<string>(); // Return an empty set on error
  }

  // Store the result in both the long-lived module cache and let React cache it.
  const newSet = new Set((data || []).map(item => item.card_id));
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
