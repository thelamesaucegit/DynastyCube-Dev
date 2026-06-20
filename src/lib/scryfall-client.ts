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

// --- NEW: Custom Headers to satisfy Scryfall's strict User-Agent policy ---
const SCRYFALL_HEADERS = {
  "User-Agent": "DynastyCube/1.0",
  "Accept": "application/json"
};

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
      
      // Inject Headers
      const response: Response = await fetch(next_page, { headers: SCRYFALL_HEADERS });
      
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
    console.error(message, error);
  }

  return {
    cards: allCards,
    errors,
  };
}


export async function fetchOldestPrintings(oracleIds: string[]): Promise<Map<string, string>> {
  const validIds = [...new Set(oracleIds.filter(id => id && typeof id === 'string' && id.trim().length > 0))];
  
  if (validIds.length === 0) {
    return new Map();
  }

  const imageUrlMap = new Map<string, string>();
  
  // We can safely batch up to 20 Oracle IDs at a time because the query output is now guaranteed 
  // to be exactly 1 card per Oracle ID!
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
    const batch = validIds.slice(i, i + BATCH_SIZE);
    
    // Construct the query: (oracle_id:id1 or oracle_id:id2) prefer:oldest
    const idQueries = batch.map(id => `oracle_id:${id}`).join(" or ");
    const query = `(${idQueries}) prefer:oldest`; // THE MAGIC: automatically filters out all reprints!
    
    let nextPageUrl: string | null = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}`;

    try {
      while (nextPageUrl) {
        await waitForRateLimit();
        
const response: Response = await fetch(nextPageUrl, { headers: SCRYFALL_HEADERS });
        
        if (!response.ok) {
          break;
        }

        const result = await response.json();
        const foundCards = (result.data || []) as ScryfallCard[];

        // Because Scryfall used 'prefer:oldest', each card in foundCards is GUARANTEED 
        // to be the absolute oldest, first printing of its oracle_id. No sorting required!
        for (const card of foundCards) {
          const imageUrl = card.image_uris?.normal || card.image_uris?.small;
          if (imageUrl && card.oracle_id) {
            imageUrlMap.set(card.oracle_id, imageUrl);
          }
        }
        
        nextPageUrl = result.has_more ? result.next_page : null;
      }
    } catch (error) {
      console.error(`Error in fetchOldestPrintings (Batch starting at index ${i}):`, error);
    }
  }

  return imageUrlMap;
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
  colors?: string[];
  color_identity?: string[];
  mana_cost?: string;
  cmc: number;
  oracle_text?: string;
  card_faces?: Array<{
    name?: string;
    oracle_text?: string;
  }>;
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

/**
 * Search for a card by exact name
 */
export async function searchCardByName(cardName: string): Promise<ScryfallCard | null> {
  if (!cardName || cardName.trim() === "") return null;

  await waitForRateLimit();
  try {
    const url = `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(cardName)}`;
    
    // Inject Headers
    const response = await fetch(url, { headers: SCRYFALL_HEADERS });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Card not found: ${cardName}`);
        return null;
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }
    const data: ScryfallCard = await response.json();
    return data;
  } catch (error: unknown) { // --- FIX: Use 'unknown' for type safety ---
    let message = `Error fetching card "${cardName}"`;
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error(message);
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
  const validNames = cardNames.filter(name => name && typeof name === 'string' && name.trim().length > 0);
  if (validNames.length === 0) return { data: [], not_found: [] };

  await waitForRateLimit();
  try {
    const batch = validNames.slice(0, 75);
    const identifiers = batch.map(name => ({ name }));
    const url = `${SCRYFALL_API_BASE}/cards/collection`;
    const response = await fetch(url, {
      method: "POST",
      // Inject Headers + Content-Type
      headers: { ...SCRYFALL_HEADERS, "Content-Type": "application/json" },
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
    return {
      data: result.data || [],
      not_found: result.not_found || [],
    };
  } catch (error: unknown) { // --- FIX: Use 'unknown' for type safety ---
    let message = "Error fetching card collection";
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error(message);
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

  const validNames = [...new Set(cardNames.filter(name => name && typeof name === 'string' && name.trim().length > 0))];

  console.log(`[Scryfall] 🚀 Starting fetchAllCards batch process for ${validNames.length} valid cards...`);

  for (let i = 0; i < validNames.length; i += 75) {
    const batch = validNames.slice(i, i + 75);
    try {
      const result = await fetchCardCollection(batch);
      allCards.push(...result.data);
      notFoundCards.push(...result.not_found.map(nf => nf.name));
    } catch (error: unknown) { // --- FIX: Use 'unknown' for type safety ---
      let message = `Error processing batch starting at index ${i}`;
      if (error instanceof Error) message = `${message}: ${error.message}`;
      console.error(message);
      errors.push(message);
    }
  }
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
    
    // Inject Headers
    const response = await fetch(url, { headers: SCRYFALL_HEADERS });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Card not found with ID: ${scryfallId}`);
        return null;
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }
    const data: ScryfallCard = await response.json();
    return data;
  } catch (error: unknown) { // --- FIX: Use 'unknown' for type safety ---
    let message = `Error fetching card by ID "${scryfallId}"`;
    if (error instanceof Error) message = `${message}: ${error.message}`;
    console.error(message);
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

export async function fetchOldestPrintingsByName(cardNames: string[]): Promise<Map<string, { id: string, oracle_id: string, image_url: string }>> {
  const validNames = [...new Set(cardNames.filter(n => n && typeof n === 'string' && n.trim().length > 0))];
  const result = new Map<string, { id: string, oracle_id: string, image_url: string }>();

  if (validNames.length === 0) return result;

  // Batching 15 at a time to prevent URL length limits with long card names
  const BATCH_SIZE = 15;

  for (let i = 0; i < validNames.length; i += BATCH_SIZE) {
    const batch = validNames.slice(i, i + BATCH_SIZE);
    
    // Construct the query: (!"Name 1" or !"Name 2") prefer:oldest
    // We strip internal quotes from card names to prevent syntax breaking
    const nameQueries = batch.map(name => `!"${name.replace(/"/g, '')}"`).join(" or ");
    const query = `(${nameQueries}) prefer:oldest`;
    
    let nextPageUrl: string | null = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}`;

    try {
      while (nextPageUrl) {
        await waitForRateLimit();
        
        const response: Response = await fetch(nextPageUrl, { headers: SCRYFALL_HEADERS });
        if (!response.ok) break;

        const resJson = await response.json();
        const foundCards = (resJson.data || []) as ScryfallCard[];

        for (const card of foundCards) {
          const imageUrl = card.image_uris?.normal || card.image_uris?.small || "";
          result.set(card.name.toLowerCase(), {
            id: card.id,
            oracle_id: card.oracle_id,
            image_url: imageUrl
          });
        }
        
        nextPageUrl = resJson.has_more ? resJson.next_page : null;
      }
    } catch (error) {
      console.error(`Error in fetchOldestPrintingsByName (Batch starting at index ${i}):`, error);
    }
  }

  return result;
}
