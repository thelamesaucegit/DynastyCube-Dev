// src/lib/scryfall-client.ts

/**
 * Scryfall API Client
 * https://scryfall.com/docs/api
 *
 * Rate Limits:
 * - Insert 50-100ms delay between requests (~10 requests/second)
 * - Bulk data updates happen once per day
 */

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const REQUEST_DELAY_MS = 100; // 100ms between requests

// Track last request time to enforce rate limiting
let lastRequestTime = 0;

/**
 * Enforces rate limiting by waiting if needed
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    const waitTime = REQUEST_DELAY_MS - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Scryfall Card Object (simplified)
 */
export interface ScryfallCard {
  id: string; // UUID
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  rarity: string;
  type_line: string;
  
  // --- ADDED ORACLE TEXT FIELDS ---
  oracle_text?: string;
  card_faces?: Array<{
    name?: string;
    oracle_text?: string;
  }>;
  // --------------------------------

  colors?: string[];
  color_identity?: string[];
  mana_cost?: string;
  cmc: number;
  released_at: string;
  edhrec_rank?: number; // Lower is more popular
  legalities: {
    standard?: 'legal' | 'not_legal' | 'banned';
    pioneer?: 'legal' | 'not_legal' | 'banned';
    modern?: 'legal' | 'not_legal' | 'banned';
    legacy?: 'legal' | 'not_legal' | 'banned' | 'restricted';
    vintage?: 'legal' | 'not_legal' | 'banned' | 'restricted';
    pauper?: 'legal' | 'not_legal' | 'banned';
  };
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
}

export async function searchAllCards(
  query: string
): Promise<{
  cards: ScryfallCard[];
  errors: string[];
}> {
  const allCards: ScryfallCard[] = [];
  const errors: string[] = [];
  let next_page: string | null = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}`;

  try {
    while (next_page) {
      await waitForRateLimit();
      
      const response: Response = await fetch(next_page);
      if (!response.ok) {
        let errorDetails = response.statusText;
        try {
            const errBody = await response.json();
            errorDetails = errBody?.details || JSON.stringify(errBody);
        } catch (e) { /* ignore json parse error */ }

        const errorMessage = `Scryfall API error on page ${next_page}: ${response.status} - ${errorDetails}`;
        console.error("[Scryfall] ❌", errorMessage);
        errors.push(errorMessage);
        break; // Stop pagination on error
      }

      const pageData = await response.json();
      allCards.push(...pageData.data);
      
      if (pageData.has_more) {
        next_page = pageData.next_page;
      } else {
        next_page = null;
      }
    }
  } catch (error: unknown) {
    const message = `A critical error occurred during Scryfall search pagination for query "${query}"`;
    if (error instanceof Error) errors.push(`${message}: ${error.message}`);
    else errors.push(message);
    console.error("[Scryfall] ❌", message, error);
  }

  return { cards: allCards, errors };
}

export async function fetchOldestPrintings(oracleIds: string[]): Promise<Map<string, string>> {
  // --- THE FIX: SANITIZE ORACLE IDS TO PREVENT 400 BAD REQUEST ---
  const validIds = oracleIds.filter(id => id && typeof id === 'string' && id.trim().length > 0);

  if (validIds.length === 0) {
    return new Map();
  }

  await waitForRateLimit();
  const imageUrlMap = new Map<string, string>();
  
  const identifiers = validIds.map(id => ({ oracle_id: id }));
  
  try {
    const url = `${SCRYFALL_API_BASE}/cards/collection`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });

    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
          const errBody = await response.json();
          errorDetails = errBody?.details || JSON.stringify(errBody);
      } catch (e) { /* ignore */ }
      throw new Error(`Scryfall API error fetching collection by oracle_id: ${response.status} - ${errorDetails}`);
    }
    
    const result = await response.json();
    const foundCards: ScryfallCard[] = result.data || [];
    
    const cardsByOracle = new Map<string, ScryfallCard[]>();
    for (const card of foundCards) {
        if (!cardsByOracle.has(card.oracle_id)) {
            cardsByOracle.set(card.oracle_id, []);
        }
        cardsByOracle.get(card.oracle_id)!.push(card);
    }
    
    for (const [oracleId, cards] of cardsByOracle.entries()) {
        cards.sort((a, b) => new Date(a.released_at).getTime() - new Date(b.released_at).getTime());
        const oldestCard = cards[0];
        const imageUrl = oldestCard.image_uris?.normal || oldestCard.image_uris?.small;
        if (imageUrl) {
            imageUrlMap.set(oracleId, imageUrl);
        }
    }
    
    return imageUrlMap;
  } catch (error) {
    console.error("[Scryfall] ❌ Error in fetchOldestPrintings:", error);
    return new Map(); 
  }
}

/**
 * Search for a card by exact name
 */
export async function searchCardByName(cardName: string): Promise<ScryfallCard | null> {
  if (!cardName || cardName.trim() === "") return null;

  await waitForRateLimit();
  try {
    const url = `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(cardName)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[Scryfall] ⚠️ Card not found: ${cardName}`);
        return null;
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }

    const data: ScryfallCard = await response.json();
    return data;
  } catch (error: unknown) { 
    let message = `Error fetching card "${cardName}"`;
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error("[Scryfall] ❌", message);
    return null;
  }
}

/**
 * Fetch multiple cards by name using the collection endpoint
 * Maximum 75 cards per request
 */
export async function fetchCardCollection(
  cardNames: string[]
): Promise<{ data: ScryfallCard[]; not_found: Array<{ name: string }> }> {
  // Sanitize to be absolutely safe
  const validNames = cardNames.filter(name => name && typeof name === 'string' && name.trim().length > 0);
  if (validNames.length === 0) return { data: [], not_found: [] };

  await waitForRateLimit();
  try {
    const batch = validNames.slice(0, 75);
    const identifiers = batch.map(name => ({ name }));
    const url = `${SCRYFALL_API_BASE}/cards/collection`;
    
    console.log(`[Scryfall] 📡 Fetching collection for ${batch.length} cards...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifiers }),
    });

    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
          const errBody = await response.json();
          errorDetails = errBody?.details || errBody?.warnings?.join(', ') || JSON.stringify(errBody);
      } catch (e) { /* ignore */ }
      throw new Error(`Scryfall API error: ${response.status} - ${errorDetails}`);
    }

    const result = await response.json();
    
    if (result.data && result.data.length > 0) {
        console.log(`[Scryfall] ✅ Successfully fetched ${result.data.length} cards.`);
        const sample = result.data[0] as ScryfallCard;
        console.log(`[Scryfall] 🔍 Sample Card Check (${sample.name}):`);
        console.log(`  - Has Oracle ID? ${!!sample.oracle_id}`);
        console.log(`  - Has Oracle Text? ${!!sample.oracle_text}`);
        console.log(`  - Has Card Faces? ${!!sample.card_faces}`);
    }

    return {
      data: result.data || [],
      not_found: result.not_found || [],
    };
  } catch (error: unknown) { 
    let message = "Error fetching card collection";
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error("[Scryfall] ❌", message);
    return { data: [], not_found: cardNames.map(name => ({ name })) };
  }
}

