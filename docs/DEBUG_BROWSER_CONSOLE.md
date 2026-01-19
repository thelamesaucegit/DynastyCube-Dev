# 🔍 Debug from Browser Console

If "Unknown User" persists after running the SQL fixes, the issue might be on the frontend.

## Quick Browser Console Check

### Step 1: Open Browser Console
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (Mac)
- Go to "Console" tab

### Step 2: Check What Data is Loading

Paste this code in the console and press Enter:

```javascript
// Check what getTeamsWithMembers is returning
async function debugTeamMembers() {
  const { createBrowserClient } = await import('@supabase/ssr');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('=== FETCHING TEAMS ===');
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', 'ninja');

  console.log('Teams:', teams);
  console.log('Teams Error:', teamsError);

  console.log('=== FETCHING TEAM MEMBERS ===');
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', 'ninja');

  console.log('Members:', members);
  console.log('Members Error:', membersError);

  console.log('=== FETCHING USERS ===');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, display_name, discord_username');

  console.log('Users:', users);
  console.log('Users Error:', usersError);

  if (usersError) {
    console.error('❌ RLS POLICY ISSUE:', usersError.message);
    console.log('Solution: Run database/fix-users-rls-policy.sql');
    return;
  }

  console.log('=== JOINED DATA ===');
  const userMap = new Map(users.map(u => [
    u.id,
    u.display_name || u.discord_username || 'Unknown User'
  ]));

  const membersWithNames = members.map(m => ({
    ...m,
    display_name: userMap.get(m.user_id)
  }));

  console.log('Members with names:', membersWithNames);

  return { teams, members, users, membersWithNames };
}

debugTeamMembers();
```

### Step 3: Interpret Results

**If you see:**
```
Users Error: { message: "permission denied for table users" }
```
→ **RLS policy not applied** - Run `database/fix-users-rls-policy.sql`

**If you see:**
```
Users: []
```
→ **No users exist** - Run `database/STEP-BY-STEP-FIX.sql` Step 3

**If you see:**
```
Users: [{ id: "...", display_name: null, discord_username: null }]
```
→ **Display name is NULL** - Run `database/STEP-BY-STEP-FIX.sql` Step 2

**If you see:**
```
Users: [{ id: "...", display_name: "YourName", ... }]
```
→ **Data is correct** - Hard refresh browser (Ctrl+Shift+R)

## Manual Quick Fix from Console

If the data looks good but UI still shows "Unknown User", force a page reload:

```javascript
// Clear all caches and reload
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}
location.reload(true);
```

## Check React State

If you're still seeing "Unknown User", check if React is updating:

```javascript
// This will show you what React DevTools sees
// Install React DevTools extension first
// Then inspect the TeamPage component state
```

## Force Re-fetch Team Data

If all else fails, trigger a manual refresh of team data:

```javascript
// Navigate away and back
window.location.href = '/teams';
// Then click back to ninja team
```

## Common Issues

### Issue 1: Stale Cache
**Symptom:** Database has correct data, but UI shows old data
**Fix:** Hard refresh (Ctrl+Shift+R) or clear cache

### Issue 2: RLS Policy Missing
**Symptom:** Console shows "permission denied"
**Fix:** Run `database/fix-users-rls-policy.sql`

### Issue 3: NULL Display Name
**Symptom:** Users query returns user but display_name is NULL
**Fix:** Run Step 2 of `database/STEP-BY-STEP-FIX.sql`

### Issue 4: User Doesn't Exist
**Symptom:** Users query returns empty array
**Fix:** Run Step 3 of `database/STEP-BY-STEP-FIX.sql`

## Network Tab Check

1. Open DevTools → Network tab
2. Refresh the team page
3. Filter by "teams"
4. Click on the request
5. Check the Response

**Look for:**
```json
{
  "members": [
    {
      "user_display_name": "Unknown User"  // ❌ Bad
    }
  ]
}
```

vs

```json
{
  "members": [
    {
      "user_display_name": "YourActualName"  // ✅ Good
    }
  ]
}
```

If you see "Unknown User" in the network response, the backend is returning it - the database needs fixing.

If you see your name in the network response but "Unknown User" on screen - it's a frontend caching issue, hard refresh.

## Quick Test URL

Try accessing this directly:
```
http://localhost:3000/teams/ninja
```

Then hard refresh (Ctrl+Shift+R) - this forces a fresh data fetch.
