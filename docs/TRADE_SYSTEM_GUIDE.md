# Dynasty Cube Trade System

A comprehensive trading system for Dynasty Cube that allows teams to trade cards and future draft picks with notifications and admin controls.

## Features

### Core Trading
- ✅ Trade cards between teams
- ✅ Trade future draft picks (e.g., "2nd round pick in Season 3")
- ✅ Bi-directional trades (both teams can offer items)
- ✅ Trade deadlines (1-7 days in 24-hour increments)
- ✅ Trade statuses: pending, accepted, rejected, cancelled, expired

### Notifications
- ✅ Automatic notifications to Captains and Brokers
- ✅ Notification types: proposals, acceptances, rejections, messages, expirations
- ✅ Unread count tracking
- ✅ Notification bell icon in navigation (to be implemented)

### Messaging
- ✅ Built-in message system for each trade
- ✅ Negotiate terms before accepting
- ✅ Message history preserved

### Admin Controls
- ✅ Global enable/disable toggle for trades
- ✅ System settings table for configuration
- ✅ Easy admin panel integration

## Database Schema

### Tables Created

#### 1. `system_settings`
Global configuration for the trade system.
```sql
- setting_key (unique): 'trades_enabled'
- setting_value: 'true' or 'false'
- description: What the setting does
- updated_at, updated_by: Audit trail
```

#### 2. `trades`
Core trade proposals.
```sql
- id: UUID
- from_team_id: Team proposing the trade
- to_team_id: Team receiving the proposal
- status: pending | accepted | rejected | cancelled | expired
- deadline: When the trade offer expires
- created_by: User who created the trade
- created_at, updated_at, completed_at: Timestamps
```

#### 3. `trade_items`
Items being traded (cards or draft picks).
```sql
- id: UUID
- trade_id: Reference to trade
- offering_team_id: Which team is offering this item
- item_type: 'card' or 'draft_pick'

-- For cards:
- draft_pick_id: Reference to team_draft_picks
- card_id: Scryfall ID
- card_name: Card name

-- For draft picks:
- draft_pick_round: Round number (e.g., 2 for 2nd round)
- draft_pick_season_id: Which season the pick is for
```

#### 4. `trade_messages`
Messages and negotiations for trades.
```sql
- id: UUID
- trade_id: Reference to trade
- user_id: Who sent the message
- message: Message content
- created_at: When sent
```

#### 5. `notifications`
User notifications for trade activities.
```sql
- id: UUID
- user_id: Who receives the notification
- notification_type: trade_proposal | trade_accepted | trade_rejected | trade_message | trade_expired
- trade_id: Reference to trade
- message: Notification message
- is_read: Boolean
- created_at: When created
```

#### 6. `future_draft_picks`
Future draft picks that can be traded.
```sql
- id: UUID
- team_id: Current owner of the pick
- original_team_id: Original team that had the pick
- season_id: Which season
- round_number: Pick round (1st, 2nd, 3rd, etc.)
- is_traded: Boolean
- traded_to_team_id: If traded, who has it now
- trade_id: Which trade transferred it
```

### Helper Functions

#### `notify_team_roles(team_id, notification_type, trade_id, message)`
Sends notifications to all Captains and Brokers on a team.

#### `are_trades_enabled()`
Returns whether trades are currently enabled globally.

#### `expire_old_trades()`
Automatically expires trades past their deadline.
- Can be run as a cron job
- Marks trades as 'expired'
- Notifies both teams

#### `execute_trade(trade_id)`
Executes an accepted trade:
- Transfers card ownership
- Transfers future draft picks
- Marks trade as completed

### Views

#### `active_trades_view`
Shows active trades with team names and time remaining.
```sql
SELECT * FROM active_trades_view
WHERE from_team_id = 'team-id' OR to_team_id = 'team-id';
```

#### `notification_counts_view`
Shows unread and total notification counts per user.
```sql
SELECT * FROM notification_counts_view WHERE user_id = auth.uid();
```

## Server Actions

Location: `src/app/actions/tradeActions.ts`

### System Settings

```typescript
// Check if trades are enabled
const { enabled } = await areTradesEnabled();

// Enable/disable trades (admin only)
await setTradesEnabled(true);
```

### Creating Trades

```typescript
import { createTrade } from "@/app/actions/tradeActions";

// Create a trade proposal
const result = await createTrade(
  "from-team-id",
  "to-team-id",
  3, // 3 days deadline
  [
    // What fromTeam is offering
    {
      item_type: "card",
      draft_pick_id: "pick-uuid",
      card_id: "scryfall-id",
      card_name: "Lightning Bolt",
    },
  ],
  [
    // What toTeam is offering in return
    {
      item_type: "draft_pick",
      draft_pick_round: 2,
      draft_pick_season_id: "season-uuid",
    },
  ]
);
```

### Managing Trades

```typescript
// Get all trades for a team
const { trades } = await getTeamTrades(teamId);

// Get trade details with items
const { trade, items } = await getTradeDetails(tradeId);

// Accept a trade
await acceptTrade(tradeId);

// Reject a trade
await rejectTrade(tradeId);

// Cancel a trade (by proposer)
await cancelTrade(tradeId);
```

### Trade Messages

```typescript
// Add a message to a trade
await addTradeMessage(tradeId, "I'll accept if you add another card");

// Get all messages for a trade
const { messages } = await getTradeMessages(tradeId);
```

### Notifications

```typescript
// Get user's notifications
const { notifications, unreadCount } = await getUserNotifications();

// Mark notification as read
await markNotificationRead(notificationId);

// Mark all as read
await markAllNotificationsRead();
```

