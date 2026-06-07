// src/components/targeting/ReplayTargetingArrows.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityId, ClientChosenTarget, SpectatorStateUpdate } from '@/types';

// ... (Keep all your helper functions like Arrow, getCardCenter, etc. exactly the same) ...
// ... (I am omitting them here for brevity, but keep them in your file) ...

export function ReplayTargetingArrows({ snapshot }: ReplayTargetingArrowsProps) {
  const [arrows, setArrows] = useState<TargetArrow[]>([]);

  const { stackCards, combatAttackers } = useMemo(() => {
    if (!snapshot.gameState) return { stackCards: [], combatAttackers: [] };
    
    const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
    const sCards = stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
    
    // CRITICAL FIX: Add the fallback for snapshot.combat just like the battlefield does!
    const combat = snapshot.gameState.combat || snapshot.combat;
    const cAttackers = combat?.attackers ?? [];
    
    return { stackCards: sCards, combatAttackers: cAttackers };
  }, [snapshot]);

  useEffect(() => {
    const updateArrows = () => {
      const newArrows: TargetArrow[] = [];
      const cardsOnStack = stackCards.filter(card => (card.targets && card.targets.length > 0) || card.triggeringEntityId);
      const attackingCreatures = combatAttackers.filter(attacker => attacker.attackingTarget);

      // 1. Spells/Abilities on the Stack
      for (const card of cardsOnStack) {
        const stackPos = getCardCenter(card.id);
        if (!stackPos) continue; // IF STACK CARD ISN'T FOUND, IT ABORTS HERE

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

      // 2. Combat Targeting (Attackers)
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
  }, [stackCards, combatAttackers]);

  if (arrows.length === 0) return null;

  return (
    <svg style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999 }}>
      {arrows.map(({ targetKey, start, end, color, damageLabel }) => (
        <Arrow key={targetKey} start={start} end={end} color={color} damageLabel={damageLabel} />
      ))}
    </svg>
  );
}
