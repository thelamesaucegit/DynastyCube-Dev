# Admin Role Management Guide

This guide covers the admin interface for managing team member roles across all teams in Dynasty Cube.

## Overview

The Admin Role Management system allows administrators to:
- View all teams with their members and role assignments
- Assign or remove any role for any team member
- Override team captain restrictions
- Monitor role distribution across the entire platform
- Make emergency role changes when team captains are unavailable

## Accessing Admin Role Management

### Requirements

1. **Admin Access**: Your account must have `is_admin = true` in the `users` table
2. **Authentication**: You must be logged in with a valid session
3. **Database Setup**: Team roles schema must be installed

### Navigation

**Method 1: Via Admin Panel**
1. Navigate to `/admin`
2. Click the **⚙️ Settings** tab
3. Find the "Team Role Management" card
4. Click **"Manage Team Roles"** button

**Method 2: Direct URL**
- Navigate directly to `/admin/roles`

## Features

### Dashboard Overview

At the top of the page, you'll see three key statistics:

1. **Total Teams** - Number of teams in the system
2. **Total Members** - Aggregate count of all team members
3. **Total Role Assignments** - Total number of roles assigned across all teams

### Role Reference Panel

Quick reference showing all four roles with emojis and descriptions:
- **👑 Captain** - Full administrative control
- **🤝 Broker** - Handles draft picks and trades
- **📜 Historian** - Records team history
- **⚔️ Pilot** - Plays matches with team decks

### Team Expansion

Teams are displayed in collapsible sections:
- Click any team header to expand/collapse
- Shows team emoji, name, and summary stats
- All teams are expanded by default

### Member Management

For each member, you can see:
- Email address
- Current role badges (colored pills showing assigned roles)
- "No roles assigned" if member has no roles
- **Manage Roles** button to assign/remove roles

### Role Assignment Interface

Click **"Manage Roles"** to open the assignment panel:
- Four buttons representing each role
- **Gray button** = Role not assigned (click to assign)
- **Green button with ✓** = Role assigned (click to remove)
- Changes take effect immediately
- Success/error messages appear at the top

## Usage Examples

### Assigning Initial Team Captains

**Scenario**: New team created, needs a captain

1. Navigate to `/admin/roles`
2. Find the team in the list
3. Click the team header to expand (if collapsed)
4. Locate the founder member
5. Click **"Manage Roles"**
6. Click the **Captain** button (gray)
7. Success message: "Captain role assigned successfully!"
8. Button turns green with checkmark

### Emergency Role Override

**Scenario**: Team captain is inactive, need to reassign captain role

1. Navigate to `/admin/roles`
2. Find the affected team
3. Expand the team member list
4. Click **"Manage Roles"** for the inactive captain
5. Click the **Captain** button (green with ✓) to remove
6. Click **"Manage Roles"** for the new captain
7. Click the **Captain** button (gray) to assign
8. Both actions are logged in role history

### Bulk Role Assignment

**Scenario**: Setting up a new team with multiple members

1. Navigate to the team in `/admin/roles`
2. For each member:
   - Click **"Manage Roles"**
   - Assign appropriate roles
   - Multiple roles can be assigned to one person
3. Verify all assignments show as green buttons
4. Changes are immediately saved

### Role Audit

**Scenario**: Checking who has captain role across all teams

1. Navigate to `/admin/roles`
2. Expand all teams (or use default expanded state)
3. Scan for **👑 Captain** badges
4. Members with captain role show blue pill with "👑 Captain"
5. Note any teams without captains

## Admin vs. Captain Permissions

### Similarities

Both admins and captains can:
- Assign roles to team members
- Remove roles from team members
- View role assignments
- See role descriptions

### Differences

| Feature | Captain | Admin |
|---------|---------|-------|
| **Scope** | Own team only | All teams |
| **Override** | Cannot override other captains | Can override anyone |
| **Access** | `/teams/[teamId]` → Roles tab | `/admin/roles` |
| **Logging** | "Assigned by captain" | "Assigned by admin" |
| **Restrictions** | Cannot manage own captain role | Can manage any role |
| **Bypass** | Subject to RLS policies | Admin-level access |

## Security & Permissions

### Authentication Check

The admin roles page performs multiple security checks:

1. **Auth Check**: Verifies user is logged in
2. **Admin Check**: Verifies `is_admin = true` in database
3. **Session Validation**: Ensures valid Supabase session

If any check fails:
- User sees "Access Denied" error
- Cannot access role management
- Redirected to appropriate page

### Audit Trail

All admin role changes are logged with:
- **team_member_id**: Which member was affected
- **role**: What role was changed
- **action**: "assigned" or "removed"
- **performed_by**: Admin's user ID
- **performed_at**: Timestamp
- **notes**: Automatically includes "Assigned by admin" or "Removed by admin"

Query audit trail:
```sql
SELECT * FROM team_role_history
WHERE performed_by = 'admin-user-id'
ORDER BY performed_at DESC;
```

