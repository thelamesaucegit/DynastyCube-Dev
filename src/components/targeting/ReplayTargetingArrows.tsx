// src/components/targeting/ReplayTargetingArrows.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityId, ClientCard, ClientChosenTarget } from '@/types';
import type { SpectatorStateUpdate } from '@/types/replay-types';

// ========================================================================
// Helper functions (could be moved to a shared utility file)
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

function getCardCenter(cardId: EntityId): Point | null {
    const element = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getPlayerCenter(playerId: EntityId): Point | null {
    const element = document.querySelector(`[data-player-id="${playerId}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getTargetEntityId(target: ClientChosenTarget): EntityId | null {
    switch (target.type) {
        case 'Player': return target.playerId;
        case 'Permanent': return target.entityId;
        case 'Spell': return target.spellEntityId;
        case 'Card': return target.cardId;
        default: return null;
    }
}

function getTargetPosition(target: ClientChosenTarget): Point | null {
    switch (target.type) {
        case 'Player': return getPlayerCenter(target.playerId);
        case 'Permanent': return getCardCenter(target.entityId);
        case 'Spell': return getCardCenter(target.spellEntityId);
        case 'Card': return getCardCenter(target.cardId);
        default: return null;
    }
}

interface TargetArrow {
  targetKey: string;
  start: Point;
  end: Point;
  color: string;
  damageLabel?: number | null;
}

// --- PROPS FOR THE REPLAY COMPONENT ---
interface ReplayTargetingArrowsProps {
  snapshot: SpectatorStateUpdate;
}

export function ReplayTargetingArrows({ snapshot }: ReplayTargetingArrowsProps) {
  const [arrows, setArrows] = useState<TargetArrow[]>([]);

  // Derive stack cards directly from the snapshot
  const stackCards = useMemo(() => {
    const stackZone = snapshot.gameState.zones.find(z => z.zoneId.zoneType === 'Stack');
    return stackZone ? stackZone.cardIds.map(id => snapshot.gameState.cards[id]).filter(Boolean) : [];
  }, [snapshot]);

  useEffect(() => {
    const cardsWithTargets = stackCards.filter(card => (card.targets && card.targets.length > 0) || card.triggeringEntityId);
    if (cardsWithTargets.length === 0) {
      setArrows([]);
      return;
    }

    const updateArrows = () => {
      const newArrows: TargetArrow[] = [];
      for (const card of cardsWithTargets) {
        const stackPos = getCardCenter(card.id);
        if (!stackPos) continue;

        // Target arrows
        card.targets?.forEach((target, i) => {
          const targetPos = getTargetPosition(target);
          if (targetPos) {
            const targetEntityId = getTargetEntityId(target);
            const damageLabel = targetEntityId ? card.damageDistribution?.[targetEntityId] ?? null : null;
            newArrows.push({ targetKey: `${card.id}-target-${i}`, start: stackPos, end: targetPos, color: '#ff8800', damageLabel });
          }
        });

        // Source arrow for triggers
        if (card.triggeringEntityId) {
          const triggerPos = getCardCenter(card.triggeringEntityId);
          if (triggerPos) {
            newArrows.push({ targetKey: `${card.id}-source`, start: triggerPos, end: stackPos, color: '#44ccdd' });
          }
        }
      }
      setArrows(newArrows);
    };

    updateArrows();
    const interval = setInterval(updateArrows, 100);
    return () => clearInterval(interval);
  }, [stackCards]); // Dependency is now just the derived stackCards

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
