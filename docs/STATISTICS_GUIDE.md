# Dynasty Cube Statistics Guide

Comprehensive statistics tracking for teams, drafts, and decks to help you analyze your card pools and optimize deck building.

## Overview

The Dynasty Cube now includes detailed statistics for:
- **Team-wide statistics** - Overall draft performance and card distribution
- **Deck statistics** - Individual deck composition and mana curves
- **Draft analytics** - Historical picking patterns and trends

## Team Statistics

Access team statistics by navigating to a team page and clicking the **📊 Statistics** tab.

### Available Metrics

#### Overview Cards

1. **Total Cards** - Number of cards drafted by the team
2. **Total Decks** - Number of decks created
3. **Average CMC** - Average converted mana cost across all picks
4. **Recent Picks (7d)** - Cards drafted in the last 7 days

#### Color Distribution

Visual bar chart showing:
- Cards per color (W, U, B, R, G)
- Percentage of total pool
- Color emoji indicators
- Sorted by popularity

**Uses:**
- Identify color preferences
- Plan future drafts
- Balance color distribution

#### Card Type Distribution

Grid display showing:
- Count per card type (Creature, Instant, Sorcery, etc.)
- Percentage of total pool
- Organized by frequency

**Uses:**
- Balance spell/creature ratios
- Identify draft trends
- Plan deck archetypes

#### Mana Curve

Interactive bar chart showing:
- CMC distribution (0-10+)
- Card count per CMC
- Hover for percentages
- Visual curve representation

**Uses:**
- Assess deck speed
- Identify curve issues
- Plan mana base

#### Rarity Distribution

Color-coded cards showing:
- Common, Uncommon, Rare, Mythic counts
- Percentage breakdown
- Rarity-themed colors

**Uses:**
- Track valuable picks
- Balance power level
- Identify bomb cards

## Deck Statistics

Deck statistics appear automatically when viewing a deck in the Deck Builder.

### Quick Stats (Always Visible)

Located at the bottom of the deck view:

1. **Mainboard Count** - Total cards in mainboard
2. **Sideboard Count** - Total cards in sideboard
3. **Maybeboard Count** - Cards under consideration
4. **Average CMC** - Average mana cost (mainboard only)
5. **Colors** - Number of colors in the deck

### Mini Mana Curve

Compact visualization showing:
- CMC 0-7+ distribution
- Card counts per slot
- Mainboard cards only
- Instant visual feedback

**Uses:**
- Quick curve assessment
- Identify mana issues
- Balance card costs

## How to Use Statistics

### For Draft Planning

1. **Check color distribution** before drafting
2. **Review recent picks** to avoid duplicates
3. **Analyze type distribution** to identify needs
4. **Monitor average CMC** for curve balance

### For Deck Building

1. **Start with deck stats** to see current composition
2. **Use mana curve** to identify gaps
3. **Check color count** for mana base planning
4. **Monitor average CMC** for deck speed

### For Team Analysis

1. **Compare teams** via statistics tab
2. **Track drafting patterns** over time
3. **Identify power level** via rarity distribution
4. **Plan strategies** based on card pool

## Statistics Calculations

### Color Distribution
- Counts each color occurrence in card colors array
- Multi-color cards contribute to multiple colors
- Percentages based on total cards drafted

### Type Distribution
- Extracts first word of card_type field
- Groups similar types (Creature, Instant, etc.)
- Percentages based on total cards drafted

### Average CMC
- Sums all CMC values from picked cards
- Divides by total cards with CMC data
- Rounded to 2 decimal places

### Mana Curve
- Groups cards by CMC (0-10+)
- 10+ bucket includes all cards CMC 10 or higher
- Deck curves use mainboard only

### Rarity Distribution
- Counts by rarity: Common, Uncommon, Rare, Mythic
- Percentages based on total cards drafted
- Color-coded for visual clarity

## Tips & Best Practices

### Team Statistics

✅ **Do:**
- Check statistics before major drafts
- Use color distribution to guide picks
- Monitor recent picks to track activity
- Compare with other teams

❌ **Don't:**
- Ignore mana curve when planning
- Over-commit to single colors
- Draft without checking pool balance

### Deck Statistics

✅ **Do:**
- Aim for smooth mana curves
- Balance creature/spell ratios
- Keep average CMC appropriate for format
- Use sideboard for flex options

❌ **Don't:**
- Ignore average CMC warnings
- Build with too many colors
- Neglect low CMC cards
- Forget about curve gaps

## Advanced Analytics

### Color Identity Analysis

The deck builder tracks color identity:
- **0 colors** - Colorless
- **1 color** - Mono-colored
- **2 colors** - Two-color
- **3+ colors** - Multi-color

**Optimal ranges:**
- Limited/Draft: 1-2 colors
- Standard: 2-3 colors
- Commander: 3-5 colors

### Curve Optimization

**Ideal curves by format:**

**Draft/Limited:**
- CMC 1-2: 8-12 cards
- CMC 3-4: 10-14 cards
- CMC 5-6: 4-6 cards
- CMC 7+: 0-2 cards

**Standard:**
- CMC 1-2: 12-16 cards
- CMC 3-4: 12-16 cards
- CMC 5-6: 6-10 cards
- CMC 7+: 2-4 cards

### Type Balance

**Recommended ratios:**
- Creatures: 50-60% (14-17 in limited)
- Removal: 15-20% (4-6 in limited)
- Card Draw: 10-15% (3-4 in limited)
- Other: 15-20%

## Troubleshooting

### Statistics Not Loading

**Possible causes:**
1. Database tables not created
2. No draft picks recorded
3. Network issues

**Solutions:**
- Check database connection
- Verify draft picks exist
- Refresh the page
- Check browser console for errors

### Inaccurate Statistics

**Possible causes:**
1. Card data missing CMC/colors
2. Cache issues
3. Recent picks not synced

**Solutions:**
- Verify card data in database
- Refresh statistics
- Check data sources

### Performance Issues

For teams with 500+ cards:
- Statistics may take 2-3 seconds to load
- This is normal and expected
- Consider archiving old drafts

## Future Enhancements

Planned features:
- 📈 Historical trends over time
- 📊 Comparative team analytics
- 🎯 Draft pick recommendations
- 💹 Power level calculations
- 🏆 Win rate tracking (when implemented)
- 📅 Time-based statistics

## API Reference

### Server Actions

```typescript
// Get team statistics
const { stats, error } = await getTeamStatistics(teamId);

// Get deck statistics
const { stats, error } = await getDeckStatistics(deckId);

// Get all deck stats for a team
const { stats, error } = await getTeamDecksStatistics(teamId);
```

### Data Types

```typescript
interface TeamStatistics {
  totalCards: number;
  totalDecks: number;
  colorDistribution: { [color: string]: number };
  typeDistribution: { [type: string]: number };
  rarityDistribution: { [rarity: string]: number };
  averageCMC: number;
  cmcDistribution: { [cmc: string]: number };
  recentPicks: number;
}

interface DeckStatistics {
  deckId: string;
  deckName: string;
  totalCards: number;
  mainboardCount: number;
  sideboardCount: number;
  maybeboardCount: number;
  colorDistribution: { [color: string]: number };
  typeDistribution: { [type: string]: number };
  averageCMC: number;
  cmcDistribution: { [cmc: string]: number };
  colorIdentity: string[];
}
```

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
