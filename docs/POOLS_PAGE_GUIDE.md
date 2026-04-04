# Card Pools Page Guide

The Pools page provides a comprehensive view of all cards available in the Dynasty Cube draft pool, showing draft status and team ownership at a glance.

## Features Overview

### 📊 Pool Statistics

At the top of the page, you'll find four key statistics:

1. **Total Cards** - Total number of cards in the pool
2. **Available** - Cards that haven't been drafted yet (green)
3. **Drafted** - Cards that have been picked (orange)
4. **Completion** - Percentage of the pool that has been drafted (purple)

### 🔍 Advanced Filtering

Four powerful filter options to find exactly what you're looking for:

#### 1. Search Filter
- Type any card name to filter instantly
- Case-insensitive search
- Real-time results

#### 2. Status Filter
- **All Cards** - Show everything in the pool
- **Available** - Only cards that can still be drafted
- **Drafted** - Only cards that have been picked

#### 3. Color Filter
- Filter by MTG color identity
- ☀️ White
- 💧 Blue
- 💀 Black
- 🔥 Red
- 🌲 Green
- All Colors (default)

#### 4. Type Filter
- Filter by card type
- Creature, Instant, Sorcery, etc.
- Dynamically populated from pool

### 🎴 Card Grid Display

Cards are displayed in a responsive grid that adapts to your screen size:
- **Mobile**: 2 columns
- **Tablet**: 3 columns
- **Desktop**: 4-5 columns
- **Large screens**: 5-6 columns

#### Card Visual States

**Available Cards:**
- Full color, vibrant display
- Blue border on hover
- Shadow effect on hover
- Clean, clear imagery

**Drafted Cards:**
- Reduced opacity (60%)
- Gray borders
- "DRAFTED" badge with team emoji
- Hover to see more details

### 🏷️ Draft Status Indicators

#### Drafted Badge
When a card has been drafted:
- **Position**: Top-right corner
- **Display**: Team emoji + "DRAFTED" text
- **Background**: Dark semi-transparent
- **Visibility**: Always visible

#### Hover Information
Hover over any card to see:
- Card name (bold)
- Card type
- Set name
- **If drafted:**
  - Team emoji and name
  - Date drafted

## Usage Examples

### Finding Available Cards

1. Navigate to the **Pools** page from the main navigation
2. Set **Status** filter to "Available"
3. Browse cards that are still up for grabs

### Checking Team Progress

1. Filter by **Status**: "Drafted"
2. Hover over cards to see which team drafted them
3. View draft dates to see picking patterns

### Building a Strategy

1. Filter by **Color** to see what's available in your colors
2. Filter by **Type** to find specific effects
3. Use **Search** to locate specific cards

### Monitoring the Draft

1. Check the **Completion** percentage
2. See how many cards are **Available** vs **Drafted**
3. Filter by teams to see who's picking what

## Visual Design

### Color Scheme

**Available Cards:**
- Natural MTG card colors
- Blue accent on hover (#3B82F6)
- Bright, inviting appearance

**Drafted Cards:**
- Desaturated appearance
- Gray borders (#9CA3AF)
- Lower opacity (60%)

**Team Badges:**
- Dark background (rgba(17, 24, 39, 0.9))
- White text
- Team emoji for quick identification

### Responsive Breakpoints

```
2xl (1536px+):  6 columns
xl (1280px+):   5 columns
lg (1024px+):   4 columns
md (768px+):    3 columns
sm (640px+):    2 columns
mobile:         2 columns
```

## Data Updates

### Real-Time Sync

The pools page data is fetched on load and includes:
- Current draft status for all cards
- Team ownership information
- Draft timestamps

### Refresh Behavior

To see updated draft status:
1. Refresh the page (F5)
2. Navigate away and back
3. Filter changes trigger re-render

## Performance

### Optimization Features

1. **Client-side filtering** - Instant results, no server calls
2. **Lazy image loading** - Fast initial page load
3. **Efficient rendering** - Only visible cards are processed
4. **Responsive grid** - Adapts to screen size

### Loading States

**Initial Load:**
- Spinner animation
- "Loading card pool..." message
- Smooth transition to content

**Error States:**
- Red error box
- Clear error message
- Retry instructions

## Integration

### Server Actions

The pools page uses these server actions from `poolActions.ts`:

```typescript
// Get all cards with draft status
getPoolCardsWithStatus(poolName?: string)

// Get pool statistics
getPoolStatistics(poolName?: string)

// Get available pool names
getAvailablePools()
```

### Data Structure

```typescript
interface PoolCard {
  id: string;
  card_id: string;
  card_name: string;
  card_set?: string;
  card_type?: string;
  rarity?: string;
  colors?: string[];
  image_url?: string;
  pool_name: string;
  created_at: string;

  // Draft status
  is_drafted: boolean;
  drafted_by_team?: {
    id: string;
    name: string;
    emoji: string;
  };
  drafted_at?: string;
}
```

## Tips & Best Practices

### For Draft Participants

✅ **Do:**
- Check available cards before your pick
- Filter by your preferred colors
- Note which teams are drafting similar strategies
- Keep an eye on completion percentage

❌ **Don't:**
- Assume page auto-refreshes (it doesn't)
- Forget to check multiple color options
- Ignore draft patterns from other teams

### For Administrators

✅ **Do:**
- Monitor draft completion regularly
- Check for stalled drafts
- Verify card data is correct
- Use filters to audit draft fairness

❌ **Don't:**
- Delete cards mid-draft
- Change pool names after drafting starts
- Forget to populate card images

## Troubleshooting

### Cards Not Showing

**Possible causes:**
1. No cards in the pool
2. Filters too restrictive
3. Database connection issue

**Solutions:**
- Reset all filters
- Check "Showing X of Y cards" count
- Verify pool name
- Check browser console

### Draft Status Not Updating

**Possible causes:**
1. Page not refreshed
2. Cache issues
3. Database sync delay

**Solutions:**
- Hard refresh (Ctrl+F5)
- Clear browser cache
- Wait 30 seconds and refresh
- Check server logs

### Images Not Loading

**Possible causes:**
1. Scryfall API down
2. Image URLs incorrect
3. Network issues

**Solutions:**
- Check image URL validity
- Verify Scryfall service status
- Refresh page
- Check network tab in DevTools

## Future Enhancements

Planned features for future releases:

- 🔄 Auto-refresh draft status
- 📱 Mobile app integration
- 💾 Export pool to CSV/JSON
- 🎨 Custom card image providers
- 📊 Pool analytics
- 🔔 Notifications when cards are drafted
- 🏆 Most drafted cards ranking
- 📈 Draft velocity tracking

## API Reference

### Server Actions

#### getPoolCardsWithStatus
```typescript
const { cards, error } = await getPoolCardsWithStatus("default");
```
Returns all cards in the specified pool with draft status.

#### getPoolStatistics
```typescript
const { stats, error } = await getPoolStatistics("default");
```
Returns statistics for the specified pool.

#### getAvailablePools
```typescript
const { pools, error } = await getAvailablePools();
```
Returns list of all available pool names.

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
