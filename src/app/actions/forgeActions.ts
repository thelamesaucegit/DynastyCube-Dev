// src/app/actions/forgeActions.ts
"use server";

import { getDeckCards } from "@/app/actions/draftActions"; // Assumes this action exists and works

/**
 * Fetches a deck's card list from the database and compiles it into the
 * plain-text .dck format required by the Forge engine.
 * @param deckId The UUID of the deck to compile.
 * @param deckName The name of the deck.
 * @returns An object containing the deck string, a safe filename, and success status.
 */
export async function generateDeckString(deckId: string, deckName: string): Promise<{
    success: boolean;
    dckContent?: string;
    safeFilename?: string;
    error?: string;
}> {
  try {
    // 1. Fetch the latest cards in the deck from your database
    const { cards, error } = await getDeckCards(deckId);
    if (error || !cards) {
      throw new Error(`Could not fetch cards for deck ID: ${deckId}. Error: ${error}`);
    }

    // 2. Format into the Forge .dck structure
    let dckContent = `[metadata]\nName=${deckName}\n`;
    
    const mainboard = cards.filter(c => c.category === "mainboard");
    const sideboard = cards.filter(c => c.category === "sideboard");

    if (mainboard.length > 0) {
      dckContent += `[Main]\n`;
      mainboard.forEach(card => {
        dckContent += `${card.quantity || 1} ${card.card_name}\n`;
      });
    }

    if (sideboard.length > 0) {
      dckContent += `\n[Sideboard]\n`;
      sideboard.forEach(card => {
        dckContent += `${card.quantity || 1} ${card.card_name}\n`;
      });
    }

    // 3. Clean the filename to be safe for filesystem commands
    const safeFilename = deckName.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";

    // 4. Return the string payload instead of saving to disk
    return { success: true, dckContent, safeFilename };
  } catch (error) {
    console.error("Failed to generate deck string:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
