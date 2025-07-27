// src/app/page.tsx

//import Image from 'next/image';
import Layout from '@/components/Layout';
// src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

type Card = {
  card_name: string;
  card_type: string;
  scryfall_image: string;
  cubuck_value: number;
  mana_value: string;
  oracle_text: string;
  power_toughness: string;
};

export default function Page() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cards')
      .then((res) => res.json())
      .then((data) => {
        setCards(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch cards:', err);
        setLoading(false);
      });
  }, []);

  return (
    <main className="p-8 text-gray-300 bg-black min-h-screen">
      <h1 className="text-center text-3xl font-bold mb-6">Shards Pool</h1>

      {loading ? (
        <p className="text-center">Loading...</p>
      ) : (
        <div className="space-y-6">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="flex items-center border border-gray-700 rounded-xl p-4 bg-gray-900 shadow-md"
            >
              {/* Card Image */}
              <img
                src={card.scryfall_image}
                alt={card.card_name}
                className="h-30 w-auto rounded-md mr-6"
                style={{ height: '120px' }}
              />

              {/* Card Info */}
              <div className="text-left space-y-1">
                <h2 className="text-xl font-semibold">{card.card_name}</h2>
                <p className="text-sm italic text-gray-400">{card.card_type}</p>
                <p className="text-sm">
                  <span className="font-medium">Mana Value:</span> {card.mana_value}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Oracle Text:</span> {card.oracle_text}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Power/Toughness:</span> {card.power_toughness}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Cubuck Value:</span>{' '}
                  <span className="text-green-400">Ç{card.cubuck_value.toFixed(2)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
