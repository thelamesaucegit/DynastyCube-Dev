# Team Roles System Guide

The Team Roles system provides a comprehensive role-based access control (RBAC) framework for managing team member permissions and responsibilities in Dynasty Cube.

## Overview

Each team can have members assigned to specific roles, with each role granting different permissions and responsibilities. Multiple members can have the same role, and one member can have multiple roles simultaneously.

## The Four Team Roles

### 👑 Captain
**Full administrative control over the team**

**Permissions:**
- Assign and remove all team roles
- Add and remove team members
- Make all final decisions for the team
- Access to all team management features

**Responsibilities:**
- Lead team strategy and direction
- Manage team member permissions
- Resolve conflicts and disputes
- Coordinate team activities

**Use Case:** Team leaders, primary decision-makers

---

### 🤝 Broker
**Handles draft picks and trades**

**Permissions:**
- Make draft selections for the team
- Initiate and complete trades with other teams
- Manage the team's card pool

**Responsibilities:**
- Execute draft strategy
- Negotiate trades with other teams
- Build and maintain card collection
- Track card values and availability

**Use Case:** Draft strategists, trade negotiators, collection managers

---

### 📜 Historian
**Records and maintains team history**

**Permissions:**
- Document match results
- Maintain team records
- Access historical data

**Responsibilities:**
- Record match outcomes and statistics
- Write team narratives and stories
- Maintain accurate team records
- Track team achievements and milestones

**Use Case:** Record keepers, storytellers, statisticians

---

### ⚔️ Pilot
**Plays matches with team decks**

**Permissions:**
- Represent team in competitive matches
- Use team's constructed decks
- Report match results

**Responsibilities:**
- Play matches against other teams
- Use team decks effectively
- Report accurate match results
- Provide feedback on deck performance

**Use Case:** Competitive players, deck testers

## Using the Team Roles Page

### Accessing the Roles Tab

1. Navigate to your team page: `/teams/[teamId]`
2. Click the **👑 Team Roles** tab in the navigation bar
3. View role descriptions and current assignments

### Viewing Role Descriptions

At the top of the page, you'll see a grid displaying all four roles with:
- Role emoji and name
- Detailed description of responsibilities
- Permissions granted by the role

### Viewing Team Members

The main section displays all team members with:
- **User email**
- **"You" badge** if viewing your own account
- **Current role badges** with role emoji and name
- **"No roles assigned"** text if member has no roles

### Assigning Roles (Captains Only)

**Requirements:**
- You must be a team captain
- Captain role cannot be assigned to yourself (must be assigned by another captain or admin)

**Steps:**
1. Click **"Manage Roles"** button next to the member
2. Role assignment panel appears with all four roles
3. Click a role button to assign it to the member
4. Button turns green with a checkmark (✓) when role is assigned
5. Success message appears: "{Role} role assigned successfully!"
6. Page refreshes to show updated roles

### Removing Roles (Captains Only)

**Steps:**
1. Click **"Manage Roles"** button next to the member
2. Click an already-assigned role (green with checkmark)
3. Role is removed from the member
4. Success message appears: "{Role} role removed successfully!"
5. Page refreshes to show updated roles

### Your Roles Summary

At the bottom of the page, if you have any roles assigned, you'll see:
- **"Your Team Roles"** section with gradient background
- Cards displaying each of your roles
- Role emoji, name, and description
- This section only appears if you have at least one role

## Technical Implementation

### Database Schema

**Tables:**

#### `team_member_roles`
Stores current role assignments
```sql
CREATE TABLE team_member_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(team_member_id, role)
);
```

#### `team_role_history`
Audit log of all role changes
```sql
CREATE TABLE team_role_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  action text NOT NULL CHECK (action IN ('assigned', 'removed')),
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamp with time zone DEFAULT now(),
  notes text
);
```

**View:**

#### `team_members_with_roles`
Convenient view showing members with their roles
```sql
CREATE OR REPLACE VIEW team_members_with_roles AS
SELECT
  tm.id as member_id,
  tm.user_id,
  tm.user_email,
  tm.team_id,
  tm.joined_at,
  COALESCE(
    ARRAY_AGG(tmr.role ORDER BY tmr.role) FILTER (WHERE tmr.role IS NOT NULL),
    ARRAY[]::text[]
  ) as roles,
  COALESCE(
    ARRAY_AGG(tmr.assigned_at ORDER BY tmr.role) FILTER (WHERE tmr.assigned_at IS NOT NULL),
    ARRAY[]::timestamp with time zone[]
  ) as role_assigned_dates
FROM team_members tm
LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
GROUP BY tm.id, tm.user_id, tm.user_email, tm.team_id, tm.joined_at;
```

