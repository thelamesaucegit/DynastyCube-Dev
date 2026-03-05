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
  imageUrl?: string | null;
}

function getCardCategory(cardName: string, cardDataMap: Map<string, ReplayCardData>): 'front' | 'back' {
  const cardInfo = cardDataMap.get(cardName);
  if (!cardInfo) return 'front';
  const type = cardInfo.card_type.toLowerCase();
  if (type.includes('land') || (type.includes('artifact') && !type.includes('creature'))) {
    return 'back';
  }
  return 'front';
}

function generateLogMessage(prevState: GameState | null, nextState: GameState): string | null {
    if (!prevState) return `Match starts. Turn ${nextState.turn}. Active player: ${nextState.activePlayer}.`;
    if (prevState.turn !== nextState.turn) return `Turn ${nextState.turn}: ${nextState.activePlayer} begins their turn.`;
    if(prevState.phase !== nextState.phase) return `${nextState.activePlayer} enters the ${nextState.phase} phase.`;

    const prevPlayers = prevState.players;
    const nextPlayers = nextState.players;

    for (const playerName in nextPlayers) {
        const prevPlayer = prevPlayers[playerName];
        const nextPlayer = nextPlayers[playerName];
        if (!prevPlayer) continue;

        if (prevPlayer.life !== nextPlayer.life) {
            const diff = nextPlayer.life - prevPlayer.life;
            return `${playerName} ${diff > 0 ? 'gains' : 'loses'} ${Math.abs(diff)} life. (Now at ${nextPlayer.life})`;
        }

        if (prevPlayer.battlefield.length < nextPlayer.battlefield.length) {
            const newCard = nextPlayer.battlefield.find(c => !prevPlayer.battlefield.some(pc => pc.id === c.id));
            if (newCard) return `${playerName} plays ${newCard.name}.`;
        }

        if (prevPlayer.battlefield.length > nextPlayer.battlefield.length) {
            const removedCard = prevPlayer.battlefield.find(c => !nextPlayer.battlefield.some(nc => nc.id === nc.id));
            if (removedCard) return `${removedCard.name} leaves the battlefield.`;
        }

        const newAttacker = nextPlayer.battlefield.find(c => c.isAttacking && !prevPlayer.battlefield.find(pc => pc.id === c.id)?.isAttacking);
        if (newAttacker) return `${playerName} attacks with ${newAttacker.name}.`;
    }
    return null;
}

