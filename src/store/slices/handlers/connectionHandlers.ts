/**
 * Handlers for connection and reconnection messages.
 */
import type { MessageHandlers } from '@/network/messageHandlers'
import { entityId, createJoinLobbyMessage, createSpectateGameMessage } from '@/types'
import { getWebSocket, clearLobbyId, loadLobbyId } from '../shared'
import type { SetState, GetState } from './types'

type ConnectionHandlerKeys = 'onConnected' | 'onReconnected' | 'onOnlinePlayersCount'

export function createConnectionHandlers(set: SetState, get: GetState): Pick<MessageHandlers, ConnectionHandlerKeys> {
  return {
    onConnected: (msg) => {
      localStorage.setItem('argentum-token', msg.token)
      set({
        connectionStatus: 'connected',
        playerId: entityId(msg.playerId),
        aiEnabled: msg.aiEnabled ?? false,
        availableSets: msg.availableSets ?? [],
      })

      // Auto-join tournament if we have a pending tournament ID (from /tournament/:lobbyId route)
      const { pendingTournamentId, pendingSpectateGameId } = get()
      if (pendingTournamentId) {
        set({ pendingTournamentId: null })
        getWebSocket()?.send(createJoinLobbyMessage(pendingTournamentId))
      } else if (pendingSpectateGameId) {
        // Set when the user clicked Spectate on the landing page before being connected.
        set({ pendingSpectateGameId: null })
        getWebSocket()?.send(createSpectateGameMessage(pendingSpectateGameId))
      } else {
        clearLobbyId()
      }
    },

    onReconnected: (msg) => {
      localStorage.setItem('argentum-token', msg.token)
      const updates: Partial<import('../types').GameStore> = {
        connectionStatus: 'connected',
        playerId: entityId(msg.playerId),
        aiEnabled: msg.aiEnabled ?? false,
        availableSets: msg.availableSets ?? [],
      }
      if (msg.context === 'game' && msg.contextId) {
        updates.sessionId = msg.contextId
      }
      set(updates)

      if (!msg.context && !msg.contextId) {
        const savedLobbyId = loadLobbyId()
        if (savedLobbyId) {
          getWebSocket()?.send(createJoinLobbyMessage(savedLobbyId))
        }
      }
    },

    onOnlinePlayersCount: (msg) => {
      set({ onlinePlayers: msg.count })
    },
  }
}
