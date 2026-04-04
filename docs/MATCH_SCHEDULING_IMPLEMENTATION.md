# Match Scheduling System Implementation Guide

## Overview

This document describes the match scheduling system that allows:
1. **Admins** to set up weekly schedules with start/end dates and deadlines
2. **Admins** to schedule matches between teams for specific weeks
3. **Pilots and Captains** to propose and confirm specific match times within their team's scheduled matches
4. **Admins** to grant extensions for match deadlines

## Components Created

### 1. Database Migration
**File:** `database/match-time-scheduling.sql`

Adds the following to the database:
- New fields to `matches` table:
  - `scheduled_datetime`: The confirmed date/time teams will play
  - `scheduled_by_user_id`: Who scheduled it
  - `scheduled_confirmed`: Whether both teams agreed
  - `extension_granted`: Whether admin granted an extension
  - `extension_reason`: Why the extension was granted
  - `extended_deadline`: New deadline if extension granted

- New table `match_time_proposals`:
  - Stores proposals from teams before confirmation
  - Tracks status (pending, accepted, rejected, expired, cancelled)
  - Includes proposal and response messages

**To apply:** Run this SQL file in your Supabase SQL editor.

### 2. Server Actions
**File:** `src/app/actions/matchSchedulingActions.ts`

Functions for managing match scheduling:
- `getTeamMatchesNeedingScheduling()`: Get matches that need time coordination
- `getMatchProposals()`: Get all time proposals for a match
- `createMatchTimeProposal()`: Pilot/Captain proposes a match time
- `respondToProposal()`: Pilot/Captain accepts or rejects a proposal
- `cancelProposal()`: Original proposer cancels their proposal
- `grantMatchExtension()`: Admin grants deadline extension
- `revokeMatchExtension()`: Admin revokes extension

### 3. Team Match Scheduling Widget
**File:** `src/app/components/team/MatchSchedulingWidget.tsx`

A component for team pages that allows Pilots and Captains to:
- View upcoming matches that need scheduling
- See proposals from the opposing team
- Accept or reject opponent proposals
- Propose new match times
- View confirmed match times
- See extension information

### 4. Admin Extension Manager
**File:** `src/app/components/admin/MatchExtensionManager.tsx`

A component for the admin panel that allows admins to:
- Select a week and view all scheduled matches
- Grant extensions with custom deadlines and reasons
- Revoke previously granted extensions
- See which matches have extensions

## Integration Steps

### Step 1: Apply Database Migration

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/match-time-scheduling.sql`
4. Execute the SQL

### Step 2: Add Match Scheduling to Team Pages

Find your team detail page (likely `src/app/teams/[teamId]/page.tsx`) and:

```typescript
import { MatchSchedulingWidget } from "@/components/team/MatchSchedulingWidget";

// In your component, after checking user roles:
const userRoles = // ... get user's roles on this team

// Add to your page JSX:
<MatchSchedulingWidget teamId={teamId} userRoles={userRoles} />
```

**Note:** The widget automatically hides if the user is not a Pilot or Captain.

### Step 3: Add Extension Manager to Admin Panel

Update the admin schedule management (likely in `src/app/components/admin/ScheduleOverview.tsx` or create a new tab):

```typescript
import { MatchExtensionManager } from "@/components/admin/MatchExtensionManager";

// Add as a new tab or section:
<MatchExtensionManager seasonId={activeSeason.id} />
```

You might want to add this as a fourth tab in the schedule section of `SeasonManagement.tsx`:

```typescript
// In ScheduleTabContent component, add a new button:
<button
  onClick={() => setScheduleTab("extensions")}
  className={...}
>
  ⏰ Extensions
</button>

