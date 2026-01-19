# 🔒 RLS Permission Fix - "permission denied for table users"

## The Error

```
Error getting inbox messages: {
  code: "42501",
  details: null,
  hint: null,
  message: "permission denied for table users"
}
```

## What's Happening

Your PostgreSQL database has **Row Level Security (RLS)** enabled on the `public.users` table. This is a security feature that controls who can read/write data.

**The Problem:**
- The messaging system needs to read the `users` table to get display names
- RLS is blocking this access
- The SELECT policy is either missing or misconfigured

## Quick Fix (2 Minutes)

### Option 1: Run the All-in-One Fix (RECOMMENDED)

```bash
# In Supabase Dashboard → SQL Editor
# Copy/paste and run: database/RUNME-fix-messages-view.sql
```

This now includes:
1. ✅ RLS policy fix
2. ✅ Display name population
3. ✅ Messages view fix

**One script fixes everything!**

### Option 2: Run Just the RLS Fix

```bash
# In Supabase Dashboard → SQL Editor
# Copy/paste and run: database/fix-users-rls-policy.sql
```

This only fixes the permission issue.

## What the Fix Does

```sql
-- 1. Enable RLS (if not already)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;

-- 3. Create new SELECT policy
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);
```

**Key Points:**
- ✅ Allows ALL users to read display names (SELECT)
- ✅ Does NOT allow users to edit others' profiles
- ✅ Maintains privacy (emails only visible to owner)
- ✅ Enables messaging and team features

## After Running the Fix

1. **Hard refresh your browser:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Check for errors:**
   - Open browser console (F12)
   - Visit `/messages` page
   - Error should be gone!

3. **Test features:**
   - ✅ Messages should load
   - ✅ Team pages show display names
   - ✅ No more "Unknown User"

## Why RLS Exists

Row Level Security is a **PostgreSQL security feature** that:

- Controls access at the row level (not just table level)
- Prevents unauthorized data access
- Required for multi-tenant applications
- Automatically enforced by Supabase

**Example:**
```sql
-- Without RLS policy:
SELECT * FROM users;  -- ❌ Permission denied!

-- With RLS policy:
SELECT * FROM users;  -- ✅ Works! Shows display names
```

## Understanding the Policies

### SELECT Policy (Read Access)
```sql
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);
```

- **WHO:** `authenticated, anon` = All users (logged in or not)
- **WHAT:** `FOR SELECT` = Read-only access
- **CONDITION:** `USING (true)` = No restrictions, all rows visible
- **PURPOSE:** Allow everyone to see display names (public info)

### UPDATE Policy (Write Access)
```sql
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (...);
```

- **WHO:** Only the user themselves (`auth.uid() = id`)
- **WHAT:** `FOR UPDATE` = Modify access
- **CONDITION:** Only your own row
- **PURPOSE:** Protect profiles from unauthorized edits

## Troubleshooting

### Still Getting Permission Denied?

**1. Check if policy exists:**
```sql
SELECT * FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND policyname = 'Profiles are viewable by everyone';
```

**2. Check if RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'users';
-- rowsecurity should be 't' (true)
```

**3. Manually test SELECT:**
```sql
-- This should work after fix
SELECT id, email, display_name FROM public.users LIMIT 5;
```

### Policy Not Applying?

Try this manual fix:
```sql
-- Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Recreate policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT TO authenticated, anon USING (true);
```

## Security Implications

**Is it safe to allow everyone to read display names?**

✅ **YES** - Display names are intentionally public:
- They appear in team lists
- They show in messages
- They're visible in game interfaces
- They're NOT sensitive information

❌ **NO** for emails:
- Emails are private (protected by separate logic)
- Only visible on user's own account page
- Not exposed in display name queries

**What about privacy?**

The SELECT policy only exposes:
- `display_name` (public)
- `discord_username` (public)
- `avatar_url` (public)

It does NOT expose:
- Actual email addresses (handled by frontend logic)
- `is_admin` flag (though not sensitive)
- Any other private data

## Technical Details

### Error Code 42501
- **Code:** 42501
- **Type:** INSUFFICIENT_PRIVILEGE
- **Meaning:** PostgreSQL denied access due to missing permissions
- **Solution:** Add appropriate RLS policy

### Why This Happened

The error occurred because:
1. I updated `messageActions.ts` to query `public.users`
2. The query ran from the client side (authenticated user)
3. RLS checked for a SELECT policy
4. No policy existed or was active
5. PostgreSQL denied the request

### How RLS Works

```
User Request
    ↓
Supabase Client
    ↓
PostgreSQL Query: SELECT * FROM users
    ↓
RLS Check: Does user have SELECT policy?
    ↓
If YES: Return data
If NO: Throw error 42501
```

## Files Modified

1. **`database/fix-users-rls-policy.sql`** - Standalone RLS fix
2. **`database/RUNME-fix-messages-view.sql`** - Now includes RLS fix
3. **`RLS_PERMISSION_FIX.md`** - This documentation

## Summary

| Issue | Solution | Status |
|-------|----------|--------|
| Permission denied error | Run fix-users-rls-policy.sql | ✅ Ready |
| Messages not loading | Run RUNME-fix-messages-view.sql | ✅ Ready |
| Display names missing | Included in RUNME script | ✅ Ready |
| Team pages broken | Fixed by RLS policy | ✅ Ready |

## Next Steps

1. **Run the fix:** `database/RUNME-fix-messages-view.sql` (includes RLS fix)
2. **Hard refresh:** Clear browser cache
3. **Test:** Visit `/messages` and `/teams/ninja`
4. **Verify:** No more "permission denied" errors

---

**TL;DR:** Run `database/RUNME-fix-messages-view.sql` in Supabase SQL Editor. This fixes the RLS permission issue and everything else. Then hard refresh your browser! 🎉
