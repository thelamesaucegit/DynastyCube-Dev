// src/lib/cubecobra-client.ts
/**
 * CubeCobra API Client
 * https://cubecobra.com/cube/api/cubeJSON/{cubeId}
 *
 * Fetches cube data including per-card ELO ratings.
 * The API isn't officially public but is used by community tools.
 *
 * Rate Limits:
 * - Be respectful: minimum 5 seconds between requests
 * - Entire cube is returned in a single response (~670 cards)
 */

const CUBECOBRA_API_BASE = "https://cubecobra.com/cube/api";
const REQUEST_DELAY_MS = 5000; // 5 seconds between requests

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
 * CubeCobra card details object
 */
export interface CubeCobraCardDetails {
  elo: number;
  name: string;
  set: string;
  set_name?: string;
  rarity?: string;
  oracle_text?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  popularity?: number;
  cubeCount?: number;
  pickCount?: number;
  image_small?: string;
  image_normal?: string;
}

/**
 * CubeCobra card object (mainboard entry)
 */
export interface CubeCobraCard {
  name?: string;
  cmc?: number;
  colors?: string[];
  status?: string;
  tags?: string[];
  details: CubeCobraCardDetails;
}

/**
 * CubeCobra cube API response
 */
export interface CubeCobraResponse {
  cards: {
    mainboard: CubeCobraCard[];
    maybeboard?: CubeCobraCard[];
  };
  name: string;
  shortId: string;
  cardCount: number;
  description?: string;
  image?: {
    uri: string;
  };
}

/**
 * Fetch full cube data from CubeCobra
 */
export async function fetchCubeData(cubeId: string): Promise<CubeCobraResponse | null> {
  await waitForRateLimit();

  try {
    const url = `${CUBECOBRA_API_BASE}/cubeJSON/${encodeURIComponent(cubeId)}`;
    console.log(`Fetching CubeCobra data from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Cube not found on CubeCobra: ${cubeId}`);
        return null;
      }
      throw new Error(`CubeCobra API error: ${response.status} ${response.statusText}`);
    }

    const data: CubeCobraResponse = await response.json();
    console.log(`CubeCobra returned cube "${data.name}" with ${data.cards?.mainboard?.length || 0} mainboard cards`);

    return data;
  } catch (error) {
    console.error(`Error fetching cube "${cubeId}" from CubeCobra:`, error);
    return null;
  }
}

/**
 * Extract a map of card name (lowercase) → ELO rating from cube data
 * ELO values are rounded to integers for database storage
 */
export function extractEloMap(cubeData: CubeCobraResponse): Map<string, number> {
  const eloMap = new Map<string, number>();

  if (!cubeData.cards?.mainboard) {
    console.warn("No mainboard cards found in CubeCobra response");
    return eloMap;
  }

  for (const card of cubeData.cards.mainboard) {
    // Prefer details.name for the canonical card name, fall back to top-level name
    const cardName = card.details?.name || card.name;
    const elo = card.details?.elo;

    if (cardName && elo != null) {
      eloMap.set(cardName.toLowerCase(), Math.round(elo));
    }
  }

  console.log(`Extracted ELO ratings for ${eloMap.size} cards`);
  return eloMap;
}

/**
 * Extracted card data from CubeCobra for bulk import
 */
export interface CubeCobraExtractedCard {
  name: string;
  set: string;
  set_name: string;
  rarity: string;
  colors: string[];
  cmc: number;
  elo: number;
  image_normal?: string;
}

/**
 * Extract a map of card name (lowercase) → full card data from CubeCobra.
 * Used by the bulk import to merge CubeCobra data with Scryfall data.
 */
export function extractCardDataMap(
  cubeData: CubeCobraResponse
): Map<string, CubeCobraExtractedCard> {
  const cardMap = new Map<string, CubeCobraExtractedCard>();

  if (!cubeData.cards?.mainboard) {
    console.warn("No mainboard cards found in CubeCobra response");
    return cardMap;
  }

  for (const card of cubeData.cards.mainboard) {
    const details = card.details;
    if (!details?.name) continue;

    cardMap.set(details.name.toLowerCase(), {
      name: details.name,
      set: details.set || "",
      set_name: details.set_name || details.set || "",
      rarity: details.rarity || "unknown",
      colors: details.colors || card.colors || [],
      cmc: details.cmc ?? card.cmc ?? 0,
      elo: details.elo != null ? Math.round(details.elo) : 0,
      image_normal: details.image_normal,
    });
  }

  console.log(`Extracted full card data for ${cardMap.size} cards from CubeCobra`);
  return cardMap;
}

/**
 * Get ELO for a single card by name from the cube
 * Returns null if the card is not found in the cube
 */
export async function getCardElo(
  cardName: string,
  cubeId: string
): Promise<{ elo: number; cubeName: string } | null> {
  const cubeData = await fetchCubeData(cubeId);

  if (!cubeData) {
    return null;
  }

  const eloMap = extractEloMap(cubeData);
  const elo = eloMap.get(cardName.toLowerCase());

  if (elo == null) {
    return null;
  }

  return { elo, cubeName: cubeData.name };
}
