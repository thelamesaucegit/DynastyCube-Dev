// src/app/components/admin/ReplayPlayer.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { GameState, PlayerState as PlayerStateType, Card as CardType } from '@/app/types';
import { ReplayCardData } from '@/app/actions/cardActions';
import { Play, Pause, SkipBack, Rewind, FastForward } from 'lucide-react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useSettings } from '@/contexts/SettingsContext';
import { getCardImageUrl } from '@/app/utils/cardUtils';

// --- TYPE DEFINITIONS ---

interface Team {
  id: string;
  name: string;
  emoji: string;
}

interface ReplayPlayerProps {
  initialGameStates: GameState[];
  matchId: string;
  team1: Team | null;
  team2: Team | null;
  cardDataMap: Map<string, ReplayCardData>;
}

// BattlefieldCard now includes its final destination row
interface BattlefieldCard extends CardType {
  row: 'front' | 'back';
  imageUrl: string | null;
}

// AnimatedCard handles the 3-second "enlarge" effect
interface AnimatedCard {
  name: string;
  imageUrl: string;
  // If 'transient', it disappears after animation. If 'permanent', it's added to the battlefield.
  type: 'transient' | 'permanent';
}

// --- HELPER FUNCTIONS ---

function getCardCategory(cardTypeLine: string): 'front' | 'back' {
  const type = cardTypeLine.toLowerCase();
  if (type.includes('land') || (type.includes('artifact') && !type.includes('creature'))) {
    return 'back';
  }
  return 'front';
}

function generateLogMessage(prevState: GameState | null, nextState: GameState): string | null {
  if (!prevState) return `Match starts. Turn ${nextState.turn}. Active player: ${nextState.activePlayer}.`;
  if (prevState.turn !== nextState.turn) return `Turn ${nextState.turn}: ${nextState.activePlayer} begins their turn.`;
  if (prevState.phase !== nextState.phase) return `${nextState.activePlayer} enters the ${nextState.phase} phase.`;

  for (const playerName in nextState.players) {
    const prevPlayer = prevState.players[playerName];
    const nextPlayer = nextState.players[playerName];
    if (!prevPlayer) continue;

    if (prevPlayer.life !== nextPlayer.life) {
      const diff = nextPlayer.life - prevPlayer.life;
      return `${playerName} ${diff > 0 ? 'gains' : 'loses'} ${Math.abs(diff)} life. (Now at ${nextPlayer.life})`;
    }

    const prevBf = new Set(prevPlayer.battlefield.map(c => c.id));
    const newCard = nextPlayer.battlefield.find(c => !prevBf.has(c.id));
    if (newCard) return `${playerName} plays ${newCard.name}.`;
    
    // FIX: Corrected the bug in this logic block
    const nextBf = new Set(nextPlayer.battlefield.map(c => c.id));
    const removedCard = prevPlayer.battlefield.find(c => !nextBf.has(c.id));
    if (removedCard) return `${removedCard.name} leaves the battlefield.`;

    const newAttacker = nextPlayer.battlefield.find(c => c.isAttacking && !prevPlayer.battlefield.find(pc => pc.id === c.id)?.isAttacking);
    if (newAttacker) return `${playerName} attacks with ${newAttacker.name}.`;
  }
  return null;
}

// --- MAIN COMPONENT ---