export function ReplayPlayer({ initialGameStates, matchId, team1, team2, cardDataMap }: ReplayPlayerProps) {
  const { useOldestArt } = useSettings();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [lastPlayedCard, setLastPlayedCard] = useState<{ name: string; imageUrl: string } | null>(null);
  const [lifeChange, setLifeChange] = useState<{ teamId: string; type: 'gain' | 'loss' } | null>(null);

  const currentState = initialGameStates[currentStepIndex];
  
  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    if (team1 && initialGameStates[0]?.players && Object.values(initialGameStates[0].players)[0]) {
      map.set(Object.values(initialGameStates[0].players)[0].name, team1);
    }
    if (team2 && initialGameStates[0]?.players && Object.values(initialGameStates[0].players)[1]) {
      map.set(Object.values(initialGameStates[0].players)[1].name, team2);
    }
    return map;
  }, [team1, team2, initialGameStates]);

  const p1Name = currentState?.players ? Object.keys(currentState.players)[0] : '';
  const p2Name = currentState?.players ? Object.keys(currentState.players)[1] : '';
  const p1Team = p1Name ? teamMap.get(p1Name) : undefined;
  const p2Team = p2Name ? teamMap.get(p2Name) : undefined;

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

  useEffect(() => {
    const prevState = currentStepIndex > 0 ? initialGameStates[currentStepIndex - 1] : null;
    if (!currentState) return;
    const logMessage = generateLogMessage(prevState, currentState);
    if (logMessage) setEventLog(prev => [...prev, logMessage].slice(-10));
    if (!prevState || !p1Name || !p2Name) return;

    const prevCards = new Set([...prevState.players[p1Name].battlefield.map(c => c.id), ...prevState.players[p2Name].battlefield.map(c => c.id)]);
    const nextCards = new Set([...currentState.players[p1Name].battlefield.map(c => c.id), ...currentState.players[p2Name].battlefield.map(c => c.id)]);
    const cardPlayed = [...currentState.players[p1Name].battlefield, ...currentState.players[p2Name].battlefield].find(c => !prevCards.has(c.id));
    const cardRemoved = [...prevState.players[p1Name].battlefield, ...prevState.players[p2Name].battlefield].find(c => !nextCards.has(c.id));
    const cardToShow = cardPlayed || cardRemoved;

    if (cardToShow) {
        const cardInfo = cardDataMap.get(cardToShow.name);
        if (cardInfo) {
            const imageUrl = getCardImageUrl(cardInfo, useOldestArt);
            if (imageUrl) {
                setLastPlayedCard({ name: cardToShow.name, imageUrl });
                setTimeout(() => setLastPlayedCard(null), 3000);
            }
        }
    }

    const p1LifeChange = currentState.players[p1Name]?.life !== prevState.players[p1Name]?.life;
    const p2LifeChange = currentState.players[p2Name]?.life !== prevState.players[p2Name]?.life;

    if (p1LifeChange && p1Team) {
        const type = currentState.players[p1Name].life > prevState.players[p1Name].life ? 'gain' : 'loss';
        setLifeChange({ teamId: p1Team.id, type });
        setTimeout(() => setLifeChange(null), 1000);
    }
    if (p2LifeChange && p2Team) {
        const type = currentState.players[p2Name].life > prevState.players[p2Name].life ? 'gain' : 'loss';
        setLifeChange({ teamId: p2Team.id, type });
        setTimeout(() => setLifeChange(null), 1000);
    }
  }, [currentStepIndex, initialGameStates, cardDataMap, p1Name, p2Name, p1Team, p2Team, useOldestArt]);
  
  const renderBattlefield = (playerState: PlayerStateType | undefined, playerTeam: Team | undefined) => {
    if (!playerState || !playerTeam) return <div className="w-full h-1/2 bg-gray-700/50 p-4"></div>;

    const battlefieldCards: BattlefieldCard[] = playerState.battlefield.map(c => {
        const cardInfo = cardDataMap.get(c.name);
        return { ...c, imageUrl: cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null };
    });

    const backRow = battlefieldCards.filter(c => getCardCategory(c.name, cardDataMap) === 'back');
    const frontRow = battlefieldCards.filter(c => getCardCategory(c.name, cardDataMap) === 'front');

    const renderRow = (cards: BattlefieldCard[]) => (
        <div className="flex justify-center items-end gap-[-20px] min-h-[100px]">
            {cards.map((card, index) => (
                <div key={card.id} className="relative transition-transform duration-500 hover:scale-150 hover:z-10">
                    {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="h-24 object-contain drop-shadow-lg" style={{ transform: `translateX(${index * -20}px)`}} />}
                </div>
            ))}
        </div>
    );

    return (
        <div className="relative w-full h-1/2 bg-gray-700/50 p-4 flex flex-col justify-between">
            <div className={`absolute top-4 left-4 flex items-center gap-4 z-10 transition-all duration-500 ${lifeChange?.teamId === playerTeam?.id && lifeChange.type === 'loss' ? 'animate-ping' : ''} ${lifeChange?.teamId === playerTeam?.id && lifeChange.type === 'gain' ? 'animate-ping' : ''}`}>
                <div className="relative">
                    <div className="text-5xl">{playerTeam?.emoji}</div>
                    {currentState.activePlayer === playerState.name && <div className="absolute inset-0 rounded-full ring-4 ring-blue-400 ring-offset-4 ring-offset-gray-800 animate-pulse"></div>}
                </div>
                <div className={`text-6xl font-bold ${lifeChange?.teamId === playerTeam?.id && lifeChange.type === 'loss' ? 'text-red-500' : ''} ${lifeChange?.teamId === playerTeam?.id && lifeChange.type === 'gain' ? 'text-green-500' : ''}`}>{playerState.life}</div>
            </div>
            <div className="flex flex-col gap-2">
                {renderRow(frontRow)}
                {renderRow(backRow)}
            </div>
        </div>
    );
  };
  
  return (
    <div className="bg-gray-800 text-white rounded-lg overflow-hidden">
        <div className="relative h-[80vh] flex flex-col">
            {renderBattlefield(currentState?.players[p2Name], p2Team)}
            {renderBattlefield(currentState?.players[p1Name], p1Team)}
            {lastPlayedCard && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
                    <div className="text-center animate-in fade-in zoom-in-75 duration-500">
                        <p className="text-2xl font-bold mb-2 drop-shadow-lg">{lastPlayedCard.name}</p>
                        <img src={lastPlayedCard.imageUrl} alt={lastPlayedCard.name} className="h-96 object-contain rounded-lg shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 border-t border-gray-700 bg-gray-900">
            <ScrollArea className="h-24 col-span-1 rounded-md bg-black/20 p-2">
                {eventLog.map((msg, i) => <p key={i} className="text-xs text-gray-400 font-mono animate-in fade-in">{`> ${msg}`}</p>)}
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
