///src/app/components/WireGrid.tsx


"use client";

import React from 'react';
import { WireCardComponent } from './WireCardComponent';
import { type WireCard } from '@/app/actions/wireActions';

interface WireGridProps {
    cards: WireCard[];
    onBidSuccess: () => void;
}

export function WireGrid({ cards, onBidSuccess }: WireGridProps) {
    if (cards.length === 0) {
        return (
            <div className="text-center py-16 border rounded-lg bg-card">
                <p className="text-xl font-semibold">No cards found.</p>
                <p className="text-muted-foreground mt-2">Try adjusting your search filters.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cards.map((card) => (
                <WireCardComponent key={card.id} card={card} onBidSuccess={onBidSuccess} />
            ))}
        </div>
    );
}
