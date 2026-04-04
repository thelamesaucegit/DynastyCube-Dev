# Dynamic Pricing System Guide

A self-adjusting card pricing system where costs change based on draft popularity.

## How It Works

### The Rules

1. **Starting Cost**: Every card begins at **1 Cubuck**
2. **If Drafted**: Cost increases by **+1 Cubuck** next season
3. **If NOT Drafted**: Cost decreases by **-1 Cubuck** next season (minimum 1)
4. **Result**: Popular cards become expensive, unpopular cards stay cheap!

### Example

```
Season 1: Lightning Bolt costs 1 Cubuck
  → Gets drafted by 3 teams

Season 2: Lightning Bolt now costs 2 Cubucks
  → Gets drafted by 2 teams

Season 3: Lightning Bolt now costs 3 Cubucks
  → Nobody drafts it (too expensive!)

Season 4: Lightning Bolt drops to 2 Cubucks
  → Gets drafted again
```

### Why This Is Great

- **Self-Balancing**: Powerful cards naturally become expensive
- **Market-Driven**: Prices reflect actual demand, not arbitrary ratings
- **Budget Cards**: Niche cards stay affordable
- **Strategic Depth**: Teams must decide between power and value
- **Dynamic Meta**: The draft meta shifts each season

## Database Schema

### New Tables

#### `card_season_costs`
Tracks card costs per season:
```sql
- card_pool_id: Which card
- season_id: Which season
- cost: Current cost this season
- was_drafted: Whether drafted at least once
- times_drafted: How many times drafted
```

### Key Functions

#### `initialize_season_card_costs()`
Sets all cards to 1 Cubuck for current season
- Use for Season 1 only
- Overwrites existing costs

#### `rollover_card_costs_for_new_season()`
Calculates new costs based on previous season
- Looks at each card
- If drafted → cost +1
- If not drafted → cost -1 (min 1)
- Updates `card_season_costs` and `card_pools`

#### `mark_card_drafted()`
Records that a card was drafted
- Called automatically when `spend_cubucks_on_draft()` is used
- Updates `was_drafted` and `times_drafted`

### New View

#### `card_pricing_history`
See all cost changes across seasons:
```sql
SELECT * FROM card_pricing_history
WHERE card_name = 'Lightning Bolt'
ORDER BY season_number;
```

## Setup Instructions

### Step 1: Run Both Migrations

First, run the base Cubucks system:
```sql
-- In Supabase SQL Editor:
database/cubucks-system.sql
```

Then, run the dynamic pricing extension:
```sql
-- In Supabase SQL Editor:
database/cubucks-dynamic-pricing.sql
```

This will:
- Create `card_season_costs` table
- Add helper functions
- Initialize Season 1 with all cards at 1 Cubuck

### Step 2: Verify Setup

Check that all cards cost 1 Cubuck:
```sql
SELECT card_name, cubucks_cost
FROM card_pools
LIMIT 10;
-- Should all show: cubucks_cost = 1
```

Check season costs tracking:
```sql
SELECT COUNT(*) as total_cards,
       AVG(cost) as avg_cost
FROM card_season_costs;
-- Should show: total_cards = (your card count), avg_cost = 1
```

## Season Workflow

### Season 1: First Season

1. Run migrations (done above)
2. All cards start at 1 Cubuck
3. Teams draft cards throughout the season
4. System tracks which cards get drafted

### Season 2+: Rollover Process

When starting a new season:

#### 1. Create the New Season
```tsx
// In admin panel → Seasons tab
- Season Number: 2
- Season Name: "Season 2"
- Cubucks Allocation: 1000
→ Click "Create Season"
```

#### 2. Activate the New Season
```tsx
// In the seasons list
→ Click "Activate" on Season 2
```

#### 3. Rollover Card Costs
```tsx
// Click the big "Rollover Card Costs" button
// This will:
// - Look at Season 1 draft data
// - Calculate new costs for Season 2
// - Show you a detailed report
```

The rollover shows you:
- Which cards increased in cost (were drafted)
- Which cards decreased in cost (not drafted)
- Which cards stayed at 1 Cubuck (already at minimum)

#### 4. Allocate Cubucks to Teams
```tsx
// In admin panel → Cubucks tab
→ Click "Allocate to All Teams" (1000 Cubucks)
```

