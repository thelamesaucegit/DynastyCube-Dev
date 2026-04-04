# Dynasty Cube Scheduling System Guide

## Overview

The Dynasty Cube now has a comprehensive scheduling system that allows admins to:
- Create weekly schedules with deadlines
- Schedule matches between teams
- Track Best of 3 (Bo3) match results
- Manage deck list submissions
- Handle playoff and championship weeks

## Database Schema

### Core Tables

#### 1. **schedule_weeks**
Tracks each week of the season with deadlines.

```sql
- week_number: Sequential week number (1, 2, 3...)
- start_date: When the week begins
- end_date: When the week ends
- deck_submission_deadline: Deadline for deck submissions
- match_completion_deadline: Deadline for completing matches
- is_playoff_week: Flag for playoff rounds
- is_championship_week: Flag for championship match
```

#### 2. **matches**
Tracks scheduled matches between teams.

```sql
- home_team_id / away_team_id: Teams playing
- best_of: Number of games (3 for regular season, customizable for playoffs)
- status: scheduled | in_progress | completed | cancelled
- home_team_wins / away_team_wins: Current win count
- winner_team_id: Set automatically when match is decided
- home_team_confirmed / away_team_confirmed: Both teams must confirm results
```

#### 3. **match_games**
Tracks individual games within a match (e.g., Game 1, 2, 3 of a Bo3).

```sql
- game_number: 1, 2, or 3
- winner_team_id: Who won this game
- reported_by_team_id: Team that submitted the result
- confirmed_by_team_id: Opposing team that confirmed
- is_confirmed: True when both teams agree
```

#### 4. **deck_submissions**
Tracks deck lists submitted by teams for each week.

```sql
- deck_list: Card list (text format or JSON)
- version: Allows resubmissions before deadline
- is_current: Only one current submission per team/week
- confirmed_by_captain: Captain approval
```

#### 5. **deadlines**
Flexible deadline tracking for various types.

```sql
- deadline_type: deck_submission | match_completion | trade_window_close | etc.
- deadline_datetime: When the deadline occurs
- team_id: Optional team-specific deadline
- notification_sent: Track if notifications were sent
```

## Key Features

### Auto-Update Match Results
When a game result is confirmed, the system automatically:
1. Updates `home_team_wins` and `away_team_wins`
2. Determines the `winner_team_id` when one team reaches majority wins
3. Changes `status` to "completed" when match is decided
4. Sets `completed_at` timestamp

### Two-Step Result Confirmation
1. **Report**: One team reports a game result
2. **Confirm**: The opposing team confirms the result
3. Only confirmed results count toward match victory

This prevents disputes and ensures both teams agree on outcomes.

### Timezone-Aware Deadlines
All deadlines are stored in `timestamp with time zone` format and will be displayed in each user's timezone preference (from the timezone system you just implemented).

## Admin Workflows

### Creating a Weekly Schedule

```typescript
import { createScheduleWeek } from "@/app/actions/scheduleActions";

await createScheduleWeek({
  season_id: "current-season-uuid",
  week_number: 1,
  start_date: "2025-01-20T00:00:00Z",
  end_date: "2025-01-27T23:59:59Z",
  deck_submission_deadline: "2025-01-24T23:59:59Z",
  match_completion_deadline: "2025-01-27T23:59:59Z",
  is_playoff_week: false,
  is_championship_week: false,
  notes: "Regular season week 1"
});
```

### Scheduling a Match

```typescript
import { createMatch } from "@/app/actions/matchActions";

await createMatch({
  week_id: "week-uuid",
  home_team_id: "team1-uuid",
  away_team_id: "team2-uuid",
  best_of: 3 // Best of 3 for regular season
});
```

### Championship Setup

For championship matches, you can set `best_of` to any number:

```typescript
await createMatch({
  week_id: "championship-week-uuid",
  home_team_id: "finalist1-uuid",
  away_team_id: "finalist2-uuid",
  best_of: 5 // Best of 5 for championship
});
```

## Team Workflows

### Reporting Match Results

Teams can report game results after playing:

```typescript
import { reportMatchGame } from "@/app/actions/matchActions";

// Report Game 1 result
await reportMatchGame({
  match_id: "match-uuid",
  game_number: 1,
  winner_team_id: "winning-team-uuid",
  reported_by_team_id: "my-team-uuid",
  duration_minutes: 35,
  notes: "Close game, great match!"
});
```

### Confirming Opponent's Report

The opposing team must confirm:

```typescript
import { confirmMatchGame } from "@/app/actions/matchActions";

await confirmMatchGame({
  game_id: "game-uuid",
  confirmed_by_team_id: "my-team-uuid"
});
```

### Submitting Deck Lists

*(To be implemented in deck submission actions)*

Teams submit their deck before the deadline:
- Can resubmit before deadline (creates new version)
- Only the current version is used
- Captain can review and confirm

## Server Actions Reference

### Schedule Actions (`src/app/actions/scheduleActions.ts`)

