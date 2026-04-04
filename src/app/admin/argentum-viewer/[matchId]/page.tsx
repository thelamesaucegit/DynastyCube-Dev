// src/app/admin/argentum-viewer/[matchId]/page.tsx

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';

// ============================================================================
// TYPE DEFINITIONS — data contract from the Argentum Java logger
// ============================================================================

export interface TargetInfo {
  entityId: string;
  type: 'Card' | 'Player' | 'Other';
}

export interface ClientCard {
  entityId: string;
  name: string;
  imageUri: string | null;
  cardTypes: string[];
  isTapped: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  power: number | null;
  toughness: number | null;
  damage: number;
  attachedTo: string | null;
  targets: TargetInfo[];
}

export interface ClientPlayer {
  playerId: string;
  name: string;
  life: number;
}

export interface ClientZone {
  zoneId: string;
  type: string;
  ownerId: string;
  cardIds: string[];
}

export interface CombatGroup {
  attackerId: string;
  blockers: string[];
}

export interface CombatState {
  groups: CombatGroup[];
  attackers: string[];
}

export interface ClientGameState {
  cards: Record<string, ClientCard>;
  zones: ClientZone[];
  players: ClientPlayer[];
  currentPhase: string;
  currentStep: string;
  activePlayerId: string;
  priorityPlayerId: string | null;
  turnNumber: number;
  isGameOver: boolean;
  winnerId: string | null;
  combat: CombatState | null;
  gameLog: string[];
}

export interface SpectatorStateUpdate {
  gameSessionId: string;
  gameState: ClientGameState;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  currentPhase: string;
  activePlayerId: string;
  priorityPlayerId: string | null;
  isReplay: boolean;
  combat: CombatState | null;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ArgentumMatchViewerPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  return (
    <Card className="max-w-2xl mx-auto mt-10">
      <CardHeader className="text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
        <CardTitle>Argentum Viewer Coming Soon</CardTitle>
        <CardDescription>
          The Argentum replay viewer for match <strong>{matchId}</strong> is under construction.
          The web-client viewer component has not yet been integrated.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
