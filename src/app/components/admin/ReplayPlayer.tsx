"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { GameState, PlayerState as PlayerStateType, Card as CardType } from '@/app/types';
import { ReplayCardData } from '@/app/actions/cardActions';
import { Play, Pause, SkipBack, Rewind, FastForward, SkipForward } from 'lucide-react';
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
    if (!prevState) return `Match starts. Turn ${nextState.turn}.`;
    
    if (prevState.turn !== nextState.turn) return `Turn ${Math.ceil(nextState.turn / 2)}: ${formatPlayerName(nextState.activePlayer)} begins their turn.`;

    if (nextState.stack.length > prevState.stack.length) {
        const newSpell = nextState.stack[nextState.stack.length - 1];
        return `${formatPlayerName(nextState.activePlayer)} casts ${newSpell.name}.`;
    }

    for (const logName in nextState.players) {
        const prevPlayer = prevState.players[logName];
        const nextPlayer = nextState.players[logName];
        if (!prevPlayer) continue;

        if (prevPlayer.life !== nextPlayer.life) {
            const diff = nextPlayer.life - prevPlayer.life;
            return `${formatPlayerName(logName)} ${diff > 0 ? 'gains' : 'loses'} ${Math.abs(diff)} life. (Now at ${nextPlayer.life})`;
        }

        const prevBfIds = new Set(prevPlayer.battlefield.map(c => c.id));
        const newCardOnBf = nextPlayer.battlefield.find(c => !prevBfIds.has(c.id));
        if (newCardOnBf) return `${formatPlayerName(logName)} plays ${newCardOnBf.name}.`;
        
        const nextBfIds = new Set(nextPlayer.battlefield.map(c => c.id));
        const removedCardFromBf = prevPlayer.battlefield.find(c => !nextBfIds.has(c.id));
        if (removedCardFromBf) return `${removedCardFromBf.name} leaves the battlefield.`;
        
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

  const currentState = initialGameStates[currentStepIndex];

  const { player1, player2, teamMap } = useMemo(() => {
    const newTeamMap = new Map<string, Team>();
    let p1Info: PlayerInfo | null = null;
    let p2Info: PlayerInfo | null = null;
    
    const logPlayerNames = Object.keys(initialGameStates[0].players);
    if (team1 && team2) {
      const logName1 = logPlayerNames.find(name => name.toLowerCase().includes(team1.id.toLowerCase()));
      const logName2 = logPlayerNames.find(name => name.toLowerCase().includes(team2.id.toLowerCase()));
      if (logName1) {
        p1Info = { logName: logName1, team: team1 };
        newTeamMap.set(logName1, team1);
      }
      if (logName2) {
        p2Info = { logName: logName2, team: team2 };
        newTeamMap.set(logName2, team2);
      }
    }
    
    if (!p1Info || !p2Info) return { player1: null, player2: null, teamMap: newTeamMap };
    
    // Determine who is player1 (bottom) based on who is the active player on turn 1
    const firstActivePlayerLogName = initialGameStates.find(s => s.turn === 1)?.activePlayer;
    if (firstActivePlayerLogName === p2Info.logName) {
        return { player1: p2Info, player2: p1Info, teamMap: newTeamMap };
    }
    return { player1: p1Info, player2: p2Info, teamMap: newTeamMap };
  }, [initialGameStates, team1, team2]);

  const battlefieldState = useMemo(() => {
    if (!player1 || !player2) return {};
    const state: Record<string, BattlefieldCard[]> = { [player1.logName]: [], [player2.logName]: [] };
    for (const pName of [player1.logName, player2.logName]) {
      const playerState = currentState.players[pName];
      if (playerState) {
          state[pName] = playerState.battlefield.map(card => {
              const cardInfo = cardDataMap.get(card.name);
              return {
                  ...card,
                  row: getCardCategory(card.cardType || ''),
                  imageUrl: cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null
              };
          });
      }
    }
    return state;
  }, [currentState, player1, player2, cardDataMap, useOldestArt]);

  useEffect(() => {
    const prevState = currentStepIndex > 0 ? initialGameStates[currentStepIndex - 1] : null;
    const logMessage = generateLogMessage(prevState, currentState, teamMap);
    if (logMessage) setEventLog(prev => [logMessage, ...prev].slice(0, 20));
    
    // Animation for spells
    if (prevState && currentState.stack.length > prevState.stack.length) {
        const newSpell = currentState.stack[currentState.stack.length - 1];
        const cardInfo = cardDataMap.get(newSpell.name);
        if (cardInfo) {
            const imageUrl = getCardImageUrl(cardInfo, useOldestArt);
            if (imageUrl) {
                setAnimatedCard({ name: newSpell.name, imageUrl, type: 'transient' });
                setTimeout(() => setAnimatedCard(null), 2900);
            }
        }
    }

    // Animation for life changes
    if (prevState && player1 && player2) {
      if (currentState.players[player1.logName].life !== prevState.players[player1.logName].life) {
        setLifeChange({ logName: player1.logName, type: currentState.players[player1.logName].life > prevState.players[player1.logName].life ? 'gain' : 'loss' });
        setTimeout(() => setLifeChange(null), 1000);
      }
      if (currentState.players[player2.logName].life !== prevState.players[player2.logName].life) {
        setLifeChange({ logName: player2.logName, type: currentState.players[player2.logName].life > prevState.players[player2.logName].life ? 'gain' : 'loss' });
        setTimeout(() => setLifeChange(null), 1000);
      }
    }
  }, [currentStepIndex, initialGameStates, teamMap, cardDataMap, useOldestArt, player1, player2]);

  useEffect(() => {
    if (!isPlaying || currentStepIndex >= initialGameStates.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCurrentStepIndex(prev => prev + 1), 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, initialGameStates.length]);

  const renderPlayerArea = (playerInfo: PlayerInfo | null, area: 'top' | 'bottom') => {
    if (!playerInfo) return <div className="h-1/2 w-full" />;
    const playerState = currentState.players[playerInfo.logName];
    if (!playerState) return <div className="h-1/2 w-full" />;

    const cards = battlefieldState[playerInfo.logName] || [];
    const frontRow = cards.filter(c => c.row === 'front');
    const backRow = cards.filter(c => c.row === 'back');
    const rows = area === 'top' ? [frontRow, backRow] : [backRow, frontRow];
    
    const renderRow = (rowCards: BattlefieldCard[]) => (
        <div className="flex-grow flex justify-center items-center gap-[-40px] px-24">
            {rowCards.map(card => (
                <div key={card.id} className="relative group">
                    {card.imageUrl && (
                      <img 
                        src={card.imageUrl} 
                        alt={card.name} 
                        className={`
                          h-28 object-contain drop-shadow-lg rounded-lg transition-all duration-300 group-hover:scale-150 group-hover:z-20
                          ${card.isTapped ? 'rotate-90' : ''}
                          ${card.isAttacking ? 'ring-4 ring-red-500' : ''}
                          ${card.isBlocking ? 'ring-4 ring-blue-500' : ''}
                        `}
                      />
                    )}
                </div>
            ))}
        </div>
    );

    return (
      <div className="relative w-full h-1/2 p-4 flex flex-col">
          <div className="flex-grow flex flex-col gap-2">
              {rows.map((row, i) => renderRow(row))}
          </div>
          <div className="absolute top-4 left-4 flex flex-col items-start gap-3 z-10">
              <div className="flex items-center gap-4">
                  <div className="text-5xl">{playerInfo.team.emoji}</div>
                  <div className={`text-6xl font-bold transition-colors duration-300 ${lifeChange?.logName === playerInfo.logName ? (lifeChange.type === 'loss' ? 'text-red-500' : 'text-green-500') : ''}`}>
                      {playerState.life}
                  </div>
              </div>
              <div className="flex gap-4">
                  <div className="text-center"><p className="font-bold text-2xl">{playerState.hand.length}</p><p className="text-3xl">🤚</p></div>
                  <div className="text-center"><p className="font-bold text-2xl">{playerState.librarySize}</p><p className="text-3xl">📚</p></div>
                  <div className="text-center"><p className="font-bold text-2xl">{playerState.graveyard.length}</p><p className="text-3xl">🪦</p></div>
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
                        <img src={animatedCard.imageUrl} alt={animatedCard.name} className="h-96 object-contain rounded-lg shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 border-t border-gray-700 bg-gray-800">
            <ScrollArea className="h-24 col-span-1 rounded-md bg-black/20 p-2">
                <div className="flex flex-col-reverse">{eventLog.map((msg, i) => <p key={i} className="text-xs text-gray-400 font-mono">{`> ${msg}`}</p>)}</div>
            </ScrollArea>
            <div className="col-span-1 flex items-center justify-center gap-2">
                <Button onClick={() => setCurrentStepIndex(0)} variant="ghost" size="icon" disabled={isPlaying}><SkipBack /></Button>
                <Button onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))} variant="ghost" size="icon" disabled={isPlaying}><Rewind /></Button>
                <Button onClick={() => setIsPlaying(!isPlaying)} size="lg" className="w-20">{isPlaying ? <Pause /> : <Play />}</Button>
                <Button onClick={() => setCurrentStepIndex(Math.min(initialGameStates.length - 1, currentStepIndex + 1))} variant="ghost" size="icon" disabled={isPlaying}><FastForward /></Button>
                <Button onClick={() => setCurrentStepIndex(initialGameStates.length - 1)} variant="ghost" size="icon" disabled={isPlaying}><SkipForward /></Button>
            </div>
            <div className="col-span-1 flex flex-col items-end justify-center text-right">
                <p className="font-bold">Step {currentStepIndex + 1} / {initialGameStates.length}</p>
                {currentState?.winner && <p className="text-lg font-bold text-yellow-400">Winner: {teamMap.get(currentState.winner)?.name || currentState.winner}</p>}
            </div>
        </div>
    </div>
  );
}