- `getScheduleWeeks(seasonId)` - Get all weeks for a season
- `getCurrentWeek(seasonId)` - Get the current week based on date
- `createScheduleWeek(weekData)` - Create a new week (admin)
- `updateScheduleWeek(weekId, updates)` - Update a week (admin)
- `deleteScheduleWeek(weekId)` - Delete a week (admin)
- `getUpcomingDeadlines()` - Get deadlines for current user's teams

### Match Actions (`src/app/actions/matchActions.ts`)

- `getWeekMatches(weekId)` - Get all matches for a week
- `getTeamMatches(teamId)` - Get all matches for a team
- `createMatch(matchData)` - Create a new match (admin)
- `getMatchGames(matchId)` - Get all games in a match
- `reportMatchGame(gameData)` - Report a game result (team member)
- `confirmMatchGame(gameData)` - Confirm opponent's result (team member)
- `getMatchDetails(matchId)` - Get full match info with games
- `confirmMatch(matchData)` - Confirm entire match result (team)

## Security (RLS Policies)

### What Admins Can Do:
- Create, update, delete schedule weeks
- Create, update, delete matches
- View all data

### What Team Members Can Do:
- View all public schedule and match data
- Report game results for their own team's matches
- Confirm game results reported by opponents
- Submit and update deck lists for their team
- View their team's deck submissions

### What Everyone Can Do:
- View schedule weeks
- View matches
- View deadlines
- View public match results

## Next Steps

### UI Components Needed:

1. **Admin Schedule Manager** (`/admin/schedule`)
   - Week creator with date pickers
   - Match scheduler with team dropdowns
   - Bulk match creation for round-robin
   - Deadline editor

2. **Team Match Recorder** (`/teams/[teamId]/matches`)
   - List of team's matches
   - Game-by-game result submission
   - Confirmation interface for opponent results
   - Match history

3. **Public Schedule Page** (`/schedule`)
   - Calendar view or list view
   - Upcoming matches
   - Match results
   - Standings table

4. **Deadline Dashboard**
   - Upcoming deadlines widget
   - Countdown timers
   - Submit deck button when deadline approaches
   - Notifications for approaching deadlines

### Integration Points:

1. **Notifications**
   - Notify teams when match is scheduled
   - Remind teams of upcoming deadlines
   - Alert when opponent reports a result (needs confirmation)
   - Notify when match is fully confirmed

2. **Season Phase Integration**
   - Automatically advance to playoffs when regular season ends
   - Lock deck submissions after deadline
   - Prevent match result changes after confirmation

3. **Statistics**
   - Team records (wins/losses)
   - Head-to-head records
   - Average game duration
   - Submission compliance (deck deadlines met)

## Database Migration

Run this SQL file in your Supabase SQL editor:

```
database/schedule-and-matches-system.sql
```

This will create all necessary tables, indexes, RLS policies, and triggers.

## Example Season Flow

### Week 1: Regular Season
1. Admin creates Week 1 schedule (Jan 20-27)
2. Admin schedules matches: Team A vs B, Team C vs D
3. Deadline: Submit decks by Jan 24
4. Teams submit their deck lists
5. Teams play their Bo3 matches
6. Teams report results game-by-game
7. Opposing teams confirm each game
8. Match auto-completes when 2 games are won
9. Both teams confirm final match result
10. Deadline: Complete matches by Jan 27

### Week 8: Playoff Semi-Finals
1. Admin creates Week 8 as playoff week
2. Admin schedules semi-final matches (top 4 teams)
3. Same process as regular season
4. Winners advance to championship

### Week 9: Championship
1. Admin creates Week 9 as championship week
2. Admin schedules championship match (Best of 5)
3. Championship match uses `best_of: 5`
4. First team to 3 wins takes the championship

## Tips & Best Practices

1. **Set Realistic Deadlines**
   - Deck submissions: 3-4 days into the week
   - Match completion: End of week
   - Leave buffer time for timezone differences

2. **Communicate Early**
   - Announce schedule weeks in advance
   - Send reminders before deadlines
   - Notify teams immediately when matches are scheduled

3. **Handle Disputes**
   - If teams can't agree on a result, admin can manually update
   - Admins have full control over match_games table
   - Document any admin interventions in `admin_notes`

4. **Playoff Structure**
   - Use `is_playoff_week` flag for special handling
   - Championship week can have different Best-of number
   - Consider byes for top-seeded teams

5. **Deck Submission Versions**
   - Allow multiple submissions before deadline
   - Only `is_current: true` version is valid
   - Archive old versions for history

## Troubleshooting

### Match not auto-completing?
- Check if all games have `is_confirmed: true`
- Verify trigger `update_match_wins()` is enabled
- Check match `best_of` setting

### Can't report game result?
- Verify user is a team member
- Check if game number already reported
- Ensure match is not cancelled

### Deadline not showing?
- Verify `deadline_datetime` is in the future
- Check `team_id` filtering (null = all teams)
- Confirm user is on a team

## Support

For issues or questions about the scheduling system, check:
1. Database logs in Supabase
2. Server action error returns
3. RLS policy violations in Supabase logs
4. This documentation for workflow examples