**Helper Functions:**

#### `user_has_team_role(user_id, team_id, role)`
Check if a specific user has a role on a team
```sql
CREATE OR REPLACE FUNCTION user_has_team_role(
  p_user_id uuid,
  p_team_id text,
  p_role text
) RETURNS boolean
```

#### `get_user_team_roles(user_id, team_id)`
Get all roles for a user on a team
```sql
CREATE OR REPLACE FUNCTION get_user_team_roles(
  p_user_id uuid,
  p_team_id text
) RETURNS text[]
```

### Server Actions

Located in `src/app/actions/roleActions.ts`

#### `getTeamMembersWithRoles(teamId)`
```typescript
const { members, error } = await getTeamMembersWithRoles(teamId);
```
Returns all team members with their assigned roles.

#### `assignRoleToMember(teamMemberId, role, notes?)`
```typescript
const { success, error } = await assignRoleToMember(memberId, 'captain', 'Promoted to captain');
```
Assigns a role to a team member. Creates audit log entry.

#### `removeRoleFromMember(teamMemberId, role, notes?)`
```typescript
const { success, error } = await removeRoleFromMember(memberId, 'broker');
```
Removes a role from a team member. Creates audit log entry.

#### `userHasTeamRole(userId, teamId, role)`
```typescript
const { hasRole, error } = await userHasTeamRole(userId, teamId, 'captain');
```
Checks if a user has a specific role on a team.

#### `getUserTeamRoles(userId, teamId)`
```typescript
const { roles, error } = await getUserTeamRoles(userId, teamId);
// roles = ['captain', 'broker']
```
Returns array of all roles for a user on a team.

#### `getTeamRoleHistory(teamId, limit?)`
```typescript
const { history, error } = await getTeamRoleHistory(teamId, 50);
```
Returns role change history for audit purposes.

#### `assignMultipleRoles(teamMemberId, roles[], notes?)`
```typescript
const { success, error } = await assignMultipleRoles(
  memberId,
  ['broker', 'pilot'],
  'Initial role assignment'
);
```
Bulk assign multiple roles at once.

#### Helper Functions
```typescript
getRoleDescription(role: TeamRole): string  // Get role description text
getRoleEmoji(role: TeamRole): string        // Get role emoji
getRoleDisplayName(role: TeamRole): string  // Get formatted role name
```

### TypeScript Types

```typescript
// Available team roles
export type TeamRole = "captain" | "broker" | "historian" | "pilot";

// Team member with roles data
export interface TeamMemberWithRoles {
  member_id: string;
  user_id: string;
  user_email: string;
  team_id: string;
  joined_at: string;
  roles: TeamRole[];
  role_assigned_dates: string[];
}

// Role history entry
export interface RoleHistoryEntry {
  id: string;
  team_member_id: string;
  role: TeamRole;
  action: "assigned" | "removed";
  performed_by: string;
  performed_at: string;
  notes?: string;
}
```

### React Component

**`TeamRoles.tsx`** - Main role management component

**Props:**
```typescript
interface TeamRolesProps {
  teamId: string;
}
```

**Features:**
- Displays role descriptions
- Shows permission notice for non-captains
- Lists all team members with current roles
- Provides role assignment UI for captains
- Shows "Your Roles" summary
- Success/error message handling

**Usage:**
```tsx
import { TeamRoles } from "@/app/components/TeamRoles";

<TeamRoles teamId="ninja" />
```

## Setup Instructions

### 1. Run Database Schema

Execute the SQL file in Supabase SQL Editor:

**File:** `database/team-roles-schema.sql`

This creates:
- ✅ `team_member_roles` table
- ✅ `team_role_history` table
- ✅ `team_members_with_roles` view
- ✅ `user_has_team_role()` function
- ✅ `get_user_team_roles()` function
- ✅ Row Level Security policies

**Verification:**
```sql
-- Check tables exist
SELECT * FROM team_member_roles LIMIT 1;
SELECT * FROM team_role_history LIMIT 1;

-- Check view works
SELECT * FROM team_members_with_roles;

-- Test functions
SELECT user_has_team_role('user-uuid', 'team-id', 'captain');
SELECT get_user_team_roles('user-uuid', 'team-id');
```

### 2. Verify Imports

The team page should have:
```typescript
import { TeamRoles } from "@/app/components/TeamRoles";
```

### 3. Check Tab Configuration

Ensure "roles" tab is in the tabs array:
```typescript
type TabType = "picks" | "decks" | "members" | "draft" | "stats" | "roles";

const tabs = [
  // ... other tabs
  { id: "roles" as TabType, label: "👑 Team Roles", count: undefined },
];
```

### 4. Verify Tab Content

