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
  colors?: string[];
  color_identity?: string[];
  mana_cost?: string;
  cmc: number;
  edhrec_rank?: number; // Lower is more popular
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
  await waitForRateLimit();
  try {
    const url = `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(cardName)}`;
    const response = await fetch(url);
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
  await waitForRateLimit();
  try {
    const batch = cardNames.slice(0, 75);
    const identifiers = batch.map(name => ({ name }));
    const url = `${SCRYFALL_API_BASE}/cards/collection`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifiers }),
    });

    if (!response.ok) {
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
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

  for (let i = 0; i < cardNames.length; i += 75) {
    const batch = cardNames.slice(i, i + 75);
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
    const response = await fetch(url);
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