// And in the content section:
{scheduleTab === "extensions" && <MatchExtensionManager seasonId={seasonId} />}
```

## How It Works

### Workflow for Teams

1. **Admin creates a week** with start/end dates and deadlines
2. **Admin schedules a match** between Team A and Team B for that week
3. **Pilot/Captain from Team A** goes to their team page and sees the match in the scheduling widget
4. **Team A proposes a time**: "Friday, Jan 25 at 7:00 PM - How about this time?"
5. **Pilot/Captain from Team B** sees the proposal on their team page
6. **Team B can:**
   - Accept the proposal → Match time is confirmed
   - Reject and propose alternative → New proposal sent back
   - Counter with different time

7. Once accepted, both teams see the confirmed match time
8. If teams can't agree in time, **admin can grant an extension** with a new deadline

### Workflow for Admins

1. Navigate to Admin Panel → Seasons → Schedule → Extensions tab
2. Select the week to manage
3. View all matches for that week
4. Click "Grant Extension" on any match
5. Set new deadline and provide reason
6. Teams will see the extension notice on their pages
7. Can revoke extensions if needed

## Database Triggers

The system includes automatic triggers:

1. **When a proposal is accepted:**
   - Updates the match with confirmed scheduled_datetime
   - Marks all other pending proposals for that match as expired

2. **Auto-updates:**
   - `updated_at` timestamps are automatically maintained

## Permissions (RLS Policies)

- **Team members** can only see proposals for their own matches
- **Only Pilots and Captains** can create proposals
- **Only Pilots and Captains** can respond to proposals
- **Users can cancel** their own pending proposals
- **Admins** have full control over all proposals and extensions

## User Experience Features

### For Pilots/Captains:
- ✅ Clear visual distinction between your proposals and opponent proposals
- ✅ One-click accept/reject with optional response messages
- ✅ See scheduled times once confirmed
- ✅ View extension information if granted
- ✅ Can propose multiple times if previous rejected

### For Admins:
- ✅ Week-by-week view of all matches
- ✅ Visual indicators for matches with extensions
- ✅ Easy extension granting with date picker
- ✅ Can revoke extensions if needed
- ✅ See extension reasons for each match

## Testing Checklist

### Database
- [ ] Migration applied successfully
- [ ] Tables created with correct schema
- [ ] RLS policies are working
- [ ] Triggers are functioning

### Team Scheduling Widget
- [ ] Widget shows only for Pilots/Captains
- [ ] Can see upcoming matches
- [ ] Can propose match times
- [ ] Can accept opponent proposals
- [ ] Can reject opponent proposals
- [ ] Can cancel own proposals
- [ ] Scheduled time displays correctly
- [ ] Extension notices display correctly

### Admin Extension Manager
- [ ] Can select weeks
- [ ] Can see all matches for week
- [ ] Can grant extensions
- [ ] Can revoke extensions
- [ ] Extension reasons save correctly
- [ ] UI updates after granting/revoking

## Future Enhancements (Optional)

1. **Notifications:**
   - Send notification when opponent proposes a time
   - Remind teams if no time scheduled near deadline
   - Alert when extension is granted

2. **Calendar Integration:**
   - Export scheduled matches to Google Calendar
   - Show all scheduled matches in a calendar view

3. **Timezone Support:**
   - Use user's timezone preference for display
   - Store all times in UTC

4. **Proposal History:**
   - Show full negotiation history
   - Allow reviewing past proposals

5. **Automatic Reminders:**
   - Send reminder 24 hours before scheduled match
   - Alert if match time passes without result reported

## Troubleshooting

### Widget not showing
- Ensure user is a Pilot or Captain (check `team_member_roles` table)
- Verify component is imported correctly
- Check console for errors

### Proposals not working
- Verify database migration applied
- Check RLS policies are enabled
- Ensure user authentication is working

### Extensions not saving
- Verify admin status in database
- Check server action errors in console
- Ensure date/time formats are correct

## Support

For issues or questions:
1. Check console for error messages
2. Verify database migrations are applied
3. Check RLS policies in Supabase dashboard
4. Review server action responses for error details
