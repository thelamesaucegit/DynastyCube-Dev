# Cubucks Economy System Guide

A comprehensive currency system for managing card drafts in Dynasty Cube.

## Overview

Cubucks is the draft currency that teams use to acquire cards from the pool. Each team has a budget, each card has a cost, and teams must manage their Cubucks wisely throughout the season.

### Key Features

- 💰 **Team Balances**: Each team has their own Cubucks wallet
- 🎴 **Card Costs**: Individual cards have different costs based on power level
- 📊 **Transaction History**: Complete audit trail of all Cubucks movements
- 🏆 **Seasons**: Track allocations and spending across different seasons
- 📈 **Statistics**: View earned vs spent totals for each team

## Database Schema

### Tables Created

#### `teams` (modified)
Added columns:
- `cubucks_balance` - Current available Cubucks
- `cubucks_total_earned` - Lifetime earnings
- `cubucks_total_spent` - Lifetime spending

#### `card_pools` (modified)
Added column:
- `cubucks_cost` - Cost in Cubucks to draft this card

#### `seasons` (new)
Tracks draft seasons/periods:
- `season_number` - Sequential season number
- `season_name` - Display name
- `start_date` / `end_date` - Season timeframe
- `cubucks_allocation` - Default Cubucks per team
- `is_active` - Only one season can be active

#### `cubucks_transactions` (new)
Complete audit log:
- `team_id` - Which team
- `transaction_type` - allocation | draft_pick | refund | adjustment
- `amount` - Positive (earn) or negative (spend)
- `balance_after` - Team balance after transaction
- `card_id` / `card_name` - If related to a card
- `description` - Human-readable description

#### `team_season_stats` (new)
Per-season team statistics:
- `starting_cubucks` - Allocation at season start
- `current_cubucks` - Current balance
- `cubucks_spent` - Total spent this season
- `cards_drafted` - Number of cards acquired

### Helper Functions

#### `allocate_cubucks_to_team()`
Safely adds Cubucks to a team's balance

```sql
SELECT allocate_cubucks_to_team(
  'ninja',        -- team_id
  1000,           -- amount
  NULL,           -- season_id (uses active)
  'Season 1 allocation',  -- description
  'admin-user-id' -- created_by
);
```

#### `spend_cubucks_on_draft()`
Spends Cubucks when drafting a card

```sql
SELECT spend_cubucks_on_draft(
  'ninja',           -- team_id
  50,                -- amount
  'card-id',         -- card_id
  'Lightning Bolt',  -- card_name
  'pick-uuid',       -- draft_pick_id
  NULL               -- season_id (uses active)
);
```

Automatically checks balance and prevents overdrafts!

## Setup Instructions

### 1. Run Database Migration

Execute `database/cubucks-system.sql` in Supabase SQL Editor.

This will:
- Add Cubucks columns to existing tables
- Create new tables (seasons, transactions, stats)
- Set up RLS policies
- Create helper functions
- Initialize Season 1
- Give all existing teams 1000 starting Cubucks

### 2. Verify Setup

Check that teams have their starting allocation:

```sql
SELECT name, cubucks_balance, cubucks_total_earned
FROM teams
ORDER BY name;
```

You should see all 8 teams with 1000 Cubucks each.

### 3. Access Admin Interface

Navigate to: `/admin` → 💰 Cubucks tab

## Admin Features

### Team Balance Management

**View All Balances**
- See current balance, total earned, total spent for each team
- Quick overview of the economy

**Add Cubucks to a Team**
1. Click "Add Cubucks" button next to team
2. Enter amount
3. Click checkmark to confirm
- Creates allocation transaction
- Updates team balance instantly

**Bulk Allocation**
- Give Cubucks to ALL teams at once
- Perfect for season starts or bonuses
- Enter amount → "Allocate to All Teams"

### Transaction History

- View last 20 transactions across all teams
- Filter by type (allocation, draft_pick, refund, adjustment)
- See which team, amount, balance after, and description
- Timestamp for each transaction

### Statistics Dashboard

- **Total in Circulation**: Sum of all team balances
- **Total Earned**: All-time Cubucks allocated
- **Total Spent**: All-time Cubucks used for drafts

## Team Features

### View Your Balance

Teams can see their Cubucks in two ways:

**Compact Display** (Navigation/Header):
```tsx
import { TeamCubucksDisplay } from "@/components/TeamCubucksDisplay";

<TeamCubucksDisplay teamId="ninja" compact={true} />
```

Shows a small badge with current balance.

**Full Display**:
```tsx
<TeamCubucksDisplay
  teamId="ninja"
  showTransactions={true}
/>
```

Shows:
- Large balance card with team emoji
- Total earned vs total spent
- Transaction history (collapsible)
- Info about using Cubucks

### Transaction History

