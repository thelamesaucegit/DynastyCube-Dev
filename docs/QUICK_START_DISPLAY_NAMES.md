# Quick Start: Fixing Display Names

## The Problem
You were getting this error:
```
ERROR: 42703: column from_user_data.full_name does not exist
```

This happened because the `messages_with_user_info` view was trying to access a `full_name` column that doesn't exist in the `public.users` table.

## The Solution
We've implemented a proper display name system that:
- ✅ Works with both Discord and Google OAuth
- ✅ Lets users customize their display name
- ✅ Properly maps OAuth provider metadata to database fields

## Steps to Fix Your Database

### 1. Run the Migration Script

Connect to your Supabase database and run:

```bash
psql [your-supabase-connection-string] -f database/fix-display-names.sql
```

Or using the Supabase SQL Editor:
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the sidebar
3. Open `database/fix-display-names.sql`
4. Copy and paste the contents
5. Click "Run"

### 2. Verify the Fix

Run this query to check that the view works:

```sql
SELECT * FROM messages_with_user_info LIMIT 5;
```

You should see no errors! 🎉

### 3. Add Display Name Editor to Account Page

To let users edit their display names, add this import to `src/app/account/page.tsx`:

```typescript
import { DisplayNameEditor } from "../components/DisplayNameEditor";
```

Then add the component inside the `UserProfile` component (around line 100):

```typescript
{/* Display Name Editor */}
<DisplayNameEditor />
```

Example placement:
```typescript
<UserProfile>
  {/* ... existing account info ... */}

  {/* Add this new section */}
  <DisplayNameEditor />

  {/* ... team section ... */}
  {/* ... account linking section ... */}
</UserProfile>
```

## What Changed?

### Database Changes

**Before:**
```sql
COALESCE(
  from_user_data.full_name,  -- ❌ This column doesn't exist
  from_user_data.username,   -- ❌ This column doesn't exist
  from_user.email
)
```

**After:**
```sql
COALESCE(
  from_user_data.display_name,      -- ✅ User's custom display name
  from_user_data.discord_username,  -- ✅ Discord username (Discord users only)
  from_user.email
)
```

### User Creation Trigger

**Before:**
```sql
INSERT INTO public.users (id, email, discord_id, discord_username, avatar_url)
VALUES (
  NEW.id,
  NEW.email,
  NEW.raw_user_meta_data->>'provider_id',
  NEW.raw_user_meta_data->>'full_name',  -- Wrong mapping!
  NEW.raw_user_meta_data->>'avatar_url'
);
```

**After:**
```sql
INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
VALUES (
  NEW.id,
  NEW.email,
  NEW.raw_user_meta_data->>'provider_id',
  CASE WHEN v_provider = 'discord'
    THEN NEW.raw_user_meta_data->>'full_name'  -- Only for Discord users
    ELSE NULL
  END,
  NEW.raw_user_meta_data->>'full_name',  -- Initial display name
  COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',  -- Discord
    NEW.raw_user_meta_data->>'picture'       -- Google
  )
);
```

## How It Works Now

### For Discord Users:
1. User logs in with Discord OAuth
2. `discord_username` is set to their Discord username
3. `display_name` is initially set to their Discord username
4. User can change `display_name` to whatever they want

### For Google Users:
1. User logs in with Google OAuth
2. `discord_username` is NULL (they're not a Discord user)
3. `display_name` is initially set to their Google full name
4. User can change `display_name` to whatever they want

### Display Priority:
When showing a user's name to others:
1. **First**: Use their custom `display_name` (if set)
2. **Then**: Use their `discord_username` (Discord users only)
3. **Then**: Use their `email`
4. **Finally**: Show "Unknown User"

## Files Modified

### Database Files:
- ✅ `database/users-schema.sql` - Updated trigger and backfill
- ✅ `database/add-message-user-info-view.sql` - Fixed column references
- ✅ `database/fix-display-names.sql` - New migration script

### New Files:
- ✅ `src/app/components/DisplayNameEditor.tsx` - User-facing editor component
- ✅ `DISPLAY_NAME_SYSTEM.md` - Full documentation
- ✅ `QUICK_START_DISPLAY_NAMES.md` - This file!

## Testing

After running the migration:

1. ✅ Test existing messages view (should work now)
2. ✅ Try creating a new Discord user
3. ✅ Try creating a new Google user
4. ✅ Test the display name editor component
5. ✅ Check that names appear correctly in messages

## Need Help?

If you run into issues:

1. Check that the migration ran successfully
2. Verify all users have a `display_name` set:
   ```sql
   SELECT id, email, display_name, discord_username
   FROM public.users
   WHERE display_name IS NULL;
   ```
3. Check the view definition:
   ```sql
   \d+ messages_with_user_info
   ```

## What's Next?

Consider these future improvements:

- [ ] Rename `discord_id` to `provider_user_id` for clarity
- [ ] Add display name validation (profanity filter, uniqueness check, etc.)
- [ ] Show display name in more places throughout the app
- [ ] Add ability to see Discord username even if display name is different
- [ ] Add display name history/audit log