#### 5. Start Drafting!
Teams can now draft cards at their new costs.

## Admin Features

### Season Management Tab

Located at `/admin` → 🗓️ Seasons

**Features**:
- Create new seasons
- Activate seasons
- Rollover card costs
- Initialize costs (Season 1 only)
- View all seasons

**Rollover Card Costs**:
- Click the button
- See detailed report of all cost changes
- Shows: old cost → new cost, whether drafted
- Color-coded: red = increase, green = decrease

**Initialize All Cards**:
- Sets every card to 1 Cubuck
- Only use for Season 1
- Confirmation required

### Card Cost Tracking

Each card tracks:
- **Current Cost**: In `card_pools.cubucks_cost`
- **Season History**: In `card_season_costs`
- **Draft Status**: `was_drafted` and `times_drafted`

## Queries

### View Cost Changes

```sql
-- See which cards increased in cost
SELECT
  cp.card_name,
  csc1.cost as season_1_cost,
  csc2.cost as season_2_cost,
  csc2.cost - csc1.cost as change
FROM card_pools cp
JOIN card_season_costs csc1 ON cp.id = csc1.card_pool_id
JOIN card_season_costs csc2 ON cp.id = csc2.card_pool_id
WHERE csc1.season_id = 'season-1-uuid'
  AND csc2.season_id = 'season-2-uuid'
ORDER BY change DESC
LIMIT 20;
```

### Most Expensive Cards

```sql
SELECT card_name, cubucks_cost
FROM card_pools
ORDER BY cubucks_cost DESC
LIMIT 20;
```

### Most Popular Cards (Current Season)

```sql
SELECT
  cp.card_name,
  csc.times_drafted,
  csc.cost as current_cost
FROM card_pools cp
JOIN card_season_costs csc ON cp.id = csc.card_pool_id
WHERE csc.season_id = (SELECT id FROM seasons WHERE is_active = true)
ORDER BY csc.times_drafted DESC
LIMIT 20;
```

### Cards That Have Never Been Drafted

```sql
SELECT card_name, cubucks_cost
FROM card_pools
WHERE id NOT IN (
  SELECT DISTINCT card_pool_id
  FROM card_season_costs
  WHERE was_drafted = true
)
ORDER BY card_name;
```

### Card Pricing History

```sql
-- See cost evolution for a specific card
SELECT
  season_number,
  season_name,
  cost,
  was_drafted,
  times_drafted
FROM card_pricing_history
WHERE card_name = 'Lightning Bolt'
ORDER BY season_number;
```

### Season Summary

```sql
-- Stats for current season
SELECT
  COUNT(*) as total_cards,
  COUNT(CASE WHEN was_drafted THEN 1 END) as drafted_cards,
  COUNT(CASE WHEN NOT was_drafted THEN 1 END) as undrafted_cards,
  AVG(cost) as avg_cost,
  MAX(cost) as max_cost,
  MIN(cost) as min_cost
FROM card_season_costs
WHERE season_id = (SELECT id FROM seasons WHERE is_active = true);
```

## Integration with Drafting

When a team drafts a card, your draft interface should:

### 1. Get Current Cost
```tsx
import { getCardPool } from "@/app/actions/cardActions";

const { cards } = await getCardPool();
const card = cards.find(c => c.id === cardId);
const cost = card.cubucks_cost; // Current season cost
```

### 2. Check Team Balance
```tsx
import { getTeamBalance } from "@/app/actions/cubucksActions";

const { team } = await getTeamBalance(teamId);
if (team.cubucks_balance < cost) {
  alert(`Need ${cost} Cubucks, you have ${team.cubucks_balance}`);
  return;
}
```

### 3. Spend Cubucks (This Marks Card as Drafted!)
```tsx
import { spendCubucksOnDraft } from "@/app/actions/cubucksActions";

const result = await spendCubucksOnDraft(
  teamId,
  card.card_id,
  card.card_name,
  cost,
  card.id,      // ← cardPoolId - IMPORTANT for tracking!
  draftPickId   // ← Optional: team_draft_picks.id
);

if (result.success) {
  // Card is now marked as drafted for this season
  // Next season it will cost +1 Cubuck
  // Add to team_draft_picks table
  // Update UI
}
```

