import { useZoneCards } from '@/store/selectors.ts'
import { command } from '@/types'
import type { ClientPlayer } from '@/types'
import { useResponsiveContext } from './shared'
import { GameCard } from '../card'

/**
 * Command zone widget for Commander-format games.
 *
 * Renders the player's commander(s) face-up alongside the player's main row, mirroring how
 * deck/graveyard/exile sit on the opposite side. Click and drag routing is handled by
 * `GameCard`'s existing flows — the server emits `CastSpell` legal actions with
 * `sourceZone == "COMMAND"` and a post-tax `manaCostString`, so the same hand-cast cost overlay
 * (red/green badge) shows the commander tax automatically. `enableDragToCast` opts the card
 * into hand-style drag-to-play without inheriting hand-only behaviours.
 *
 * Renders nothing when the command zone is empty (default for non-Commander formats).
 */
export function CommandZone({ player, isOpponent = false }: { player: ClientPlayer; isOpponent?: boolean }) {
  const cards = useZoneCards(command(player.playerId))
  const responsive = useResponsiveContext()

  if (cards.length === 0) return null

  // Render at battlefield-card size — bigger than the deck/graveyard pile column on the right
  // so the commander reads as a real, interactive card rather than a shrunken pile thumbnail.
  // (`smallCardWidth` is *smaller* than `pileWidth` on desktop, despite the name; battlefield
  // is the correct "regular card" reference size.)
  const cardWidth = responsive.battlefieldCardWidth

  // Mirror ZonePile's vertical alignment so the command zone hugs the same edge of the row.
  const verticalOffset = isOpponent
    ? { alignSelf: 'flex-start' as const }
    : { alignSelf: 'flex-end' as const, marginBottom: responsive.sectionGap * 2 }

  return (
    <div
      data-zone={isOpponent ? 'opponent-command' : 'player-command'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        minWidth: cardWidth + 16,
        ...verticalOffset,
      }}
    >
      {cards.map((card) => (
        <GameCard
          key={card.id}
          card={card}
          interactive={!isOpponent}
          overrideWidth={cardWidth}
          isOpponentCard={isOpponent}
          enableDragToCast={!isOpponent}
        />
      ))}
      <span
        style={{
          color: '#d4af37',
          fontSize: responsive.isMobile ? 8 : 10,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 600,
        }}
      >
        Command
      </span>
    </div>
  )
}
