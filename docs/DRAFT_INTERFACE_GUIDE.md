# Draft Interface Guide

The Draft Interface allows teams to select cards from the shared card pool and add them to their collection.

## Features

### 🎯 Card Selection
- Browse all available cards from the pool
- Visual card display with images
- Hover over cards to see "Draft Card" button
- One-click to add to your team's picks
- Automatic pick numbering (tracks draft order)

### 🔍 Search & Filters

#### Search by Name
- Type any part of a card name to filter results
- Real-time search results

#### Color Filter
- Filter by color: White (⚪), Blue (🔵), Black (⚫), Red (🔴), Green (🟢)
- "Colorless" option for artifacts and lands
- "All Colors" to show everything

#### Type Filter
- Creature
- Instant
- Sorcery
- Enchantment
- Artifact
- Planeswalker
- Land
- All Types (default)

### ✓ Visual Feedback

#### Already Drafted Cards
- Cards your team has already drafted show a green "✓ DRAFTED" badge
- Slightly faded appearance to distinguish from available cards
- Cannot be drafted again

#### Draft Progress
- Blue info box at top shows how many cards your team has picked
- Running count of total picks

#### Success/Error Messages
- Green success banner when you draft a card
- Red error banner if something goes wrong
- Messages auto-dismiss after 3 seconds

## How to Use

### 1. Navigate to Team Page
From your account page or the teams list:
```
/teams/[your-team-id]
```

### 2. Go to Draft Tab
Click the "🎯 Draft Cards" tab (first tab by default)

### 3. Browse Available Cards
- Scroll through the grid of available cards
- Use search and filters to find specific cards
- Check the result count to see how many cards match your filters

### 4. Draft a Card
1. Hover over a card you want
2. Click the "Draft Card" button that appears
3. Wait for confirmation
4. Card will be added to your "Draft Picks" tab

### 5. View Your Picks
- Switch to "🎴 Draft Picks" tab
- See all cards your team has drafted
- Cards are displayed in grid format

## Example Workflow

### Building a Red Aggro Deck

1. **Filter by Color**: Click "🔴 Red"
2. **Filter by Type**: Select "Creature" from dropdown
3. **Search**: Type "goblin" to find goblin creatures
4. **Draft**: Hover and click "Draft Card" on each goblin you want
5. **Verify**: Switch to "Draft Picks" tab to see your collection
6. **Repeat**: Go back to draft more cards of different types

### Building a Control Deck

1. **Filter Blue Cards**: Click "🔵 Blue"
2. **Filter Instants**: Select "Instant"
3. **Draft Counterspells**: Pick your counter magic
4. **Filter Sorceries**: Switch to "Sorcery"
5. **Draft Card Draw**: Pick your draw spells
6. **Add Finishers**: Search for win conditions
7. **Draft Lands**: Filter "Land" and pick dual lands

## Tips

### Strategic Drafting
- **Plan ahead**: Think about what deck you want to build
- **Balance colors**: Don't draft too many colors (2-3 is usually good)
- **Curve out**: Draft creatures at various mana costs
- **Don't forget lands**: Make sure to draft enough mana sources
- **Removal matters**: Draft ways to deal with opponent threats

### Using Filters Effectively
- **Start broad**: Use "All Colors" to see everything first
- **Narrow down**: Apply filters as you decide on a strategy
- **Combine filters**: Use color + type together for precise results
- **Search for synergy**: Look for cards that work well together

### Team Coordination
- Check what your teammates have drafted
- Avoid overlap if possible
- Build decks that complement each other
- Share strong cards across different strategies

## Technical Details

### Data Storage
- Drafted cards are stored in `team_draft_picks` table
- Each pick has a unique `pick_number` to track draft order
- Cards remain in the global pool (multiple teams can draft the same card)

### Pick Tracking
- Pick numbers start at 1
- Auto-increments with each new pick
- Displayed when viewing draft picks (not in draft interface)

### Real-time Updates
- Draft picks update immediately when you draft a card
- Other tabs (Picks, Decks) refresh automatically
- No need to reload the page

## Keyboard Shortcuts

Currently no keyboard shortcuts, but you can:
- Use Tab to navigate between filter options
- Use Enter to submit search
- Click anywhere to focus and type

## Troubleshooting

### "Card already drafted" error
- You've already picked this card
- Look for the green "DRAFTED" badge
- Switch to another card

### Cards not loading
- Check that cards exist in the `card_pools` table
- Verify database connection
- Check browser console for errors

### Draft button not appearing
- Make sure you're hovering directly over the card
- Card might already be drafted (check for badge)
- Try refreshing the page

## Future Enhancements

Potential features to add:
- **Undo last pick**: Remove a card from your picks
- **Wishlist**: Mark cards you want to draft later
- **Draft history**: See all picks in chronological order
- **Recommendations**: AI-suggested cards based on your picks
- **Live draft mode**: Real-time drafting with other teams
- **Draft timer**: Timed picks for competitive drafting
- **Export picks**: Download your draft picks as a list

---

**Happy Drafting!** Build your perfect deck and dominate the competition! 🎴✨