### RLS Policies

Admin actions use elevated permissions:
- Check `is_admin` flag in `users` table
- Bypass normal team member restrictions
- Still log all actions for accountability

## Technical Implementation

### Server Actions

Located in `src/app/actions/adminRoleActions.ts`

#### getAllTeamsWithRoles()
```typescript
const { teams, error } = await getAllTeamsWithRoles();
// Returns all teams with nested members and their roles
```

**Returns:**
```typescript
interface TeamWithMembers {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members: TeamMemberWithRoles[];
}
```

#### adminAssignRole()
```typescript
const { success, error } = await adminAssignRole(
  memberId,
  'captain',
  'Optional notes'
);
```

**Features:**
- Checks admin status
- Inserts role assignment
- Logs to role history
- Returns success/error

#### adminRemoveRole()
```typescript
const { success, error } = await adminRemoveRole(
  memberId,
  'broker',
  'Optional notes'
);
```

**Features:**
- Checks admin status
- Deletes role assignment
- Logs to role history
- Returns success/error

#### checkIsAdmin()
```typescript
const { isAdmin, error } = await checkIsAdmin();
```

**Features:**
- Validates current user session
- Queries `users.is_admin` flag
- Used for page access control

### React Component

**AdminRoleManager** (`src/app/components/admin/AdminRoleManager.tsx`)

**State Management:**
```typescript
const [teams, setTeams] = useState<TeamWithMembers[]>([]);
const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
const [managingMember, setManagingMember] = useState<string | null>(null);
```

**Key Features:**
- Collapsible team sections
- Role assignment panel toggle
- Success/error message display
- Automatic data refresh after changes
- Loading states with spinners

### Page Component

**AdminRolesPage** (`src/app/admin/roles/page.tsx`)

**Flow:**
1. Check if user is authenticated
2. Verify admin status via `checkIsAdmin()`
3. Show loading spinner while checking
4. Display "Access Denied" if not admin
5. Render `AdminRoleManager` component if authorized

## Setup Instructions

### 1. Database Setup

Ensure the team roles schema is installed:

```bash
# Execute in Supabase SQL Editor
# File: database/team-roles-schema.sql
```

### 2. Grant Admin Access

Set admin flag for your user:

```sql
-- Replace 'your-email@example.com' with admin email
UPDATE users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

Verify admin status:
```sql
SELECT id, email, is_admin
FROM users
WHERE is_admin = true;
```

### 3. Test Access

1. Log in with admin account
2. Navigate to `/admin/roles`
3. Should see all teams and members
4. Try assigning a test role
5. Verify success message appears
6. Check role appears in green button

### 4. Verify Audit Logging

```sql
SELECT
  trh.*,
  tm.user_email,
  u.email as performed_by_email