export function ReplayPlayer({ initialGameStates, matchId, team1, team2, cardDataMap }: ReplayPlayerProps) {
  const { useOldestArt } = useSettings();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [animatedCard, setAnimatedCard] = useState<AnimatedCard | null>(null);
  const [lifeChange, setLifeChange] = useState<{ player: string; type: 'gain' | 'loss' } | null>(null);

  // FIX: This is the new, persistent state for the cards on the battlefield.
  const [battlefieldState, setBattlefieldState] = useState<Record<string, BattlefieldCard[]>>({});

  const currentState = initialGameStates[currentStepIndex];

  // FIX: Robustly map players to teams, regardless of order.
  const { player1, player2, teamMap } = useMemo(() => {
    if (!initialGameStates[0]?.players || !team1 || !team2) {
      return { player1: null, player2: null, teamMap: new Map() };
    }
    const playerNames = Object.keys(initialGameStates[0].players);
    const p1 = { name: playerNames[0], team: team1 };
    const p2 = { name: playerNames[1], team: team2 };
    const newTeamMap = new Map<string, Team>();
    newTeamMap.set(p1.name, p1.team);
    newTeamMap.set(p2.name, p2.team);

    // Determine who is top and bottom based on active player in turn 1
    // The convention is the first active player is on the bottom (Player 1)
    if (initialGameStates[0].activePlayer === p2.name) {
      return { player1: p2, player2: p1, teamMap: newTeamMap }; // Swap
    }
    return { player1: p1, player2: p2, teamMap: newTeamMap };
  }, [initialGameStates, team1, team2]);

  // Main Game Loop for state transitions
  useEffect(() => {
    const prevState = currentStepIndex > 0 ? initialGameStates[currentStepIndex - 1] : null;
    const state = initialGameStates[currentStepIndex];
    if (!state || !player1 || !player2) return;

    // --- LOGIC FOR UPDATING BATTLEFIELD, ANIMATIONS, AND LOG ---

    // 1. Update Persistent Battlefield State
    const newBattlefieldState: Record<string, BattlefieldCard[]> = { [player1.name]: [], [player2.name]: [] };
    for (const pName of [player1.name, player2.name]) {
      newBattlefieldState[pName] = state.players[pName].battlefield.map(card => {
        const cardInfo = cardDataMap.get(card.name);
        return {
          ...card,
          row: getCardCategory(cardInfo?.card_type || ''),
          imageUrl: cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null
        };
      });
    }
    setBattlefieldState(newBattlefieldState);

    // 2. Handle Animations and Transient Cards
    if (prevState) {
      const prevBfCards = new Set([...prevState.players[player1.name].battlefield.map(c => c.id), ...prevState.players[player2.name].battlefield.map(c => c.id)]);
      const nextBfCards = new Set([...state.players[player1.name].battlefield.map(c => c.id), ...state.players[player2.name].battlefield.map(c => c.id)]);
      
      const cardPlayed = [...state.players[player1.name].battlefield, ...state.players[player2.name].battlefield].find(c => !prevBfCards.has(c.id));
      const cardRemoved = [...prevState.players[player1.name].battlefield, ...prevState.players[player2.name].battlefield].find(c => !nextBfCards.has(c.id));
      
      const cardInAction = cardPlayed || cardRemoved;

      if (cardInAction) {
        const cardInfo = cardDataMap.get(cardInAction.name);
        const imageUrl = cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null;
        if (imageUrl) {
          const cardType = cardInfo?.card_type.toLowerCase() || '';
          const isPermanent = !cardType.includes('instant') && !cardType.includes('sorcery');
          
          setAnimatedCard({
            name: cardInAction.name,
            imageUrl: imageUrl,
            type: cardRemoved || !isPermanent ? 'transient' : 'permanent'
          });

          setTimeout(() => setAnimatedCard(null), 2900); // Slightly less than the auto-play timer
        }
      }

      // Handle life changes
      if (state.players[player1.name].life !== prevState.players[player1.name].life) {
        const type = state.players[player1.name].life > prevState.players[player1.name].life ? 'gain' : 'loss';
        setLifeChange({ player: player1.name, type });
        setTimeout(() => setLifeChange(null), 1000);
      }
      if (state.players[player2.name].life !== prevState.players[player2.name].life) {
        const type = state.players[player2.name].life > prevState.players[player2.name].life ? 'gain' : 'loss';
        setLifeChange({ player: player2.name, type });
        setTimeout(() => setLifeChange(null), 1000);
      }
    }

    // 3. Update Event Log
    const logMessage = generateLogMessage(prevState, state);
    if (logMessage) setEventLog(prev => [logMessage, ...prev].slice(0, 20));

  }, [currentStepIndex, initialGameStates, cardDataMap, useOldestArt, player1, player2]);

  // Auto-playback timer
  useEffect(() => {
    if (!isPlaying || currentStepIndex >= initialGameStates.length - 1) {
      setIsPlaying(false);
      return;
    }
    const prevState = initialGameStates[currentStepIndex];
    const nextState = initialGameStates[currentStepIndex + 1];
    const isBattlefieldEvent = JSON.stringify(prevState.players) !== JSON.stringify(nextState.players);
    const timeout = isBattlefieldEvent ? 3000 : 500;
    const timer = setTimeout(() => setCurrentStepIndex(prev => prev + 1), timeout);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, initialGameStates]);

  const renderBattlefieldForPlayer = (playerName: string) => {
    if (!playerName) return <div className="h-1/2 w-full" />;

    const playerState = currentState.players[playerName];
    const team = teamMap.get(playerName);
    const cards = battlefieldState[playerName] || [];
    
    const backRow = cards.filter(c => c.row === 'back');
    const frontRow = cards.filter(c => c.row === 'front');
    
    const renderRow = (rowCards: BattlefieldCard[]) => (
      <div className="flex-grow flex justify-center items-center gap-[-30px] px-24">
          {rowCards.map((card, index) => (
              <div key={card.id} className="relative transition-transform duration-300 hover:scale-150 hover:z-20" style={{ transform: `translateX(${index * -15}px)`}}>
                  {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="h-28 object-contain drop-shadow-lg rounded-lg" />}
                  {card.isTapped && <div className="absolute inset-0 bg-black/30 rounded-lg -rotate-12"></div>}
              </div>
          ))}
      </div>
    );
    
    return (
      <div className="relative w-full h-1/2 bg-gray-700/50 p-4 flex flex-col-reverse">
          <div className="flex flex-col gap-2 h-full">
              {renderRow(backRow)}
              {renderRow(frontRow)}
          </div>
          <div className={`absolute top-4 left-4 flex items-center gap-4 z-10`}>
              <div className="relative">
                  <div className="text-5xl">{team?.emoji}</div>
                  {currentState.activePlayer === playerName && <div className="absolute -inset-2 rounded-full ring-4 ring-blue-400 ring-offset-4 ring-offset-gray-800 animate-pulse"></div>}
              </div>
              <div className={`text-6xl font-bold transition-colors duration-300 ${lifeChange?.player === playerName && lifeChange.type === 'loss' ? 'text-red-500' : ''} ${lifeChange?.player === playerName && lifeChange.type === 'gain' ? 'text-green-500' : ''}`}>
                  {playerState.life}
              </div>
          </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 text-white rounded-lg overflow-hidden select-none">
        <div className="relative h-[80vh] flex flex-col">
            {renderBattlefieldForPlayer(player2?.name || '')}
            {renderBattlefieldForPlayer(player1?.name || '')}

            {animatedCard && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
                    <div className="text-center animate-in fade-in zoom-in-75 duration-500">
                        <p className="text-2xl font-bold mb-2 drop-shadow-lg">{animatedCard.name}</p>
                        <img src={animatedCard.imageUrl} alt={animatedCard.name} className="h-96 object-contain rounded-lg shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 border-t border-gray-700 bg-gray-900">
            <ScrollArea className="h-24 col-span-1 rounded-md bg-black/20 p-2">
                <div className="flex flex-col-reverse">
                    {eventLog.map((msg, i) => <p key={i} className="text-xs text-gray-400 font-mono animate-in fade-in">{`> ${msg}`}</p>)}
                </div>
            </ScrollArea>
            <div className="col-span-1 flex items-center justify-center gap-2">
                <Button onClick={() => setCurrentStepIndex(0)} variant="ghost" size="icon" disabled={isPlaying}><SkipBack /></Button>
                <Button onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))} variant="ghost" size="icon" disabled={isPlaying}><Rewind /></Button>
                <Button onClick={() => setIsPlaying(!isPlaying)} size="lg" className="w-20">{isPlaying ? <Pause /> : <Play />}</Button>
                <Button onClick={() => setCurrentStepIndex(Math.min(initialGameStates.length - 1, currentStepIndex + 1))} variant="ghost" size="icon" disabled={isPlaying}><FastForward /></Button>
            </div>
            <div className="col-span-1 flex flex-col items-end justify-center text-right">
                <p className="font-bold">Step {currentStepIndex + 1} / {initialGameStates.length}</p>
                <p className="text-sm text-gray-400">{currentState?.phase}</p>
                 {currentState?.winner && <p className="text-lg font-bold text-yellow-400">Winner: {teamMap.get(currentState.winner)?.name || currentState.winner}</p>}
            </div>
        </div>
    </div>
  );
}
