"use client";

import React, { useState, useEffect, useRef } from 'react';
import { generateDeckString } from '@/app/actions/forgeActions'; // We will create this file next

// Define the shape of our game data, mirroring what the sidecar sends
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

// Props for the component
interface MatchViewerProps {
  // Pass the details of the two decks that will be fighting
  deck1Id: string;
  deck1Name: string;
  deck2Id: string;
  deck2Name: string;
}

export default function MatchViewer({ deck1Id, deck1Name, deck2Id, deck2Name }: MatchViewerProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState("Connecting to Match Server...");
  const wsRef = useRef<WebSocket | null>(null);

  // Establish the WebSocket Connection on component mount
  useEffect(() => {
    // Use the public environment variable for the WebSocket URL
    // Fall back to localhost for local development
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("Connected. Ready to start match.");

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'CONNECTION_ESTABLISHED':
            setGameState(message.state);
            break;
          case 'SIMULATION_STARTING':
            setStatus("Match is starting...");
            break;
          case 'STATE_UPDATE':
            setGameState(message.state);
            break;
          case 'SIMULATION_COMPLETE':
            setStatus("Match Finished!");
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

    ws.onclose = () => setStatus("Disconnected from Match Server.");
    ws.onerror = () => setStatus("Connection Error. Is the sidecar running?");

    // Cleanup on component unmount
    return () => {
      ws.close();
    };
  }, []);

  // Function to start the game
  const handleStartMatch = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatus("Not connected. Cannot start match.");
      return;
    }

    setStatus("Compiling decks from database...");

    // Fetch the decklists as strings from your Supabase backend
    const deck1Data = await generateDeckString(deck1Id, deck1Name);
    const deck2Data = await generateDeckString(deck2Id, deck2Name);

    if (!deck1Data.success || !deck2Data.success) {
      setStatus(`Error compiling decks: ${deck1Data.error || deck2Data.error}`);
      return;
    }

    // Assemble the payload for the WebSocket server
    const matchPayload = {
      type: "START_MATCH",
      payload: {
        deck1: {
          filename: deck1Data.safeFilename,
          content: deck1Data.dckContent,
          aiProfile: "Aggro", // You can make this dynamic later
        },
        deck2: {
          filename: deck2Data.safeFilename,
          content: deck2Data.dckContent,
          aiProfile: "Control", // You can make this dynamic later
        }
      }
    };

    // Send the payload to the Forge sidecar
    wsRef.current.send(JSON.stringify(matchPayload));
    setStatus("Match signal sent. Waiting for Forge to start...");
  };

  // Render the UI
  return (
    <div className="p-6 bg-gray-900 text-white font-sans rounded-lg shadow-xl">
      <header className="mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-blue-400">Forge AI Live Match</h1>
        <p className="text-sm text-gray-400">Status: <strong className="font-mono">{status}</strong></p>
        <button
          onClick={handleStartMatch}
          disabled={status !== "Connected. Ready to start match."}
          className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
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
                <ul className="space-y-2 mt-2 h-64 overflow-y-auto">
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
          <p>Waiting for game state...</p>
        </div>
      )}
    </div>
  );
}