/**
 * Fetch cards in batches to respect the 75-card limit
 * Returns all successfully fetched cards and list of not found cards
 */
export async function fetchAllCards(
  cardNames: string[]
): Promise<{
  cards: ScryfallCard[];
  notFound: string[];
  errors: string[];
}> {
  const allCards: ScryfallCard[] = [];
  const notFoundCards: string[] = [];
  const errors: string[] = [];

  // --- THE FIX: SANITIZE CARD NAMES TO PREVENT 400 BAD REQUEST ---
  const validNames = [...new Set(cardNames.filter(name => name && typeof name === 'string' && name.trim().length > 0))];

  console.log(`[Scryfall] 🚀 Starting fetchAllCards batch process for ${validNames.length} valid cards...`);

  for (let i = 0; i < validNames.length; i += 75) {
    const batch = validNames.slice(i, i + 75);
    try {
      const result = await fetchCardCollection(batch);
      allCards.push(...result.data);
      notFoundCards.push(...result.not_found.map(nf => nf.name));
    } catch (error: unknown) { 
      let message = `Error processing batch starting at index ${i}`;
      if (error instanceof Error) message = `${message}: ${error.message}`;
      console.error("[Scryfall] ❌", message);
      errors.push(message);
    }
  }

  console.log(`[Scryfall] 🎉 Batch complete. Found: ${allCards.length}, Missing: ${notFoundCards.length}`);

  return {
    cards: allCards,
    notFound: notFoundCards,
    errors,
  };
}

/**
 * Get card by Scryfall ID
 */
export async function getCardById(scryfallId: string): Promise<ScryfallCard | null> {
  await waitForRateLimit();
  try {
    const url = `${SCRYFALL_API_BASE}/cards/${scryfallId}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[Scryfall] ⚠️ Card not found with ID: ${scryfallId}`);
        return null;
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }

    const data: ScryfallCard = await response.json();
    return data;
  } catch (error: unknown) { 
    let message = `Error fetching card by ID "${scryfallId}"`;
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error("[Scryfall] ❌", message);
    return null;
  }
}

/**
 * Extract rating data from Scryfall card
 */
export function extractRatingData(card: ScryfallCard) {
  return {
    scryfallId: card.id,
    edhrecRank: card.edhrec_rank || null,
    updatedAt: new Date().toISOString(),
  };
}
