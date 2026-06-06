export const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    // --- THE FIX: Explicitly define the 5 vertical zones ---
    // Row 1: Opponent Hand (shrink-to-fit)
    // Row 2: Opponent Battlefield (takes remaining space)
    // Row 3: Center HUD (shrink-to-fit)
    // Row 4: Player Battlefield (takes remaining space)
    // Row 5: Player Hand (shrink-to-fit)
    gridTemplateRows: 'auto minmax(0, 1fr) auto minmax(0, 1fr) auto',
    gridTemplateColumns: '100%',
    backgroundColor: '#0a0a15',
    overflow: 'hidden',
  },
  
  // --- NEW: Grid wrappers for the Hands ---
  opponentHandArea: {
    gridRow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    zIndex: 50,
    minHeight: 0, 
  },
  playerHandArea: {
    gridRow: 5,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '100%',
    zIndex: 50,
    minHeight: 0, 
  },

  opponentArea: {
    gridRow: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // Push the opponent's battlefield down towards the center HUD
    justifyContent: 'flex-end', 
    minHeight: 0, 
    overflow: 'hidden',
    width: '100%',
    position: 'relative', // Context for the name label
  },
  centerArea: {
    gridRow: 3,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'center',
    padding: '2px 8px',
    columnGap: 16,
    width: '100%',
    overflow: 'hidden',
    zIndex: 100, 
  },
  playerArea: {
    gridRow: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // Push the player's battlefield up towards the center HUD
    justifyContent: 'flex-start', 
    minHeight: 0, 
    overflow: 'hidden',
    width: '100%',
    position: 'relative', // Context for the name label
  },
  
  // ... leave the rest of your styles unchanged