Check the roles tab content is added:
```typescript
{activeTab === "roles" && (
  <div>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Team Roles & Permissions
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Manage team member roles and responsibilities
      </p>
    </div>
    <TeamRoles teamId={teamId} />
  </div>
)}
```

## Permission System

### Current Implementation

**Viewing Roles:**
- ✅ All users can view role descriptions
- ✅ All users can see team member role assignments
- ✅ All users can see their own roles

**Managing Roles:**
- ✅ Only team captains can assign roles
- ✅ Only team captains can remove roles
- ✅ Non-captains see a permission notice

**Audit Logging:**
- ✅ All role changes are logged to `team_role_history`
- ✅ Logs include: who, what, when, and optional notes
- ✅ Both assignments and removals are tracked

### Future Enhancements

**Role-Based Feature Access:**
```typescript
// Check if user can draft (broker role)
const { hasRole } = await userHasTeamRole(userId, teamId, 'broker');
if (hasRole) {
  // Allow draft pick
}

// Check if user can report matches (pilot role)
const { hasRole } = await userHasTeamRole(userId, teamId, 'pilot');
if (hasRole) {
  // Allow match result submission
}
```

**Middleware Protection:**
```typescript
// Protect draft endpoints
if (!await userHasTeamRole(userId, teamId, 'broker')) {
  return { error: 'Only brokers can make draft picks' };
}
```

## Common Workflows

### Initial Team Setup

1. **First Captain Assignment** (Admin/System)
   ```typescript
   await assignRoleToMember(founderMemberId, 'captain', 'Team founder');
   ```

2. **Captain Assigns Other Roles**
   - Navigate to Team Roles tab
   - Click "Manage Roles" for each member
   - Assign appropriate roles
   - Optionally assign multiple roles to same person

### Adding a New Team Member

1. Member joins the team (via invite/signup)
2. Captain navigates to Team Roles tab
3. New member appears in member list (no roles)
4. Captain clicks "Manage Roles" → assigns initial roles
5. Member can now see their roles in "Your Roles" section

### Changing Role Assignments

1. Captain decides to change member responsibilities
2. Navigate to Team Roles tab
3. Click "Manage Roles" for the member
4. Remove old role (click green button)
5. Assign new role (click gray button)
6. Both changes logged in `team_role_history`

### Viewing Role History (Future)

```typescript
const { history } = await getTeamRoleHistory(teamId, 100);
// Display timeline of role changes
```

## Troubleshooting

### "Only team captains can assign or remove roles" Message

**Cause:** Current user is not assigned captain role

**Solutions:**
1. Ask your team captain to assign you captain role
2. Have an admin run SQL to assign captain:
   ```sql
   INSERT INTO team_member_roles (team_member_id, role)
   VALUES ('member-uuid', 'captain');
   ```
3. Check your roles in "Your Roles" section at bottom

### Role Assignment Not Working

**Possible Causes:**
1. Database schema not set up
2. RLS policies blocking changes
3. Team member ID incorrect
4. Network/connection issue

**Solutions:**
1. Verify schema exists:
   ```sql
   SELECT * FROM team_member_roles LIMIT 1;
   ```
2. Check RLS policies are enabled and correct
3. Check browser console for errors
4. Verify user is authenticated
5. Try refreshing the page

### Roles Not Appearing After Assignment

**Possible Causes:**
1. Page not refreshed
2. Database not syncing
3. View not updating

**Solutions:**
1. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. Navigate away and back to the page
3. Check database directly:
   ```sql
   SELECT * FROM team_members_with_roles WHERE team_id = 'your-team-id';
   ```
4. Clear browser cache

### Database Errors

**Error: `relation "team_member_roles" does not exist`**
- **Cause:** Schema not created
- **Fix:** Run `database/team-roles-schema.sql` in Supabase

**Error: `function user_has_team_role does not exist`**
- **Cause:** Helper functions not created
- **Fix:** Run complete schema file, not just tables

**Error: `permission denied for table team_member_roles`**
- **Cause:** RLS policies not configured
- **Fix:** Run RLS policy section of schema file

### UI Issues

**"Manage Roles" button not visible**
- **Cause:** Current user is not a captain
- **Expected behavior:** Button only shows for captains
- **Fix:** Get captain role assigned

**Success messages not appearing**
- **Cause:** State update timing
- **Fix:** Check browser console, messages auto-hide after 3 seconds

**Component not loading**
- **Cause:** Import path incorrect or component build failed
- **Fix:** Check import statement, run `npm run dev`, check for TypeScript errors

## Best Practices

### For Team Captains

✅ **Do:**
- Assign roles based on member skills and interests
- Give multiple roles to active members
- Document role changes with notes when using bulk operations
- Regularly review and update role assignments
- Communicate role changes to team members

