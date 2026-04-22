// /src/components/game/targeting/ReplayTargetingArrows.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityId, ClientCard, ClientChosenTarget, SpectatorStateUpdate } from '@/types';

// Helper functions from your original file - they are perfect.
interface Point { x: number; y: number; }
interface ArrowProps { start: Point; end: Point; color: string; damageLabel?: number | null; }
function Arrow({ start, end, color, damageLabel }: ArrowProps) { /* ... Your full, elegant Arrow component ... */ }
function getCardCenter(cardId: EntityId): Point | null { /* ... */ }
function getPlayerCenter(playerId: EntityId): Point | null { /* ... */ }
function getTargetEntityId(target: ClientChosenTarget): EntityId | null { /* ... */ }
function getTargetPosition(target: ClientChosenTarget): Point | null { /* ... */ }

interface TargetArrow {
  targetKey: string;
  start: Point;
  end: Point;
  color: string;
  damageLabel?: number | null;
}

interface ReplayTargetingArrowsProps {
  snapshot: SpectatorStateUpdate;
}

export function ReplayTargetingArrows({ snapshot }: ReplayTargetingArrowsProps) {
  const [arrows, setArrows] = useState<TargetArrow[]>([]);

  // We derive all necessary data from the snapshot prop.
  const { stackCards, combatAttackers } = useMemo(() => {
    const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
    const sCards = stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    const cAttackers = snapshot.gameState.combat?.attackers ?? [];
    return { stackCards: sCards, combatAttackers: cAttackers };
  }, [snapshot]);

  useEffect(() => {
    const cardsOnStack = stackCards.filter(card => (card.targets && card.targets.length > 0) || card.triggeringEntityId);
    const attackingCreatures = combatAttackers.filter(attacker => attacker.attackingTarget);

    if (cardsOnStack.length === 0 && attackingCreatures.length === 0) {
      setArrows([]);
      return;
    }

    const updateArrows = () => {
      const newArrows: TargetArrow[] = [];

      // 1. Logic for Spells/Abilities on the Stack (from your original file)
      for (const card of cardsOnStack) {
        const stackPos = getCardCenter(card.id);
        if (!stackPos) continue;

        card.targets?.forEach((target, i) => {
          const targetPos = getTargetPosition(target);
          if (targetPos) {
            const targetEntityId = getTargetEntityId(target);
            const damageLabel = targetEntityId ? card.damageDistribution?.[targetEntityId] ?? null : null;
            newArrows.push({ targetKey: `${card.id}-target-${i}`, start: stackPos, end: targetPos, color: '#ff8800', damageLabel });
          }
        });

        if (card.triggeringEntityId) {
          const triggerPos = getCardCenter(card.triggeringEntityId);
          if (triggerPos) {
            newArrows.push({ targetKey: `${card.id}-source`, start: triggerPos, end: stackPos, color: '#44ccdd' });
          }
        }
      }

      // 2. Logic for Combat Attackers
      for (const attacker of attackingCreatures) {
        const sourcePos = getCardCenter(attacker.creatureId);
        if (!sourcePos) continue;
        
        let targetId: EntityId | null = null;
        if (attacker.attackingTarget.type === 'Player') {
            targetId = attacker.attackingTarget.playerId;
        } else if (attacker.attackingTarget.type === 'Planeswalker') {
            targetId = attacker.attackingTarget.permanentId;
        }

        if (!targetId) continue;
        
        const targetPos = getPlayerCenter(targetId) || getCardCenter(targetId);
        if (targetPos) {
          newArrows.push({ targetKey: `combat-${attacker.creatureId}`, start: sourcePos, end: targetPos, color: '#ef4444' });
        }
      }

      setArrows(newArrows);
    };

    updateArrows();
    const interval = setInterval(updateArrows, 100);
    return () => clearInterval(interval);

  }, [stackCards, combatAttackers]); // Re-run when stack or attackers change

  if (arrows.length === 0) {
    return null;
  }

  return (
    <svg style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999 }}>
      {arrows.map(({ targetKey, start, end, color, damageLabel }) => (
        <Arrow key={targetKey} start={start} end={end} color={color} damageLabel={damageLabel} />
      ))}
    </svg>
  );
}
