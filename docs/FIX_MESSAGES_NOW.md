# 🚨 FIX MESSAGING SYSTEM ERROR - Run This Now!

## The Error You're Getting

```
Error: Failed to run sql query: ERROR: 42703: column from_user_data.full_name does not exist
LINE 22: from_user_data.full_name,
```

## How to Fix It (5 minutes)

### Option 1: Supabase Dashboard (Easiest)

1. **Go to your Supabase project dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your Dynasty Cube project

2. **Open the SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and paste the fix**
   - Open the file: `database/RUNME-fix-messages-view.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor

4. **Run it!**
   - Click the "Run" button (or press Ctrl+Enter / Cmd+Enter)
   - You should see: ✅ SUCCESS! messages_with_user_info view has been fixed!

5. **Verify it worked**
   - In a new query, run:
     ```sql
     SELECT * FROM messages_with_user_info LIMIT 5;
     ```
   - If you see results (or "no rows"), it worked! 🎉

### Option 2: Using psql Command Line

If you have PostgreSQL installed locally:

```bash
psql [your-supabase-connection-string] -f database/RUNME-fix-messages-view.sql
```

## What This Fix Does

✅ **Drops** the broken `messages_with_user_info` view
✅ **Recreates** it with the correct column names:
   - `full_name` → `display_name`
   - `username` → `discord_username`
✅ **Preserves** all your existing messages data
✅ **Enables** the messaging system to work properly

## After Running the Fix

Your messaging system should now work! You can:

- ✅ View messages in `/messages`
- ✅ Send messages to other users
- ✅ See proper user names (not "Unknown User")

## Still Getting Errors?

If you still see errors after running this:

1. **Check if you have the display_name column:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'users'
   AND table_schema = 'public';
   ```

   You should see:
   - `display_name` (text)
   - `discord_username` (text)

2. **If those columns are missing**, run this first:
   ```sql
   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_username text;
   ```

3. **Then run the RUNME script again**

## Next Steps (Optional but Recommended)

For a complete display name system (allows users to customize their names):

1. Run the full migration:
   ```bash
   psql [connection] -f database/fix-display-names.sql
   ```

2. Add the display name editor to your account page (see `QUICK_START_DISPLAY_NAMES.md`)

## Need Help?

- Check the detailed guide: `DISPLAY_NAME_SYSTEM.md`
- Quick start guide: `QUICK_START_DISPLAY_NAMES.md`
- View the fixed file: `database/add-message-user-info-view.sql`

---

**TL;DR:** Copy `database/RUNME-fix-messages-view.sql` into Supabase SQL Editor and click Run. That's it! 🎉