**IMPORTANT**: Pass the `card.id` (from `card_pools`) as the 5th parameter. This allows the system to track that this card was drafted and adjust its cost next season.

## Strategy Implications

### For Teams

**Early Season**:
- Draft power cards while they're cheap
- Stock up on staples

**Mid Season**:
- Popular cards are getting expensive
- Look for undervalued cards

**Late Season**:
- High-cost cards might be good value if nobody else drafted them
- They'll decrease in cost next season

**Budget Building**:
- Target cards that haven't been drafted recently
- They'll be at minimum cost (1 Cubuck)
- Build around "sleeper" cards

### For Admins

**Monitoring**:
- Watch which cards spike in cost
- Identify meta trends
- See which cards never get drafted (might need buffing/removing)

**Adjusting Allocations**:
- If average costs climb too high, increase Cubucks allocation
- If everyone has leftover Cubucks, decrease allocation

**Meta Health**:
- A healthy meta has variety in costs (1-10+ Cubucks)
- If all cards cluster around same cost, it means meta is solved
- Consider card pool rotation to shake things up

## Troubleshooting

### Card Cost Didn't Change After Rollover

**Check**:
1. Was the card marked as drafted?
   ```sql
   SELECT * FROM card_season_costs
   WHERE card_pool_id = 'card-uuid'
     AND season_id = 'old-season-uuid';
   ```
2. Did rollover function run successfully?
3. Was `card_pool_id` passed to `spendCubucksOnDraft()`?

**Fix**:
```sql
-- Manually mark as drafted
SELECT mark_card_drafted('card-pool-uuid', 'season-uuid');
```

### All Cards Still at 1 Cubuck After Rollover

**Likely cause**: No cards were marked as drafted in previous season

**Fix**:
1. Check that draft picks are calling `spendCubucksOnDraft()` with `card_pool_id`
2. Manually update if needed:
   ```sql
   UPDATE card_season_costs
   SET was_drafted = true
   WHERE card_pool_id IN (
     SELECT DISTINCT card_pool_id
     FROM team_draft_picks
   );
   ```

### Rollover Shows No Changes

**Check active season**:
```sql
SELECT * FROM seasons WHERE is_active = true;
```

**Ensure previous season exists**:
```sql
SELECT * FROM seasons ORDER BY season_number;
```

### Card Cost Different Than Expected

**Check history**:
```sql
SELECT * FROM card_pricing_history
WHERE card_name = 'CardName';
```

Shows full cost evolution across all seasons.

## Best Practices

### For Season Transitions

1. ✅ **End Season Clearly**: Announce when drafting ends
2. ✅ **Review Draft Data**: Check which cards were popular
3. ✅ **Create New Season**: Set it up before activating
4. ✅ **Run Rollover**: Calculate new costs
5. ✅ **Review Changes**: Look at the rollover report
6. ✅ **Allocate Cubucks**: Give teams their starting budget
7. ✅ **Announce**: Tell teams about cost changes

### For Pricing Health

- **Monitor extremes**: Cards shouldn't hit 20+ Cubucks (too expensive)
- **Check minimums**: Many cards at 1 Cubuck = healthy variety
- **Track meta**: If same cards drafted every season, consider changes
- **Adjust allocations**: Match total pool cost to avoid too much/too little spending

### For Development

When integrating drafts:
```tsx
// Always include card_pool_id!
await spendCubucksOnDraft(
  teamId,
  cardScryfall Id,
  cardName,
  cost,
  cardPoolId,  // ← Don't forget this!
  draftPickId
);
```

## Future Enhancements

Possible additions:

- **Dynamic allocation**: Base Cubucks on average card cost
- **Hot/cold indicators**: Show which cards are trending
- **Price predictions**: Forecast next season costs
- **Draft windows**: Different costs for different parts of season
- **Multipliers**: Events that affect pricing (2x cost increase, etc.)
- **Card retirement**: Remove cards that hit certain thresholds

## Resources

- Database: `database/cubucks-dynamic-pricing.sql`
- Actions: `src/app/actions/seasonActions.ts`
- Admin UI: `src/app/components/admin/SeasonManagement.tsx`
- Base System: `CUBUCKS_SYSTEM_GUIDE.md`
