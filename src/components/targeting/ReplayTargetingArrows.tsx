// src/components/targeting/ReplayTargetingArrows.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityId, ClientChosenTarget, SpectatorStateUpdate, ClientCard } from '@/types';
import { zoneIdEquals, stack, entityId } from '@/types'; 

// ========================================================================
// Helper functions
// ========================================================================

interface Point { x: number; y: number; }
interface ArrowProps { start: Point; end: Point; color: string; damageLabel?: number | null; }

function Arrow({ start, end, color, damageLabel }: ArrowProps) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const arcHeight = Math.min(distance * 0.2, 60);

    const controlX = midX;
    const controlY = midY - arcHeight;

    const pathD = `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;

    const tangentX = end.x - controlX;
    const tangentY = end.y - controlY;
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    const normX = tangentX / tangentLen;
    const normY = tangentY / tangentLen;

    const arrowSize = 12;
    const arrowAngle = Math.PI / 6;

    const cos = Math.cos(arrowAngle);
    const sin = Math.sin(arrowAngle);

    const arrow1X = end.x - arrowSize * (normX * cos + normY * sin);
    const arrow1Y = end.y - arrowSize * (normY * cos - normX * sin);
    const arrow2X = end.x - arrowSize * (normX * cos - normY * sin);
    const arrow2Y = end.y - arrowSize * (normY * cos + normX * sin);

    const arrowheadD = `M ${end.x} ${end.y} L ${arrow1X} ${arrow1Y} M ${end.x} ${end.y} L ${arrow2X} ${arrow2Y}`;

    let badgeElement: React.ReactNode = null;

    if (damageLabel != null) {
        const t = 0.5;
        const mt = 1 - t;
        const badgeX = mt * mt * start.x + 2 * mt * t * controlX + t * t * end.x;
        const badgeY = mt * mt * start.y + 2 * mt * t * controlY + t * t * end.y;

        const label = `${damageLabel} dmg`;
        const textWidth = label.length * 7 + 12;

        badgeElement = (
            <g>
                <rect x={badgeX - textWidth / 2} y={badgeY - 11} width={textWidth} height={22} rx={11} fill="#000000" fillOpacity={0.85} stroke="#dc2626" strokeWidth={1.5} />
                <text x={badgeX} y={badgeY + 4} textAnchor="middle" fill="#f87171" fontSize={12} fontWeight={700} fontFamily="system-ui, sans-serif" style={{ pointerEvents: 'none' }}>{label}</text>
            </g>
        );
    }
    
    return (
        <g>
            <path d={pathD} fill="none" stroke={color} strokeWidth={8} strokeOpacity={0.3} strokeLinecap="round" />
            <path d={pathD} fill="none" stroke={color} strokeWidth={3} strokeOpacity={0.9} strokeLinecap="round" />
            <path d={arrowheadD} fill="none" stroke={color} strokeWidth={3} strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
            {badgeElement}
        </g>
    );
}

function getCardCenter(cardId: EntityId | string): Point | null {
    if (!cardId) return null;
    const element = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getPlayerCenter(playerId: EntityId | string): Point | null {
    if (!playerId) return null;
    const element = document.querySelector(`[data-player-id="${playerId}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function extractIdSafely(obj: unknown): EntityId | null {
    if (!obj) return null;
    
    if (typeof obj === 'string') {
        return obj as EntityId;
    }

    if (typeof obj === 'object') {
        const record = obj as Record<string, unknown>;
        const possibleProperties = [
            record.playerId, record.id, record.entityId, record.permanentId, 
            record.cardId, record.spellEntityId, record.spellId, record.targetId,
            record.creatureId, record.attackerId
        ];
        
        for (const prop of possibleProperties) {
            if (typeof prop === 'string' && prop.trim() !== '') {
                return prop as EntityId;
            }
        }
    }
    return null;
}

function getTargetPosition(target: unknown): Point | null {
    const id = extractIdSafely(target);
    if (!id) return null;

    return getPlayerCenter(id) || getCardCenter(id);
}

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

  const { stackCards, combatAttackers } = useMemo(() => {
    if (!snapshot.gameState) return { stackCards: [], combatAttackers: [] };
    
    const stackTargetId = stack(entityId('game'));
    const stackZone = snapshot.gameState.zones.find(z => zoneIdEquals(z.zoneId, stackTargetId));
    
    const sCards = stackZone ? stackZone.cardIds.map(id => {
        const card = snapshot.gameState.cards[id];
        return card ? { ...card, id: id } as ClientCard : null;
    }).filter((c): c is ClientCard => c !== null) : [];
    
    const combat = snapshot.gameState.combat || snapshot.combat;
    // CRITICAL FIX: Explicitly type as readonly to satisfy state immutability
    const cAttackers: readonly unknown[] = combat?.attackers ?? [];
    
    return { stackCards: sCards, combatAttackers: cAttackers };
  }, [snapshot]);

  useEffect(() => {
    const updateArrows = () => {
      const newArrows: TargetArrow[] = [];
      
      const cardsOnStack = stackCards.filter(card => (card.targets && card.targets.length > 0) || card.triggeringEntityId);

      // 1. Spells/Abilities on the Stack
      for (const card of cardsOnStack) {
        const stackPos = getCardCenter(card.id);
        if (!stackPos) continue;

        if (card.targets && card.targets.length > 0) {
             card.targets.forEach((target, i) => {
              const targetPos = getTargetPosition(target);
              if (targetPos) {
                const targetId = extractIdSafely(target);
                const dmgDict = card.damageDistribution as Record<string, number> | undefined;
                const damageLabel = targetId && dmgDict ? dmgDict[targetId as string] ?? null : null;
                
                newArrows.push({ targetKey: `${card.id}-target-${i}`, start: stackPos, end: targetPos, color: '#ff8800', damageLabel });
              }
            });
        }

        if (card.triggeringEntityId) {
          const triggerPos = getCardCenter(card.triggeringEntityId);
          if (triggerPos) {
            newArrows.push({ targetKey: `${card.id}-source`, start: triggerPos, end: stackPos, color: '#44ccdd' });
          }
        }
      }

      // 2. Combat Targeting (Attackers)
      for (const attacker of combatAttackers) {
        if (!attacker || typeof attacker !== 'object') continue;
        
        const sourceId = extractIdSafely(attacker);
        if (!sourceId) continue;
        
        const sourcePos = getCardCenter(sourceId);
        if (!sourcePos) continue;
        
        const record = attacker as Record<string, unknown>;
        let targetId = extractIdSafely(record.attackingTarget);
        
        if (!targetId) {
             const possibleTargetIds = [record.targetId, record.defenderId, record.blockingId];
             for (const id of possibleTargetIds) {
                 if (typeof id === 'string' && id.trim() !== '') {
                     targetId = id as EntityId;
                     break;
                 }
             }
        }
        
        if (!targetId) continue;
        
        const targetPos = getPlayerCenter(targetId) || getCardCenter(targetId);
        if (targetPos) {
          newArrows.push({ targetKey: `combat-${sourceId}`, start: sourcePos, end: targetPos, color: '#ef4444' });
        }
      }
      
      setArrows(newArrows);
    };

    updateArrows();
    const interval = setInterval(updateArrows, 50); 
    return () => clearInterval(interval);
  }, [stackCards, combatAttackers]);

  if (arrows.length === 0) return null;

  return (
    <svg style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }}>
      {arrows.map(({ targetKey, start, end, color, damageLabel }) => (
        <Arrow key={targetKey} start={start} end={end} color={color} damageLabel={damageLabel} />
      ))}
    </svg>
  );
}