Teams can view their own transactions:
- Allocations (money in)
- Draft picks (money out)
- Refunds (if applicable)
- Adjustments (admin corrections)

Each shows:
- Date/time
- Description
- Amount (+/-)
- Balance after

## Setting Card Costs

### Manual Pricing

Set cost for individual cards in the admin panel:

```tsx
import { setCardCost } from "@/app/actions/cubucksActions";

await setCardCost(cardId, 100); // 100 Cubucks
```

### Bulk Pricing

Set costs for multiple cards at once:

```tsx
import { setBulkCardCosts } from "@/app/actions/cubucksActions";

await setBulkCardCosts([
  { id: 'card1-uuid', cost: 50 },
  { id: 'card2-uuid', cost: 100 },
  { id: 'card3-uuid', cost: 150 },
]);
```

### Pricing Strategies

**By Rarity**:
- Mythic: 150-200 Cubucks
- Rare: 75-125 Cubucks
- Uncommon: 25-50 Cubucks
- Common: 10-20 Cubucks

**By EDHREC Rank** (if synced):
```sql
-- Price based on popularity
UPDATE card_pools
SET cubucks_cost = CASE
  WHEN edhrec_rank <= 100 THEN 200    -- Top 100
  WHEN edhrec_rank <= 500 THEN 150    -- Top 500
  WHEN edhrec_rank <= 1000 THEN 100   -- Top 1000
  WHEN edhrec_rank <= 5000 THEN 50    -- Top 5000
  ELSE 25                              -- Everything else
END
WHERE edhrec_rank IS NOT NULL;
```

**By Card Type**:
```sql
-- Premium pricing for lands
UPDATE card_pools
SET cubucks_cost = 150
WHERE card_type LIKE '%Land%' AND rarity = 'rare';
```

## Draft Integration

### When a Team Drafts a Card

The draft process should:

1. Check if team has enough Cubucks
2. Get card cost from `card_pools.cubucks_cost`
3. Call `spendCubucksOnDraft()` server action
4. If successful, add card to team's draft picks
5. Transaction automatically recorded

### Example Draft Flow

```tsx
// In your draft interface
import { spendCubucksOnDraft } from "@/app/actions/cubucksActions";
import { getTeamBalance } from "@/app/actions/cubucksActions";

async function handleDraftCard(cardId: string, cardName: string, cost: number) {
  // Check balance first
  const { team } = await getTeamBalance(teamId);

  if (!team || team.cubucks_balance < cost) {
    alert(`Insufficient Cubucks! You have ${team?.cubucks_balance || 0}, need ${cost}`);
    return;
  }

  // Spend the Cubucks
  const result = await spendCubucksOnDraft(
    teamId,
    cardId,
    cardName,
    cost
  );

  if (result.success) {
    // Add card to team_draft_picks table
    // Show success message
    // Refresh team balance display
  } else {
    alert(`Draft failed: ${result.error}`);
  }
}
```

### Preventing Overdrafts

The `spend_cubucks_on_draft()` function automatically checks balance:

```sql
IF v_current_balance < p_amount THEN
  RAISE EXCEPTION 'Insufficient Cubucks. Balance: %, Cost: %',
    v_current_balance, p_amount;
END IF;
```

The error is caught and returned to your UI.

## Season Management

### Create a New Season

```tsx
import { createSeason } from "@/app/actions/cubucksActions";

await createSeason(
  2,                    // season_number
  "Season 2",           // season_name
  1200                  // cubucks_allocation per team
);
```

### Activate a Season

```tsx
import { activateSeason } from "@/app/actions/cubucksActions";

await activateSeason(seasonId);
```

This:
- Deactivates all other seasons
- Activates the selected season
- New allocations/transactions use this season

### Season Allocations

When starting a new season:

1. Create the season
2. Activate it
3. Use bulk allocation to give teams their starting Cubucks
4. Teams can start drafting!

## API Reference

### Get Team Balance

```tsx
const { team, error } = await getTeamBalance(teamId);
// team: { id, name, emoji, cubucks_balance, cubucks_total_earned, cubucks_total_spent }
```

### Get All Team Balances

```tsx
const { teams, error } = await getTeamBalances();
// Array of all team balances
```

### Allocate Cubucks

```tsx
const { success, error } = await allocateCubucks(
  teamId,
  amount,
  description?
);
```

### Spend on Draft

```tsx
const { success, error } = await spendCubucksOnDraft(
  teamId,
  cardId,
  cardName,
  cost,
  draftPickId?
);
```

### Get Transactions

```tsx
// Team-specific
const { transactions, error } = await getTeamTransactions(teamId);

// All transactions (admin)
const { transactions, error } = await getAllTransactions();
```

### Set Card Costs

```tsx
// Single card
await setCardCost(cardId, cost);

// Multiple cards
await setBulkCardCosts([
  { id: cardId1, cost: 50 },
  { id: cardId2, cost: 100 },
]);
```

