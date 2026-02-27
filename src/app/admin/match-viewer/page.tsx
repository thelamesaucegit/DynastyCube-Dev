// src/app/admin/match-viewer/page.tsx
"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { generateDeckStringForViewer } from '@/app/actions/forgeActions'; // We will create this
import MatchViewer from '@/app/components/MatchViewer'; // We will create this too

// A helper function to format a raw decklist string into a .dck string
function formatDecklistToDck(decklist: string, deckName: string): string {
  let dckContent = `[metadata]\nName=${deckName}\n[Main]\n`;
  dckContent += decklist;
  return dckContent;
}

function MatchViewerContent() {
  const searchParams = useSearchParams();

  // Read the match details from the URL query
  const p1_deck = searchParams.get('p1_deck') || '';
  const p1_name = searchParams.get('p1_name') || 'Player 1';
  const p1_ai = searchParams.get('p1_ai') || 'General';
  
  const p2_deck = searchParams.get('p2_deck') || '';
  const p2_name = searchParams.get('p2_name') || 'Player 2';
  const p2_ai = searchParams.get('p2_ai') || 'General';

  // Format the raw decklists into the .dck format
  const deck1Dck = formatDecklistToDck(p1_deck, p1_name);
  const deck2Dck = formatDecklistToDck(p2_deck, p2_name);
  
  // Create safe filenames
  const deck1Filename = p1_name.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";
  const deck2Filename = p2_name.replace(/[^a-z0-9-]/gi, '_').toLowerCase() + ".dck";

  return (
    <div className="container mx-auto p-8">
      <MatchViewer
        // The MatchViewer now gets its data directly from the URL params
        deck1={{ filename: deck1Filename, content: deck1Dck, aiProfile: p1_ai }}
        deck2={{ filename: deck2Filename, content: deck2Dck, aiProfile: p2_ai }}
      />
    </div>
  );
}

export default function MatchViewerPage() {
  // Suspense is required by Next.js when using useSearchParams
  return (
    <Suspense fallback={<div>Loading Match...</div>}>
      <MatchViewerContent />
    </Suspense>
  );
}

