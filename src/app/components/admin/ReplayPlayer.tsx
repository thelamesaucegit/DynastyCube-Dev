//src/app/components/admin/ReplayPlayer.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { GameState, PlayerState, Card as CardType } from '@/app/types';
import { ReplayCardData } from '@/app/actions/cardActions';
import { Play, Pause, SkipBack, Rewind, FastForward, SkipForward } from 'lucide-react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { useSettings } from '@/contexts/SettingsContext';
// FIX: Removed the unnecessary and incorrect import of CardWithImages
import { getCardImageUrl } from '@/app/utils/cardUtils';

// --- TYPE DEFINITIONS ---
interface Team { id: string; name: string; emoji: string; }
interface ReplayPlayerProps {
  initialGameStates: GameState[];
  matchId: string;
  team1: Team | null;
  team2: Team | null;
  cardDataMap: Record<string, ReplayCardData>;
}
interface BattlefieldCard extends CardType { row: 'front' | 'back'; imageUrl: string | null; }
interface AnimatedCard { name: string; imageUrl: string; }
interface PlayerInfo { logName: string; team: Team; }

// --- HELPER FUNCTIONS ---
const getCardCategory = (cardType: string): 'front' | 'back' => {
  const type = cardType.toLowerCase();
  return (type.includes('land') || (type.includes('artifact') && !type.includes('creature'))) ? 'back' : 'front';
};

const generateLogMessage = (prevState: GameState | null, nextState: GameState, teamMap: Map<string, Team>): string | null => {
    const formatPlayerName = (logName: string) => teamMap.get(logName)?.name || logName;
    if (!prevState) return `Match starts.`;
    
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
};

// --- MODAL COMPONENT for Graveyard/Exile ---
const ZoneViewer = ({ zoneName, cards, cardDataMap }: { zoneName: string, cards: CardType[], cardDataMap: Record<string, ReplayCardData>}) => {
  const { useOldestArt } = useSettings();
  return (
    <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl">
      <DialogHeader>
        <DialogTitle className="text-white">{zoneName}</DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] p-4">
        <div className="flex flex-wrap gap-4">
          {cards.length > 0 ? cards.map(card => {
            const cardInfo = cardDataMap[card.name];
            // FIX: Handle the case where cardInfo might be undefined
            const imageUrl = cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null;
            return imageUrl ? <img key={card.id} src={imageUrl} alt={card.name} className="h-48 object-contain rounded-lg" /> : null;
          }) : <p className="text-gray-400">This zone is empty.</p>}
        </div>
      </ScrollArea>
    </DialogContent>
  );
};