## Common Queries

### Check if Team Can Afford Card

```sql
SELECT
  t.name,
  t.cubucks_balance,
  c.card_name,
  c.cubucks_cost,
  (t.cubucks_balance >= c.cubucks_cost) as can_afford
FROM teams t, card_pools c
WHERE t.id = 'ninja' AND c.id = 'some-card-id';
```

### Top Spenders

```sql
SELECT name, emoji, cubucks_total_spent
FROM teams
ORDER BY cubucks_total_spent DESC
LIMIT 5;
```

### Cards Drafted by Cost

```sql
SELECT
  tdp.card_name,
  ct.amount as cost_paid,
  tdp.drafted_at
FROM team_draft_picks tdp
JOIN cubucks_transactions ct ON ct.card_id = tdp.card_id
WHERE tdp.team_id = 'ninja'
  AND ct.transaction_type = 'draft_pick'
ORDER BY ct.amount DESC;
```

### Season Spending Summary

```sql
SELECT
  t.name,
  SUM(CASE WHEN ct.transaction_type = 'allocation' THEN ct.amount ELSE 0 END) as earned,
  ABS(SUM(CASE WHEN ct.transaction_type = 'draft_pick' THEN ct.amount ELSE 0 END)) as spent,
  COUNT(CASE WHEN ct.transaction_type = 'draft_pick' THEN 1 END) as cards_drafted
FROM teams t
LEFT JOIN cubucks_transactions ct ON ct.team_id = t.id
WHERE ct.season_id = 'season-1-uuid'
GROUP BY t.id, t.name
ORDER BY spent DESC;
```

## Best Practices

### For Admins

1. **Set Costs Before Drafting**: Price all cards before the season starts
2. **Consistent Pricing**: Use a clear formula (rarity, EDHREC rank, etc.)
3. **Monitor Balances**: Check that no team is running out
4. **Document Adjustments**: Always add descriptions to manual allocations
5. **Season Planning**: Decide allocation amounts based on total card pool cost

### For Teams

1. **Budget Wisely**: Don't spend all Cubucks immediately
2. **Prioritize**: Focus on key cards for your strategy
3. **Track Spending**: Review transaction history regularly
4. **Plan Ahead**: Know what cards cost before drafting

### Pricing Guidelines

**Total Season Budget Example**:
- 8 teams × 1000 Cubucks = 8000 total
- Average card cost: 50 Cubucks
- Allows ~160 total card drafts
- ~20 cards per team

**Scarcity Creates Value**:
- Price power cards high to make choices meaningful
- Budget cards should be affordable for all
- Create trade-off decisions

## Troubleshooting

### Team Balance Doesn't Update

**Check**:
1. Transaction was successful (check `cubucks_transactions` table)
2. Refresh the page
3. Verify team_id matches

**Fix**:
```sql
-- Recalculate balance from transactions
UPDATE teams SET cubucks_balance = (
  SELECT COALESCE(SUM(amount), 0)
  FROM cubucks_transactions
  WHERE team_id = teams.id
)
WHERE id = 'team-id';
```

### Card Has No Cost

**Set default costs**:
```sql
-- Set all uncost cards to 25
UPDATE card_pools
SET cubucks_cost = 25
WHERE cubucks_cost = 0 OR cubucks_cost IS NULL;
```

### Negative Balance

**This shouldn't happen** due to the balance check in `spend_cubucks_on_draft()`.

If it does occur:
```sql
-- Find the problem
SELECT * FROM cubucks_transactions
WHERE team_id = 'team-id'
ORDER BY created_at;

-- Fix with adjustment
SELECT allocate_cubucks_to_team(
  'team-id',
  <amount-to-correct>,
  NULL,
  'Balance correction',
  'admin-id'
);
```

### Transaction Missing

Check RLS policies allow authenticated users to view:
```sql
SELECT * FROM cubucks_transactions
WHERE team_id = 'team-id'
ORDER BY created_at DESC
LIMIT 10;
```

## Future Enhancements

Possible additions:

- **Bonus Earnings**: Award Cubucks for wins, participation
- **Trading**: Allow teams to trade Cubucks
- **Interest**: Earn interest on unspent Cubucks
- **Loans**: Borrow against future allocations
- **Achievements**: Special one-time bonuses
- **Card Resale**: Sell drafted cards back for partial refund
- **Dynamic Pricing**: Card costs change based on demand

## Support

For issues or questions:
1. Check transaction history for audit trail
2. Verify RLS policies allow access
3. Review server action error messages
4. Check browser console for client errors

## Resources

- Database: `database/cubucks-system.sql`
- Actions: `src/app/actions/cubucksActions.ts`
- Admin UI: `src/app/components/admin/CubucksManagement.tsx`
- Team Display: `src/app/components/TeamCubucksDisplay.tsx`
