// src/app/components/MatchViewer.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';

// Define the shape of our game data
interface GameCard {
  id: string;
  name: string;
}

interface PlayerState {
  name: string;
  life: number;
  battlefield: GameCard[];
}

interface GameState {
  turn: number;
  activePlayer: string;
  players: Record<string, PlayerState>;
}

// Define the shape of the deck data we expect
interface DeckPayload {
  filename: string;
  content: string;
  aiProfile: string;
}

// Props for the component
interface MatchViewerProps {
  deck1: DeckPayload;
  deck2: DeckPayload;
}

export default function MatchViewer({ deck1, deck2 }: MatchViewerProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState("Awaiting 'Start Match' Signal...");
  const wsRef = useRef<WebSocket | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // This effect runs once to establish the WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("Connected to Match Server. Ready to start match.");
    ws.onclose = () => setStatus("Disconnected from Match Server.");
    ws.onerror = () => setStatus("Connection Error. Is the Forge sidecar running?");

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'SIMULATION_STARTING':
            setStatus("Match signal received. Waiting for Forge to start...");
            break;
          case 'STATE_UPDATE':
            setStatus(`Turn ${message.state.turn} - ${message.state.activePlayer}`);
            setGameState(message.state);
            break;
          case 'SIMULATION_COMPLETE':
            setStatus("Match Finished! Final State:");
            setGameState(message.finalState);
            break;
          case 'ERROR':
            setStatus(`Error: ${message.message}`);
            break;
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);
  
  // This effect automatically clicks the start button once connected.
  useEffect(() => {
    if (status === "Connected to Match Server. Ready to start match." && startButtonRef.current) {
        startButtonRef.current.click();
    }
  }, [status]);


  const handleStartMatch = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatus("Not connected. Cannot start match.");
      return;
    }

    setStatus("Sending match details to Forge sidecar...");

    const matchPayload = {
      type: "START_MATCH",
      payload: {
        deck1: deck1,
        deck2: deck2,
      }
    };

    wsRef.current.send(JSON.stringify(matchPayload));
  };

  return (
    <div className="p-6 bg-gray-900 text-white font-sans rounded-lg shadow-xl">
      <header className="mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-blue-400">Forge AI Live Match Viewer</h1>
        <p className="text-sm text-gray-400">Status: <strong className="font-mono">{status}</strong></p>
        <button
          ref={startButtonRef}
          onClick={handleStartMatch}
          className="hidden" // This button is now invisible and triggered automatically
        >
          Start Match
        </button>
      </header>

      {gameState ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Turn: {gameState.turn} | Active Player: {gameState.activePlayer}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.values(gameState.players).map((player) => (
              <div key={player.name} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-lg truncate text-green-400">{player.name}</h3>
                <h4 className="text-2xl font-bold my-2">Life: {player.life}</h4>
                <h5 className="font-semibold text-gray-300 mt-4 border-t border-gray-700 pt-2">Battlefield ({player.battlefield.length})</h5>
                <ul className="space-y-2 mt-2 h-96 overflow-y-auto p-1">
                  {player.battlefield.map((card) => (
                    <li key={card.id} className="p-2 bg-gray-700 rounded text-sm">
                      {card.name} <span className="text-xs text-gray-500">(ID: {card.id})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p>Connecting to match server and waiting for simulation to start...</p>
        </div>
      )}
    </div>
  );
}
