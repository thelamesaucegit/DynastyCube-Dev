// src/app/utils/cardUtils.ts

// A generic card object shape that includes both image URLs.
// This will work with CardData, ReplayCardData, QueueEntry, etc.
interface CardWithImages {
  image_url?: string | null;
  oldest_image_url?: string | null;
}

/**
 * Selects the appropriate card image URL based on the user's preference.
 * @param card - A card object that has image_url and oldest_image_url properties.
 * @param useOldestArt - A boolean indicating the user's preference from the SettingsContext.
 * @returns The correct image URL string, or null if neither exists.
 */
export function getCardImageUrl(card: CardWithImages, useOldestArt: boolean): string | null {
  // If the user wants the oldest art AND it exists, use it.
  if (useOldestArt && card.oldest_image_url) {
    return card.oldest_image_url;
  }
  // Otherwise, fall back to the default image_url.
  return card.image_url || null;
}
