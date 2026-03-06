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

interface BattlefieldCard extends CardType {
  row: 'front' | 'back';
  imageUrl: string | null;
}

interface AnimatedCard {
  name: string;
  imageUrl: string;
  type: 'transient' | 'permanent';
}

interface PlayerInfo {
    logName: string;
    team: Team;
}

// --- HELPER FUNCTIONS ---

function getCardCategory(cardTypeLine: string): 'front' | 'back' {
  const type = cardTypeLine.toLowerCase();
  if (type.includes('land') || (type.includes('artifact') && !type.includes('creature'))) {
    return 'back';
  }
  return 'front';
}

function generateLogMessage(prevState: GameState | null, nextState: GameState, teamMap: Map<string, Team>): string | null {
    const formatPlayerName = (logName: string) => teamMap.get(logName)?.name || logName;
    if (!prevState) return `Match starts. Turn ${nextState.turn}. Active player: ${formatPlayerName(nextState.activePlayer)}.`;
    if (prevState.turn !== nextState.turn) return `Turn ${nextState.turn}: ${formatPlayerName(nextState.activePlayer)} begins their turn.`;
    if (prevState.phase !== nextState.phase) return `${formatPlayerName(nextState.activePlayer)} enters the ${nextState.phase} phase.`;
    for (const logName in nextState.players) {
        const prevPlayer = prevState.players[logName];
        const nextPlayer = nextState.players[logName];
        if (!prevPlayer) continue;
        if (prevPlayer.life !== nextPlayer.life) {
            const diff = nextPlayer.life - prevPlayer.life;
            return `${formatPlayerName(logName)} ${diff > 0 ? 'gains' : 'loses'} ${Math.abs(diff)} life. (Now at ${nextPlayer.life})`;
        }
        const prevBf = new Set(prevPlayer.battlefield.map(c => c.id));
        const newCard = nextPlayer.battlefield.find(c => !prevBf.has(c.id));
        if (newCard) return `${formatPlayerName(logName)} plays ${newCard.name}.`;
        
        const nextBf = new Set(nextPlayer.battlefield.map(c => c.id));
        const removedCard = prevPlayer.battlefield.find(c => !nextBf.has(c.id));
        if (removedCard) return `${removedCard.name} leaves the battlefield.`;

        const newAttacker = nextPlayer.battlefield.find(c => c.isAttacking && !prevPlayer.battlefield.find(pc => pc.id === c.id)?.isAttacking);
        if (newAttacker) return `${formatPlayerName(logName)} attacks with ${newAttacker.name}.`;
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
  const [lifeChange, setLifeChange] = useState<{ logName: string; type: 'gain' | 'loss' } | null>(null);
  const [battlefieldState, setBattlefieldState] = useState<Record<string, BattlefieldCard[]>>({});
  const currentState = initialGameStates[currentStepIndex];

  // This is the mapping logic for players and teams.
  const { player1, player2, teamMap } = useMemo(() => {
    const newTeamMap = new Map<string, Team>();
    let p1Info: PlayerInfo | null = null;
    let p2Info: PlayerInfo | null = null;

    // The keys from the game log, e.g., "Ai(1)-Alara Shards"
    const logPlayerNames = Object.keys(initialGameStates[0].players);

    if (team1 && team2) {
      // ---
      // FIX: Convert both strings to lower case to ensure a case-insensitive match.
      // ---
      const logName1 = logPlayerNames.find(name => name.toLowerCase().includes(team1.name.toLowerCase()));
      const logName2 = logPlayerNames.find(name => name.toLowerCase().includes(team2.name.toLowerCase()));

      if (logName1) {
        p1Info = { logName: logName1, team: team1 };
        newTeamMap.set(logName1, team1);
      }
      if (logName2) {
        p2Info = { logName: logName2, team: team2 };
        newTeamMap.set(logName2, team2);
      }
    }
    
    // This check will now pass, but it remains as a safeguard.
    if (!p1Info || !p2Info) {
      return { player1: null, player2: null, teamMap: newTeamMap };
    }

    // The player on the bottom is conventionally the first active player of the game.
    if (initialGameStates[0].activePlayer.toLowerCase().includes(p2Info.team.name.toLowerCase())) {
      return { player1: p2Info, player2: p1Info, teamMap: newTeamMap }; // Swap them
    }

    return { player1: p1Info, player2: p2Info, teamMap: newTeamMap };

  }, [initialGameStates, team1, team2]);

  // Main Game Loop
  useEffect(() => {
    const prevState = currentStepIndex > 0 ? initialGameStates[currentStepIndex - 1] : null;
    const state = initialGameStates[currentStepIndex];

    if (!state || !player1 || !player2) return;

    // 1. Update Battlefield State
    const newBattlefieldState: Record<string, BattlefieldCard[]> = { [player1.logName]: [], [player2.logName]: [] };
    for (const pName of [player1.logName, player2.logName]) {
      const playerState = state.players[pName];
      if (playerState) {
          newBattlefieldState[pName] = playerState.battlefield.map(card => {
              const cardInfo = cardDataMap.get(card.name);
              return {
                  ...card,
                  row: getCardCategory(cardInfo?.card_type || ''),
                  imageUrl: cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null
              };
          });
      }
    }
    setBattlefieldState(newBattlefieldState);

    // 2. Handle Animations
    if (prevState) {
      const allPrevBfIds = new Set([...(prevState.players[player1.logName]?.battlefield.map(c => c.id) || []), ...(prevState.players[player2.logName]?.battlefield.map(c => c.id) || [])]);
      const allNextCards = [...(state.players[player1.logName]?.battlefield || []), ...(state.players[player2.logName]?.battlefield || [])];
      
      const cardPlayed = allNextCards.find(c => !allPrevBfIds.has(c.id));

      if (cardPlayed) {
        const cardInfo = cardDataMap.get(cardPlayed.name);
        if (cardInfo) {
            const imageUrl = getCardImageUrl(cardInfo, useOldestArt);
            if (imageUrl) {
                const cardType = cardInfo.card_type.toLowerCase();
                const isPermanent = !cardType.includes('instant') && !cardType.includes('sorcery');
                setAnimatedCard({ name: cardPlayed.name, imageUrl, type: isPermanent ? 'permanent' : 'transient' });
                setTimeout(() => setAnimatedCard(null), 2900);
            }
        }
      }

      // Handle life changes
      if (state.players[player1.logName] && prevState.players[player1.logName] && state.players[player1.logName].life !== prevState.players[player1.logName].life) {
        setLifeChange({ logName: player1.logName, type: state.players[player1.logName].life > prevState.players[player1.logName].life ? 'gain' : 'loss' });
        setTimeout(() => setLifeChange(null), 1000);
      }
      if (state.players[player2.logName] && prevState.players[player2.logName] && state.players[player2.logName].life !== prevState.players[player2.logName].life) {
        setLifeChange({ logName: player2.logName, type: state.players[player2.logName].life > prevState.players[player2.logName].life ? 'gain' : 'loss' });
        setTimeout(() => setLifeChange(null), 1000);
      }
    }

    // 3. Update Event Log
    const logMessage = generateLogMessage(prevState, state, teamMap);
    if (logMessage) setEventLog(prev => [logMessage, ...prev].slice(0, 20));

  }, [currentStepIndex, initialGameStates, cardDataMap, useOldestArt, player1, player2, teamMap]);

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

  // This is the component that renders one player's half of the screen
  const renderPlayerArea = (playerInfo: PlayerInfo | null, area: 'top' | 'bottom') => {
    // This check is now the primary indicator of a problem.
    if (!playerInfo) return <div className="h-1/2 w-full bg-gray-800 flex items-center justify-center"><p className="text-gray-500">Waiting for team data...</p></div>;
    
    const playerState = currentState.players[playerInfo.logName];
    if (!playerState) return <div className="h-1/2 w-full bg-gray-800" />;

    const cards = battlefieldState[playerInfo.logName] || [];
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
    
    const flexDirection = area === 'top' ? 'flex-col' : 'flex-col-reverse';

    return (
      <div className={`relative w-full h-1/2 bg-gray-700/50 p-4 flex ${flexDirection}`}>
          <div className={`flex h-full ${flexDirection} gap-2`}>
              {renderRow(frontRow)}
              {renderRow(backRow)}
          </div>
          <div className={`absolute top-4 left-4 flex items-center gap-4 z-10`}>
              <div className="relative">
                  <div className="text-5xl">{playerInfo.team.emoji}</div>
                  {currentState.activePlayer.toLowerCase().includes(playerInfo.team.name.toLowerCase()) && <div className="absolute -inset-2 rounded-full ring-4 ring-blue-400 ring-offset-4 ring-offset-gray-800 animate-pulse"></div>}
              </div>
              <div className={`text-6xl font-bold transition-colors duration-300 ${lifeChange?.logName === playerInfo.logName && lifeChange.type === 'loss' ? 'text-red-500' : ''} ${lifeChange?.logName === playerInfo.logName && lifeChange.type === 'gain' ? 'text-green-500' : ''}`}>
                  {playerState.life}
              </div>
          </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg overflow-hidden select-none">
        <div className="relative h-[80vh] flex flex-col">
            {renderPlayerArea(player2, 'top')}
            {renderPlayerArea(player1, 'bottom')}
            {animatedCard && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
                    <div className="text-center animate-in fade-in zoom-in-75 duration-500">
                        <p className="text-2xl font-bold mb-2 drop-shadow-lg">{animatedCard.name}</p>
                        <img src={animatedCard.imageUrl} alt={animatedCard.name} className="h-96 object-contain rounded-lg shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 border-t border-gray-700 bg-gray-800">
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
