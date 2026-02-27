// src/app/admin/match-viewer/page.tsx
"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
// The 'generateDeckStringForViewer' import has been removed as it is not needed.
import MatchViewer from '@/app/components/MatchViewer';

// This simple helper function can live directly in this file.
// It takes the raw decklist text and wraps it in the .dck metadata format.
function formatDecklistToDck(decklist: string, deckName: string): string {
  // Ensure there's a newline after the metadata block
  let dckContent = `[metadata]\nName=${deckName}\n\n[Main]\n`;
  dckContent += decklist;
  return dckContent;
}

function MatchViewerContent() {
  const searchParams = useSearchParams();

  // Read the raw match details directly from the URL query
  const p1_deck = searchParams.get('p1_deck') || '';
  const p1_name = searchParams.get('p1_name') || 'Player 1';
  const p1_ai = searchParams.get('p1_ai') || 'Default'; // Default to a known safe value
  
  const p2_deck = searchParams.get('p2_deck') || '';
  const p2_name = searchParams.get('p2_name') || 'Player 2';
  const p2_ai = searchParams.get('p2_ai') || 'Default'; // Default to a known safe value

  // Perform all necessary formatting on the client side
  const deck1Dck = formatDecklistToDck(p1_deck, p1_name);
  const deck2Dck = formatDecklistToDck(p2_deck, p2_name);
  
  const deck1Filename = p1_name.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
  const deck2Filename = p2_name.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";

  // The MatchViewer component receives its props, now fully prepared.
  return (
    <div className="container mx-auto p-4 md:p-8">
      <MatchViewer
        deck1={{ filename: deck1Filename, content: deck1Dck, aiProfile: p1_ai }}
        deck2={{ filename: deck2Filename, content: deck2Dck, aiProfile: p2_ai }}
      />
    </div>
  );
}

export default function MatchViewerPage() {
  // Suspense is required by Next.js when using useSearchParams
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading Match Details...</div>}>
      <MatchViewerContent />
    </Suspense>
  );
}