❌ **Don't:**
- Assign captain role to everyone (dilutes authority)
- Remove all captains (need at least one)
- Assign roles without member's knowledge
- Use roles as punishment or reward

### For Developers

✅ **Do:**
- Use `userHasTeamRole()` for permission checks
- Log all role changes to history table
- Handle errors gracefully with user-friendly messages
- Use TypeScript types for type safety
- Check role assignments before allowing protected actions

❌ **Don't:**
- Hard-code role checks in multiple places (use functions)
- Skip audit logging
- Allow role escalation without proper checks
- Trust client-side role checks (always verify server-side)

### For Administrators

✅ **Do:**
- Assign initial captains when creating teams
- Monitor role change history for suspicious activity
- Back up role assignments before major changes
- Document custom role permission logic

❌ **Don't:**
- Directly modify database without using server actions
- Delete role history records (audit trail)
- Change role names (breaks enum constraints)
- Disable RLS policies in production

## Future Enhancements

### Planned Features

- 🔒 **Role-based route protection** - Middleware guards for sensitive pages
- 📊 **Role activity dashboard** - Track actions by role
- 🔔 **Role change notifications** - Alert members when roles change
- 📜 **Role history timeline** - Visual timeline of role changes
- 🎭 **Custom roles** - Allow teams to define custom roles
- 👥 **Role templates** - Pre-defined role sets for common team structures
- 🔄 **Role rotation** - Automated role rotation for shared responsibilities
- 📝 **Role descriptions editor** - Allow captains to customize role descriptions

### Extension Points

```typescript
// Custom permission checks
export async function canUserDraft(userId: string, teamId: string): Promise<boolean> {
  const { roles } = await getUserTeamRoles(userId, teamId);
  return roles.includes('broker') || roles.includes('captain');
}

// Role-based feature flags
export async function getTeamFeatures(userId: string, teamId: string): Promise<string[]> {
  const { roles } = await getUserTeamRoles(userId, teamId);
  const features = [];

  if (roles.includes('captain')) features.push('team-management', 'role-assignment');
  if (roles.includes('broker')) features.push('draft-picks', 'trades');
  if (roles.includes('historian')) features.push('match-reporting', 'statistics');
  if (roles.includes('pilot')) features.push('deck-play', 'match-participation');

  return features;
}
```

## API Reference

### Complete Function Signatures

```typescript
// Get team members with roles
export async function getTeamMembersWithRoles(
  teamId: string
): Promise<{ members: TeamMemberWithRoles[]; error?: string }>

// Assign a role
export async function assignRoleToMember(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }>

// Remove a role
export async function removeRoleFromMember(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }>

// Check specific role
export async function userHasTeamRole(
  userId: string,
  teamId: string,
  role: TeamRole
): Promise<{ hasRole: boolean; error?: string }>

// Get all user roles
export async function getUserTeamRoles(
  userId: string,
  teamId: string
): Promise<{ roles: TeamRole[]; error?: string }>

// Get role history
export async function getTeamRoleHistory(
  teamId: string,
  limit?: number
): Promise<{ history: RoleHistoryEntry[]; error?: string }>

// Bulk assign roles
export async function assignMultipleRoles(
  teamMemberId: string,
  roles: TeamRole[],
  notes?: string
): Promise<{ success: boolean; error?: string }>

// Helper functions
export function getRoleDescription(role: TeamRole): string
export function getRoleEmoji(role: TeamRole): string
export function getRoleDisplayName(role: TeamRole): string
```

## Security Considerations

### Row Level Security

All role tables have RLS enabled with policies that:
- ✅ Allow all authenticated users to read roles
- ✅ Allow all authenticated users to insert/update/delete (for now)
- ⚠️ **Production recommendation**: Restrict inserts/updates/deletes to captain role only

### Audit Trail

All role changes are logged with:
- Who performed the action (performed_by)
- What action was taken (assigned/removed)
- When it happened (performed_at)
- Optional context (notes)

This provides accountability and traceability for security and debugging.

### Permission Checks

**Client-side checks:**
- Used for UI display (show/hide buttons)
- NOT used for security (can be bypassed)

**Server-side checks:**
- Used in server actions
- Enforced at database level with RLS
- Cannot be bypassed by client

**Best practice:**
```typescript
// Client: Hide UI
{isCaptain && <button>Manage Roles</button>}

// Server: Enforce permission
export async function assignRole(...) {
  const { hasRole } = await userHasTeamRole(userId, teamId, 'captain');
  if (!hasRole) {
    return { success: false, error: 'Permission denied' };
  }
  // ... proceed with role assignment
}
```

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
**Schema Version:** database/team-roles-schema.sql v1.0
