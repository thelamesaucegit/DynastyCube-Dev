# Dynasty Cube - Production Database Schema

## Overview

This directory contains the complete production-ready database schema for Dynasty Cube, a collaborative Magic: The Gathering draft format management system.

## Quick Start

### Deploying to Production

1. **Open Supabase SQL Editor**
   - Navigate to your Supabase project
   - Go to SQL Editor

2. **Run the Production Schema**
   ```sql
   -- Copy and paste the entire contents of production-schema.sql
   -- Then execute the script
   ```

3. **Set Admin Users**
   ```sql
   UPDATE public.users
   SET is_admin = true
   WHERE email = 'your@email.com';
   ```

4. **Verify Installation**
   - Check that all 28 tables were created
   - Verify RLS policies are enabled
   - Test authentication flow

## Schema Contents

### Statistics
- **31 Tables** - Complete data structure
- **76 RLS Policies** - Comprehensive security rules
- **85 Indexes** - Performance optimization
- **20 Functions** - Business logic helpers
- **8 Views** - Complex query simplification
- **15 Triggers** - Automated updates
- **17 Sections** - Organized schema structure

### Main Features

#### 1. User & Team Management
- User profiles with Discord OAuth integration
- 8 default teams with emojis and mottos
- Team membership tracking
- Role-based permissions (Captain, Broker, Historian, Pilot)

#### 2. Card & Draft System
- Card pool management
- Draft pick tracking
- Deck building with multiple categories
- CMC (Converted Mana Cost) and rating tracking

#### 3. Cubucks Economy
- Virtual currency system
- Transaction logging
- Team balance tracking
- Allocation and spending functions

#### 4. Trading System
- Trade proposals between teams
- Card and draft pick trading
- Trade messaging
- Status tracking (pending, accepted, rejected)

#### 5. Messaging & Notifications
- User-to-user messaging
- System notifications
- Trade notifications
- Admin announcements

#### 6. Reports System
- Bug reports
- Issue tracking
- Bad actor reports
- Admin review workflow

#### 7. Schedule & Matches
- Weekly scheduling
- Match tracking
- Best-of-3 game results
- Winner determination

#### 8. Seasons & Phases
- Season management
- Phase transitions (preseason, season, playoffs, postseason)
- User notifications on phase changes

#### 9. Admin News
- Public news posts
- Publish/unpublish workflow
- Display on home page

#### 10. Community Voting
- Poll creation and management
- Single or multiple choice voting
- Time-based poll expiration
- Real-time results display
- Secure voting with user authentication

## Security (RLS Policies)

All tables have Row Level Security enabled with the following patterns:

### Public Data
- **Teams, Cards, Matches**: Everyone can SELECT, only admins can modify
- Ensures transparency while preventing unauthorized changes

### User-Owned Data
- **Messages, Notifications**: Users can SELECT their own, admins see all
- **Decks, Draft Picks**: Team members can manage, others can view
- Protects personal data while allowing team collaboration

### Sensitive Data
- **Reports, System Settings**: Only admins have full access
- **User Roles**: Admin-only management
- Prevents privilege escalation

### Admin Check
Uses `is_admin()` function that checks the `public.users.is_admin` field:
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((
    SELECT is_admin
    FROM public.users
    WHERE id = auth.uid()
  ), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Database Structure

### Core Tables
1. `public.users` - Extended user profiles
2. `teams` - Team information
3. `team_members` - Team membership
4. `team_member_roles` - Role assignments
5. `team_role_history` - Role change audit log

### Card System
6. `card_pools` - Available cards
7. `team_draft_picks` - Drafted cards
8. `team_decks` - Deck definitions
9. `deck_cards` - Cards in decks

### Economy
10. `seasons` - Season tracking
11. `cubucks_transactions` - Transaction log
12. `system_settings` - Global settings

### Trading
13. `trades` - Trade proposals
14. `trade_items` - Items being traded
15. `trade_messages` - Trade discussion

### Communication
16. `messages` - User messages
17. `notifications` - System notifications

### Moderation
18. `reports` - User-submitted reports

### Schedule
19. `schedule_weeks` - Weekly schedules
20. `matches` - Match tracking
21. `games` - Individual game results
22. `deadlines` - Important dates

### Admin
23. `admin_news` - Public announcements

## Key Functions

### Admin Functions
- `is_admin()` - Check if current user is admin
- `allocate_cubucks_to_team(team_id, amount, reason)` - Add Cubucks
- `spend_cubucks_on_draft(team_id, amount, card_name)` - Spend Cubucks

### Season Functions
- `get_active_season()` - Get current season
- `update_season_phase(season_id, new_phase)` - Change phase

### Trade Functions
- `are_trades_enabled()` - Check if trading is enabled
- `execute_trade(trade_id)` - Transfer items on acceptance

### Messaging Functions
- `send_message(from_id, to_id, subject, body)` - Send with notification

## Views

### Helpful Views
1. `team_members_with_roles` - Members with their roles
2. `deck_stats` - Deck statistics
3. `active_trades_view` - Active trades with team info
4. `notification_counts_view` - Unread notification counts
5. `message_counts_view` - Unread message counts
6. `pending_reports_view` - Active reports by severity
7. `current_season_info` - Current season details

## Performance Optimization

### Indexes
The schema includes 76 strategic indexes on:
- Foreign keys for efficient joins
- Frequently queried columns (team_id, user_id, status)
- Date columns for time-based queries
- Email and username for lookups
- Array columns using GIN indexes

### Triggers
Automated triggers for:
- User profile creation on signup
- Timestamp updates (`updated_at`)
- Match win calculations
- Report status updates
- Season phase transitions

## Initial Data

The schema automatically creates:
- 8 default teams with unique identities
- Season 1 (active)
- 1000 Cubucks for each team
- System settings (trades enabled by default)
- Backfills existing auth users into public.users

## Maintenance

### Regular Tasks
1. **Monitor RLS Policies** - Ensure security rules are working
2. **Review Indexes** - Add new indexes as query patterns emerge
3. **Audit Logs** - Check role and transaction history
4. **Backup Data** - Regular database backups

### Troubleshooting

#### RLS Policy Issues
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- View policies for a table
SELECT * FROM pg_policies
WHERE tablename = 'your_table_name';
```

#### Performance Issues
```sql
-- Find slow queries
SELECT * FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

## Development Files

The `/database` directory contains development SQL files for incremental changes:
- `schema.sql` - Original base schema
- `draft-schema.sql` - Draft system additions
- `cubucks-system.sql` - Economy system
- `trades-system.sql` - Trading features
- `messaging-and-reports.sql` - Communication features
- Other `fix-*.sql` files - Historical bug fixes

**For production deployment, use `production-schema.sql` only.**

## Support

For issues or questions:
1. Check the [Claude Code documentation](https://claude.com/claude-code)
2. Review existing GitHub issues
3. Create a new issue with detailed information

## License

This schema is part of the Dynasty Cube project.