// --- MAIN COMPONENT ---
export function ReplayPlayer({ initialGameStates, matchId, team1, team2, cardDataMap }: ReplayPlayerProps) {
  const { useOldestArt } = useSettings();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [animatedCard, setAnimatedCard] = useState<AnimatedCard | null>(null);

  const currentState = initialGameStates[currentStepIndex];

  const { player1, player2, teamMap } = useMemo(() => {
    const newTeamMap = new Map<string, Team>();
    let p1Info: PlayerInfo | null = null;
    let p2Info: PlayerInfo | null = null;
    
    const logPlayerNames = Object.keys(initialGameStates[0].players);
    if (team1 && team2) {
      const logName1 = logPlayerNames.find(name => name.includes(team1.id));
      const logName2 = logPlayerNames.find(name => name.includes(team2.id));
      if (logName1) { p1Info = { logName: logName1, team: team1 }; newTeamMap.set(logName1, team1); }
      if (logName2) { p2Info = { logName: logName2, team: team2 }; newTeamMap.set(logName2, team2); }
    }
    
    if (!p1Info || !p2Info) return { player1: null, player2: null, teamMap: newTeamMap };
    
    const firstActivePlayerLogName = initialGameStates.find(s => s.turn === 1)?.activePlayer;
    if (firstActivePlayerLogName === p2Info.logName) {
        return { player1: p2Info, player2: p1Info, teamMap: newTeamMap };
    }
    return { player1: p1Info, player2: p2Info, teamMap: newTeamMap };
  }, [initialGameStates, team1, team2]);

  const battlefieldState = useMemo(() => {
    if (!player1 || !player2 || !currentState) return {};
    const state: Record<string, BattlefieldCard[]> = { [player1.logName]: [], [player2.logName]: [] };
    for (const pName of [player1.logName, player2.logName]) {
      const playerState = currentState.players[pName];
      if (playerState) {
          state[pName] = playerState.battlefield.map(card => {
              const cardInfo = cardDataMap[card.name];
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
    
    if (prevState && currentState.stack.length > prevState.stack.length) {
        const newSpell = currentState.stack[currentState.stack.length - 1];
        const cardInfo = cardDataMap[newSpell.name];
        if (cardInfo) {
            const imageUrl = getCardImageUrl(cardInfo, useOldestArt);
            if (imageUrl) {
                setAnimatedCard({ name: newSpell.name, imageUrl });
                setTimeout(() => setAnimatedCard(null), 2500);
            }
        }
    }
  }, [currentStepIndex, initialGameStates, teamMap, cardDataMap, useOldestArt]);

  useEffect(() => {
    if (!isPlaying || currentStepIndex >= initialGameStates.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timeout = currentState.turn < 1 ? 150 : 1000;
    const timer = setTimeout(() => setCurrentStepIndex(prev => prev + 1), timeout);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, initialGameStates.length, currentState.turn]);

  const renderPlayerArea = (playerInfo: PlayerInfo | null, area: 'top' | 'bottom') => {
    if (!playerInfo) return <div className="h-1/2 w-full" />;
    const playerState = currentState.players[playerInfo.logName];
    if (!playerState) return <div className="h-1/2 w-full" />;

    const cards = battlefieldState[playerInfo.logName] || [];
    const frontRow = cards.filter(c => c.row === 'front');
    const backRow = cards.filter(c => c.row === 'back');
    const rows = area === 'bottom' ? [frontRow, backRow] : [backRow, frontRow];    
    const renderRow = (rowCards: BattlefieldCard[]) => {
    // Group cards by name
    const groups = rowCards.reduce<Record<string, BattlefieldCard[]>>((acc, card) => {
        (acc[card.name] = acc[card.name] || []).push(card);
        return acc;
    }, {});

    return (
        <div className="flex-grow flex justify-center items-center gap-2 px-24">
            {Object.entries(groups).map(([name, cards]) => (
                <div key={name} className="relative" style={{ width: '80px', height: '112px' }}>
                    {cards.map((card, i) => (
                        <div
                            key={card.id}
                            className="absolute group"
                            style={{ top: `${i * -6}px`, left: `${i * 6}px`, zIndex: i }}
                        >
                            {card.imageUrl
                                ? <img
                                    src={card.imageUrl}
                                    alt={card.name}
                                    className={`
                                        h-28 object-contain drop-shadow-lg rounded-lg
                                        transition-all duration-300 group-hover:scale-150 group-hover:z-20
                                        ${card.isTapped ? 'rotate-90' : ''}
                                        ${card.isAttacking ? 'ring-4 ring-red-500 scale-110' : ''}
                                        ${card.isBlocking ? 'ring-4 ring-blue-500' : ''}
                                    `}
                                />
                                : <div className="h-28 w-20 bg-gray-700 rounded-lg flex items-center justify-center text-xs text-center p-1 text-white">
                                    {card.name}
                                  </div>
                            }
                        </div>
                    ))}
                    {cards.length > 1 && (
                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-50">
                            {cards.length}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};    
    return (
      <div className="relative w-full h-1/2 p-4 flex flex-col">
          <div className="flex-grow flex flex-col gap-2">{rows.map((row, i) => renderRow(row))}</div>
          <div className="absolute top-4 left-4 flex flex-col items-start gap-3 z-10">
              <div className="flex items-center gap-4">
                  <div className="text-5xl">{playerInfo.team.emoji}</div>
                  <div className="text-6xl font-bold">{playerState.life}</div>
              </div>
              <div className="flex gap-4">
                  <div className="text-center"><p className="font-bold text-2xl">{playerState.hand.length}</p><p className="text-3xl">🤚</p></div>
                  <div className="text-center"><p className="font-bold text-2xl">{playerState.librarySize}</p><p className="text-3xl">📚</p></div>
                  <Dialog>
                    <DialogTrigger asChild><div className="text-center cursor-pointer"><p className="font-bold text-2xl">{playerState.graveyard.length}</p><p className="text-3xl">🪦</p></div></DialogTrigger>
                    <ZoneViewer zoneName="Graveyard" cards={playerState.graveyard} cardDataMap={cardDataMap} />
                  </Dialog>
                  <Dialog>
                    <DialogTrigger asChild><div className="text-center cursor-pointer"><p className="font-bold text-2xl">{playerState.exile.length}</p><p className="text-3xl">🌀</p></div></DialogTrigger>
                    <ZoneViewer zoneName="Exile" cards={playerState.exile} cardDataMap={cardDataMap} />
                  </Dialog>
              </div>
          </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg overflow-hidden select-none">
        <div className="relative h-[80vh] flex flex-col">
            {renderPlayerArea(player2, 'top')}
          {currentState.stack.length > 0 && (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex gap-2 items-center bg-black/50 rounded-lg p-2">
    {currentState.stack.map(card => {
      const cardInfo = cardDataMap[card.name];
      const imageUrl = cardInfo ? getCardImageUrl(cardInfo, useOldestArt) : null;
      return imageUrl 
        ? <img key={card.id} src={imageUrl} alt={card.name} className="h-24 rounded-lg shadow-lg ring-2 ring-yellow-400" />
        : <div key={card.id} className="h-24 w-16 bg-gray-700 rounded-lg flex items-center justify-center text-xs text-center p-1">{card.name}</div>;
    })}
  </div>
)}
            {renderPlayerArea(player1, 'bottom')}
            {animatedCard && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm pointer-events-none">
                    <div className="text-center animate-in fade-in zoom-in-75 duration-500">
                        <img src={animatedCard.imageUrl} alt={animatedCard.name} className="h-96 object-contain rounded-lg shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 border-t border-gray-700 bg-gray-800">
            <ScrollArea className="h-24 col-span-1 rounded-md bg-black/20 p-2"><div className="flex flex-col-reverse">{eventLog.map((msg, i) => <p key={i} className="text-xs text-gray-400 font-mono">{`> ${msg}`}</p>)}</div></ScrollArea>
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
