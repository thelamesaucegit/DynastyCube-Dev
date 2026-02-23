// src/components/LiveDraftBoard.tsx

'use client';

import { useEffect, useState } from 'react';
import type { DraftPick } from '@/app/draft/[draftId]/live/page';

interface LiveDraftBoardProps {
  serverPicks: DraftPick[];
  draftId: string;
}

export default function LiveDraftBoard({ serverPicks, draftId }: LiveDraftBoardProps) {
  const [picks, setPicks] = useState<DraftPick[]>(serverPicks);

  useEffect(() => {
    // The EventSource API is built into modern browsers.
    // It's the client-side counterpart to our SSE API route.
    const eventSource = new EventSource(`/api/draft-stream/${draftId}`);

    // This handler is called for every "data: ..." message from the stream.
    eventSource.onmessage = (event) => {
      try {
        const newPick = JSON.parse(event.data) as DraftPick;
        console.log('New pick received via SSE!', newPick);

        // Add the new pick to our state, avoiding duplicates
        setPicks(currentPicks => {
          if (currentPicks.some(p => p.id === newPick.id)) {
            return currentPicks;
          }
          return [...currentPicks, newPick];
        });
      } catch (error) {
        console.error('Failed to parse incoming event data:', event.data, error);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource encountered an error:', err);
      // The browser will automatically try to reconnect. If you want to stop it,
      // you can close the connection here.
      // eventSource.close();
    };

    // The cleanup function is crucial. It runs when the component is unmounted
    // to close the connection and prevent memory leaks.
    return () => {
      console.log('Closing EventSource connection.');
      eventSource.close();
    };
  }, [draftId]); // The dependency array ensures this effect runs only when draftId changes.

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {/* Sort picks by pick number before rendering */}
      {picks.sort((a, b) => a.pick_number - b.pick_number).map((pick) => (
        <div key={pick.id} className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 transform hover:scale-105 transition-transform duration-200">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="font-bold text-white bg-blue-600 px-2 py-1 rounded">#{pick.pick_number}</span>
            <span className="font-semibold text-gray-300 truncate">{pick.team_name}</span>
          </div>
          <img 
            src={pick.image_url || '/placeholder-card.png'} 
            alt={pick.card_name} 
            className="w-full rounded-md shadow-md"
            loading="lazy"
          />
          <h3 className="font-semibold text-center text-sm text-gray-100 mt-2 truncate">{pick.card_name}</h3>
        </div>
      ))}
    </div>
  );
}
