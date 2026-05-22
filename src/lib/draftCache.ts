// src/lib/draftCache.ts
"use server";

import { cache } from 'react';
import { createServerClient, type AnySupabaseClient } from '@/lib/supabase';
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logSystemEvent } from "@/lib/systemLogger";

function createServiceClient() {
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

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
export const getDuplicateCardIdSet = cache(async (adminClient?: AnySupabaseClient): Promise<Set<string>> => {
  if (duplicateCardIdSet) {
    return duplicateCardIdSet;
  }

  // Use the provided admin client, or fallback to the service client to avoid cookie errors in background jobs.
  const supabase = adminClient ?? createServiceClient();
  
  const { data, error } = await supabase
    .from('card_pools')
    .select('card_id');

  if (error) {
    await logSystemEvent("DraftCache", "error", "Failed to query for duplicate cards.", { error: error.message });
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
  
  return newSet;
});

/**
 * Call this function whenever the card pool is modified (cards added or removed)
 * to ensure the cache is cleared and re-fetched on the next request.
 */
export async function invalidateDraftCache(): Promise<void> {
  duplicateCardIdSet = null;
}
