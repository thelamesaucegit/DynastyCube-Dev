// src/components/game/ReplayGameLog.tsx

"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { SpectatorStateUpdate } from '@/types/replay-types';
import type { ClientEvent, EntityId } from '@/types'; // Assuming LogEntry is similar to ClientEvent

// --- RE-IMPLEMENTED STYLES (to make this a standalone component) ---
const styles: Record<string, React.CSSProperties> = {
  toggleButton: { position: 'fixed', bottom: 12, left: 12, zIndex: 500, padding: '6px 12px', fontSize: 12, backgroundColor: 'rgba(20, 20, 40, 0.85)', color: '#aaa', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' },
  panel: { position: 'fixed', bottom: 12, left: 12, zIndex: 500, width: 'min(320px, calc(100vw - 24px))', maxHeight: 300, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(10, 10, 25, 0.92)', border: '1px solid #333', borderRadius: 8, overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #333' },
  headerTitle: { color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 },
  closeButton: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  entries: { flex: 1, overflowY: 'auto', padding: '4px 8px', maxHeight: 260 },
  empty: { color: '#555', fontSize: 12, padding: 8, textAlign: 'center' },
  entry: { fontSize: 12, padding: '2px 0', lineHeight: 1.4, borderBottom: '1px solid rgba(255,255,255,0.04)' },
  turnSeparator: { fontSize: 11, padding: '6px 0 4px', lineHeight: 1.4, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 2, marginBottom: 2 },
};

// A helper function to safely extract the relevant player ID from any event type.
function getEventPlayerId(event: ClientEvent): EntityId | null {
    switch (event.type) {
        case 'lifeChanged':
        case 'cardDrawn':
        case 'cardDiscarded':
        case 'manaAdded':
        case 'playerLost':
        case 'coinFlipped':
        case 'cardCycled':
        case 'libraryShuffled':
        case 'permanentsSacrificed':
        case 'decisionMade':
            return event.playerId;
        case 'spellCast':
            return event.casterId;
        case 'permanentEntered':
        case 'turnedFaceUp':
            return event.controllerId;
        case 'creatureAttacked':
            return event.attackingPlayerId;
        case 'handRevealed':
            return event.revealingPlayerId;
        case 'controlChanged':
            return event.newControllerId;
        // Events that are neutral or where the player context is complex
        case 'damageDealt':
        case 'statsModified':
        case 'permanentLeft':
        case 'creatureBlocked':
        case 'creatureDied':
        case 'spellResolved':
        case 'spellCountered':
        case 'abilityTriggered':
        case 'abilityActivated':
        case 'permanentTapped':
        case 'permanentUntapped':
        case 'counterAdded':
        case 'counterRemoved':
        case 'gameEnded':
        case 'handLookedAt':
        case 'cardsRevealed':
        case 'turnChanged':
        case 'abilityFizzled':
        case 'targetReselected':
        default:
            return null;
    }
}

// --- REPLAY-SPECIFIC PROPS ---
interface ReplayGameLogProps {
  snapshot: SpectatorStateUpdate;
}

// LogEntryRow is a pure component, it can be reused directly
function LogEntryRow({ entry, viewingPlayerId }: { entry: ClientEvent; viewingPlayerId: string }) {
  if (entry.type === 'turnChanged' ) {
    return <div style={styles.turnSeparator}>{entry.description}</div>;
  
  }
  
  const isPlayer = entry.playerId === viewingPlayerId;
  const color = entry.type === 'system' ? '#999' : entry.playerId === null ? '#888' : isPlayer ? '#5bc0de' : '#e07050';
  
  return <div style={{ ...styles.entry, color }}>{entry.description}</div>;
}

export function ReplayGameLog({ snapshot }: ReplayGameLogProps) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const logEntries = snapshot.gameState.gameLog ?? [];
  const viewingPlayerId = snapshot.player1Id; // In replay, p1 is always the "viewer"

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logEntries.length, expanded]);

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={styles.toggleButton}>
        Log ({logEntries.length})
      </button>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Game Log</span>
        <button onClick={() => setExpanded(false)} style={styles.closeButton}>&times;</button>
      </div>
      <div ref={scrollRef} style={styles.entries}>
        {logEntries.length === 0 ? (
          <div style={styles.empty}>No events yet</div>
        ) : (
          logEntries.map((entry, i) => (
            <LogEntryRow key={i} entry={entry} viewingPlayerId={viewingPlayerId} />
          ))
        )}
      </div>
    </div>
  );
}