## Setup Instructions

### Step 1: Run the Migration

In Supabase SQL Editor:
```sql
-- Run the trades system migration
-- File: database/trades-system.sql
```

This will:
- Create all tables
- Set up Row Level Security policies
- Create helper functions
- Initialize system settings
- Create views for easy querying

### Step 2: Verify Setup

Check that trades are enabled:
```sql
SELECT * FROM system_settings WHERE setting_key = 'trades_enabled';
-- Should return: setting_value = 'true'
```

## UI Components (To Be Built)

### 1. Trade Creation Interface
Location: Will be at `/teams/[teamId]/trades/new`

Features:
- Select target team
- Add cards from your picks to offer
- Request cards from other team
- Add future draft picks to either side
- Set deadline (1-7 days slider)
- Review summary before proposing

### 2. Trade Proposals View
Location: Will be at `/teams/[teamId]/trades`

Features:
- List of incoming proposals (pending status)
- List of outgoing proposals
- Trade history (accepted/rejected/expired)
- Accept/Reject buttons
- Message system for each trade
- Time remaining until deadline

### 3. Notification System
Location: Navigation bar

Features:
- Bell icon with unread count badge
- Dropdown with recent notifications
- Click notification to go to trade
- Mark as read functionality
- "Mark all as read" button

### 4. Admin Controls
Location: `/admin` → Settings tab

Features:
- Toggle to enable/disable trades
- Status indicator (ON/OFF)
- Confirmation dialog for changes

## Trade Flow Example

### Scenario: Team A wants Lightning Bolt from Team B

1. **Team A Captain creates trade proposal:**
   - Offers: Their 2nd round pick in Season 2
   - Requests: Lightning Bolt from Team B
   - Deadline: 3 days

2. **System automatically:**
   - Creates trade record with status 'pending'
   - Notifies Team B's Captain and Broker
   - Notification appears in their nav bar

3. **Team B Broker views trade:**
   - Sees the proposal details
   - Sends message: "Can you add Counterspell too?"

4. **Team A receives notification:**
   - Reads message
   - Responds: "No, but I can do 1st round instead"

5. **Team A Captain updates trade:**
   - Cancels original trade
   - Creates new trade with 1st round pick

6. **Team B Captain accepts:**
   - Clicks "Accept Trade"
   - System executes trade:
     - Lightning Bolt moves to Team A's picks
     - Future 1st round pick moves to Team B
   - Both teams notified of completion

7. **Trade complete:**
   - Status changes to 'accepted'
   - Both teams see Lightning Bolt in their respective collections

## Security

### Row Level Security (RLS)

All tables have RLS enabled:

**Trades:**
- Users can only view trades where their team is involved
- Users can only create trades from their own team
- Users can update trades where their team is involved

**Trade Items:**
- Visible to members of both teams in the trade
- Can only be created by trade proposer

**Messages:**
- Visible to members of both teams
- Can only be created by team members involved in trade

**Notifications:**
- Users can only see their own notifications
- Users can only update their own notifications

**Future Draft Picks:**
- Viewable by everyone (public information)
- Can be created by authenticated users

## Best Practices

### For Users

1. **Communicate First**: Use the message system to negotiate before proposing
2. **Be Specific**: Clearly state what you want in trade messages
3. **Check Deadlines**: Respond to trades before they expire
4. **Review Carefully**: Double-check what you're offering and receiving

### For Admins

1. **Monitor Trade Activity**: Keep an eye on trade patterns
2. **Disable if Needed**: Use the toggle if trades become problematic
3. **Set Clear Rules**: Establish team guidelines for fair trading
4. **Run Expiration Check**: Consider setting up a cron job to run `SELECT expire_old_trades();` daily

### For Developers

1. **Always Check Trades Enabled**: Call `areTradesEnabled()` before trade operations
2. **Validate Items**: Ensure items exist and belong to offering team
3. **Handle Deadlines**: Respect trade deadlines in UI
4. **Test Notifications**: Verify Captains and Brokers receive notifications

## Future Enhancements

Possible additions:

- **Three-way trades**: Involve three teams in one trade
- **Trade counter-offers**: Auto-create counter instead of messages
- **Trade templates**: Save common trade structures
- **Trade history analytics**: Track trade patterns and values
- **Trade veto system**: Allow commissioners to veto trades
- **Trade review period**: 24-hour window for commissioner review
- **Public trade feed**: Show all completed trades to all teams
- **Trade value calculator**: Suggest fair trades based on card ratings

## Troubleshooting

### Trades Not Appearing

**Check:**
1. Is user's team involved in the trade?
2. Is the trade status 'pending' or 'accepted'?
3. Run: `SELECT * FROM trades WHERE from_team_id = 'team-id' OR to_team_id = 'team-id';`

### Notifications Not Showing

**Check:**
1. Is user a Captain or Broker on the team?
2. Run: `SELECT * FROM team_members WHERE user_id = auth.uid();`
3. Check notification function: `SELECT notify_team_roles('team-id', 'trade_proposal', 'trade-id', 'test');`

### Trade Won't Execute

**Check:**
1. Trade status must be 'accepted'
2. Items must still exist (not already traded)
3. Check error logs from `execute_trade()` function

### Expired Trades

**Auto-expire:**
```sql
-- Run manually or set up as cron job
SELECT expire_old_trades();
```

## API Reference

See `src/app/actions/tradeActions.ts` for complete TypeScript types and function signatures.

All functions return promises with consistent error handling:
```typescript
{
  success: boolean;
  error?: string;
  // ... additional data
}
```