FROM team_role_history trh
JOIN team_members tm ON trh.team_member_id = tm.id
JOIN users u ON trh.performed_by = u.id
WHERE trh.notes LIKE '%admin%'
ORDER BY trh.performed_at DESC
LIMIT 20;
```

## Troubleshooting

### "Access Denied" Error

**Possible Causes:**
1. Not logged in
2. `is_admin` flag not set
3. Database connection issue

**Solutions:**
1. Verify you're logged in
2. Check `users` table:
   ```sql
   SELECT is_admin FROM users WHERE email = 'your-email';
   ```
3. Update admin flag if false:
   ```sql
   UPDATE users SET is_admin = true WHERE email = 'your-email';
   ```
4. Log out and log back in
5. Check browser console for errors

### No Teams Appearing

**Possible Causes:**
1. No teams in database
2. Query error
3. RLS policy blocking access

**Solutions:**
1. Verify teams exist:
   ```sql
   SELECT * FROM teams;
   ```
2. Check browser console for errors
3. Verify admin role is properly set
4. Check Supabase logs

### Role Assignment Not Working

**Possible Causes:**
1. Member already has role (duplicate)
2. Network error
3. Database constraint violation

**Solutions:**
1. Check if role already exists (green button)
2. Check browser network tab for failed requests
3. Verify `team_member_roles` table exists
4. Check Supabase logs for errors

### Changes Not Saving

**Possible Causes:**
1. Network timeout
2. RLS policy blocking
3. Database trigger failure

**Solutions:**
1. Refresh the page
2. Try again
3. Check browser console for errors
4. Verify database RLS policies
5. Check Supabase logs

### "Member already has this role" Error

**Cause:** Trying to assign a role that's already assigned

**Solution:**
- This is expected behavior
- Role is already assigned (button should be green)
- To reassign, first remove (click green button), then add back

## Best Practices

### For Administrators

✅ **Do:**
- Document why you're making admin-level role changes
- Communicate with team captains before overriding
- Verify changes after making them
- Monitor audit logs regularly
- Use admin access sparingly
- Assign captain role to at least one member per team
- Keep team captains informed of changes

❌ **Don't:**
- Remove all captains from a team
- Make arbitrary role changes without reason
- Use admin access for personal advantage
- Forget to check audit logs
- Assign conflicting roles without communication
- Bypass team captains without good reason

### For Platform Management

✅ **Do:**
- Review role distribution regularly
- Ensure all teams have at least one captain
- Monitor for inactive captains
- Set up alerts for teams without captains
- Document admin access procedures
- Train new admins thoroughly
- Regular audit log reviews

❌ **Don't:**
- Give admin access to untrusted users
- Allow multiple admins without oversight
- Skip documentation of changes
- Ignore audit logs
- Make bulk changes without backups

## Emergency Procedures

### Team Captain Inactive

1. Navigate to `/admin/roles`
2. Find the affected team
3. Identify active team member to promote
4. Remove captain role from inactive member
5. Assign captain role to active member
6. Notify team of the change
7. Document reason in team communications

### Accidental Role Removal

1. Check audit log to see what was removed:
   ```sql
   SELECT * FROM team_role_history
   WHERE action = 'removed'
   ORDER BY performed_at DESC
   LIMIT 10;
   ```
2. Navigate to `/admin/roles`
3. Find the affected member
4. Reassign the role
5. Verify with team captain
6. Document the correction

### Bulk Role Reset

**Scenario:** Need to reset all roles for a team

1. Navigate to the team in `/admin/roles`
2. For each member with roles:
   - Click "Manage Roles"
   - Remove all roles (click green buttons)
3. Assign new roles as needed
4. Verify with team captain
5. Document the reset in audit notes

## Future Enhancements

Planned improvements:

- 🔍 **Search/Filter** - Search for specific members or teams
- 📊 **Role Analytics** - Visual charts of role distribution
- 📝 **Custom Notes** - Add custom notes to role changes
- 🔔 **Notifications** - Alert team captains of admin changes
- 📜 **History View** - Integrated role history viewer
- 🔐 **Permission Levels** - Granular admin permissions
- 📤 **Export** - Export role assignments to CSV
- 🔄 **Bulk Operations** - Assign roles to multiple members at once
- ⏰ **Role Expiry** - Set temporary role assignments
- 🎯 **Role Templates** - Pre-defined role sets for common scenarios

## API Reference

### Complete Function Signatures

```typescript
// Get all teams with members and roles (admin only)
export async function getAllTeamsWithRoles(): Promise<{
  teams: TeamWithMembers[];
  error?: string;
}>

// Assign role as admin (works across all teams)
export async function adminAssignRole(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }>

// Remove role as admin (works across all teams)
export async function adminRemoveRole(
  teamMemberId: string,
  role: TeamRole,
  notes?: string
): Promise<{ success: boolean; error?: string }>

// Check if current user is admin
export async function checkIsAdmin(): Promise<{
  isAdmin: boolean;
  error?: string;
}>
```

### TypeScript Types

```typescript
export interface TeamWithMembers {
  id: string;
  name: string;
  emoji: string;
  motto: string;
  members: TeamMemberWithRoles[];
}

export interface TeamMemberWithRoles {
  member_id: string;
  user_id: string;
  user_email: string;
  team_id: string;
  joined_at: string;
  roles: TeamRole[];
  role_assigned_dates: string[];
}

export type TeamRole = "captain" | "broker" | "historian" | "pilot";
```

## SQL Queries

### Find Teams Without Captains

```sql
SELECT t.id, t.name, t.emoji
FROM teams t
WHERE NOT EXISTS (
  SELECT 1
  FROM team_members tm
  JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
  WHERE tm.team_id = t.id
  AND tmr.role = 'captain'
);
```

### Role Distribution Report

```sql
SELECT
  tmr.role,
  COUNT(*) as total_assignments,
  COUNT(DISTINCT tm.team_id) as teams_with_role
FROM team_member_roles tmr
JOIN team_members tm ON tmr.team_member_id = tm.id
GROUP BY tmr.role
ORDER BY total_assignments DESC;
```

### Recent Admin Changes

```sql
SELECT
  trh.performed_at,
  trh.action,
  trh.role,
  tm.user_email as affected_member,
  t.name as team_name,
  u.email as admin_email
FROM team_role_history trh
JOIN team_members tm ON trh.team_member_id = tm.id
JOIN teams t ON tm.team_id = t.id
JOIN users u ON trh.performed_by = u.id
WHERE u.is_admin = true
ORDER BY trh.performed_at DESC
LIMIT 50;
```

### Members with Multiple Roles

```sql
SELECT
  tm.user_email,
  t.name as team_name,
  ARRAY_AGG(tmr.role) as roles,
  COUNT(tmr.role) as role_count
FROM team_members tm
JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
JOIN teams t ON tm.team_id = t.id
GROUP BY tm.id, tm.user_email, t.name
HAVING COUNT(tmr.role) > 1
ORDER BY role_count DESC;
```

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
**Related Docs:** TEAM_ROLES_GUIDE.md
