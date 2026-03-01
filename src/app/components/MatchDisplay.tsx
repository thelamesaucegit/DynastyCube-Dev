// src/app/components/MatchDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import { GameState, PlayerState, Card as GameCard } from '@/app/types'; // Import from our new types file

function PlayerDisplay({ player, isActive }: { player: PlayerState, isActive: boolean }) {
  return (
    <div className={`p-4 border rounded-lg ${isActive ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
      <h3 className="font-bold text-lg">{player.name}</h3>
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Life: {player.life}</span>
        <span>Hand: {player.handSize}</span>
      </div>
      <Separator />
      <div className="mt-2 min-h-[200px]">
        <h4 className="font-semibold mb-2">Battlefield</h4>
        {player.battlefield.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {player.battlefield.map(card => (
              <div 
                key={card.id} 
                className={`
                  p-2 border rounded text-xs text-center
                  ${card.isAttacking ? 'border-red-500 border-2' : ''}
                  ${card.isBlocked ? 'border-yellow-500 border-2' : ''}
                  ${card.isTapped ? 'text-gray-500 italic' : ''}
                `}
              >
                {card.name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">Empty</p>
        )}
      </div>
    </div>
  );
}

export default function MatchDisplay({ gameState }: { gameState: GameState | null }) {
  if (!gameState || Object.keys(gameState.players).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiting for Match Data...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const playerNames = Object.keys(gameState.players);
  const player1 = gameState.players[playerNames[0]];
  const player2 = gameState.players[playerNames[1]];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Replay</CardTitle>
        <CardDescription className="flex justify-between">
          <span>Turn: {gameState.turn}</span>
          <span>Active Player: {gameState.activePlayer}</span>
        </CardDescription>
        {gameState.winner && (
            <div className="p-2 mt-2 text-center font-bold text-lg bg-yellow-200 rounded-md">
                Winner: {gameState.winner}
            </div>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {player1 && <PlayerDisplay player={player1} isActive={player1.name === gameState.activePlayer} />}
        {player2 && <PlayerDisplay player={player2} isActive={player2.name === gameState.activePlayer} />}
      </CardContent>
    </Card>
  );
}
