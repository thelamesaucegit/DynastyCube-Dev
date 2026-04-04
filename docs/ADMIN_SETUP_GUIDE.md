# Admin Panel Database Setup Guide

This guide will walk you through setting up database persistence for the Dynasty Cube admin panel.

## Prerequisites

- Supabase project created and configured
- Environment variables set in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 1: Create Database Tables

### Option A: Using Supabase SQL Editor (Recommended)

**Part 1: Create Main Tables**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the entire contents of `database/schema.sql`
5. Paste into the SQL editor
6. Click **Run** to execute

**Part 2: Create User Profiles Table (Required for Admin Access)**

1. In Supabase SQL Editor, click **New query** again
2. Copy the entire contents of `database/users-schema.sql`
3. Paste into the SQL editor
4. Click **Run** to execute
5. This creates the `users` table with `is_admin` flag

**Part 3: Create Draft & Deck Tables**

1. In Supabase SQL Editor, click **New query** again
2. Copy the entire contents of `database/draft-schema.sql`
3. Paste into the SQL editor
4. Click **Run** to execute

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run the schema
supabase db push

# Or run the SQL file directly
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f database/schema.sql
```

## Step 2: Verify Tables Were Created

Go to **Table Editor** in Supabase dashboard and verify these tables exist:

**Main Tables:**
- ✅ `teams` - Contains the 8 default teams
- ✅ `team_members` - Stores user-to-team assignments
- ✅ `card_pools` - Stores MTG cards for draft pools
- ✅ `users` - Stores user profiles with `is_admin` flag
- ✅ `user_roles` - (Optional) Stores user permission roles

**Draft & Deck Tables:**
- ✅ `team_draft_picks` - Stores cards that teams have drafted
- ✅ `team_decks` - Stores deck metadata
- ✅ `deck_cards` - Stores which cards are in which decks

**Team Roles Tables:**
- ✅ `team_member_roles` - Stores role assignments (captain, broker, historian, pilot)
- ✅ `team_role_history` - Audit log of role changes
- ✅ `team_members_with_roles` - View showing members with their roles

## Step 3: Configure Row Level Security (RLS)

The schema includes RLS policies, but you may need to adjust them based on your security requirements:

### Current RLS Setup:

**Teams Table:**
- ✅ Everyone can read teams
- ✅ Only service role can modify teams

**Team Members Table:**
- ✅ Everyone can view team memberships
- ✅ Only service role can add/remove members

**Card Pools Table:**
- ✅ Everyone can view cards
- ✅ Only service role can add/remove cards

**User Roles Table:**
- ✅ Only service role can view/modify roles

**Users Table:**
- ✅ Everyone can read user profiles
- ✅ Users can update their own profile (except is_admin)
- ✅ Admins can update their own is_admin flag

## Step 4: Grant Admin Access

After setting up the database, you need to grant admin access to at least one user:

### Method 1: Via SQL Editor (Recommended)

1. First, **sign up or log in** to your app with the email you want to make admin
2. Go to Supabase SQL Editor
3. Run this query (replace with your email):

```sql
-- Grant admin access to a user
UPDATE public.users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

4. Verify it worked:

```sql
-- Check admin users
SELECT id, email, is_admin, created_at
FROM public.users
WHERE is_admin = true;
```

### Method 2: Via Table Editor

1. Go to **Table Editor** → **users** table
2. Find your user row (search by email)
3. Click on the `is_admin` cell
4. Change `false` to `true`
5. Press Enter to save

### Method 3: Multiple Admins

```sql
-- Grant admin to multiple users at once
UPDATE public.users
SET is_admin = true
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);
```

### Verify Admin Access

1. Log out and log back in (to refresh your session)
2. Navigate to `/admin`
3. If you see the admin panel, you have admin access!
4. If you see "Access Denied", check the SQL query ran successfully

## Step 5: Test Database Connection

### Test Draft & Deck Features:

1. Navigate to a team page (e.g., `/teams/ninja`)
2. Click the **"Decks"** tab
3. Try creating a new deck:
   - Click "+ New Deck"
   - Enter a deck name
   - Click "Create Deck"
   - You should see a success message
4. The deck should appear in the "Your Decks" section

If you encounter errors, see the Troubleshooting section below.

### Test Team Management:

1. Navigate to `/admin` (you must be signed in with an admin email)
2. Click the **Teams** tab
3. Try adding a member to a team:
   - Enter your email address
   - Click "Add Member"
   - You should see a success message
4. Refresh the page - the member should still be there

### Test Card Management:

1. Click the **Cards** tab
2. Search for a Magic card (e.g., "Lightning Bolt")
3. Click "Add to Pool" on a search result
4. The card should appear in the Current Card Pool
5. Refresh the page - the card should still be there

## Step 5: Troubleshooting

### Issue: "relation does not exist" error

**Solution:** Tables weren't created. Re-run the schema.sql file.

### Issue: "Not authenticated" error or "new row violates row-level security policy"

**Solution:** The RLS policies are too restrictive. You have two options:

**Option 1 - Proper Fix (Recommended):**
Run BOTH of these SQL files in Supabase SQL Editor to update policies:

1. `database/fix-rls-policies.sql` - Fixes RLS for main tables (teams, team_members, card_pools)
2. `database/fix-draft-rls-policies.sql` - Fixes RLS for draft tables (team_decks, team_draft_picks, deck_cards)

This will:
- Allow authenticated users to modify data
- Application-level admin checks (in `adminUtils.ts`) will still protect admin operations

**Option 2 - Quick Test (Temporary):**
Run `database/temp-disable-rls.sql` to temporarily disable RLS for testing:

```sql
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_pools DISABLE ROW LEVEL SECURITY;
```

**Important:** Re-enable RLS with Option 1 before going to production!

### Issue: "permission denied" error

**Solution:** Same as "Not authenticated" error above.

### Issue: Can't add team members

**Possible causes:**
1. User email doesn't exist in your auth system
2. Duplicate entry (user already in that team)
3. RLS policy blocking the insert

**Check the browser console for detailed error messages.**

### Issue: Cards not loading from Scryfall

**Solution:** Scryfall API might be rate-limited or down. Wait a few seconds and try again.

### Issue: "column pool_name does not exist" error

**Solution:** The `card_pools` table was created without the `pool_name` column. Run `database/fix-pool-name.sql` in Supabase SQL Editor to add the missing column.

## Step 6: Admin Access Configuration

Edit `src/app/utils/adminUtils.ts` and add admin emails:

```typescript
const ADMIN_EMAILS = [
  "admin@dynastycube.com",
  "your-email@gmail.com",  // Add your email here
  "another-admin@example.com",
];
```

## Advanced Configuration

### Using Database Roles Instead of Hardcoded Emails

To implement database-based admin roles:

1. Add admin role to user:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

2. Update `adminUtils.ts` to check the `user_roles` table instead of hardcoded emails

### Creating Multiple Card Pools

The current implementation uses a single "default" pool. To create multiple pools:

1. Modify the CardManagement component to accept a `pool_name` parameter
2. Update the UI to allow switching between pools
3. Use the `pool_name` field in database queries

Example:
```typescript
const result = await getCardPool("summer-2024");
```

### Linking Teams to Users Properly

Currently, team members are identified by email only. To properly link to Supabase auth users:

1. You'll need to query the auth.users table (requires service role)
2. Create an API route or server action with elevated permissions
3. Look up user_id by email before inserting into team_members

## Database Schema Reference

### teams

| Column | Type | Description |
|--------|------|-------------|
| id | text | Team identifier (e.g., "shards") |
| name | text | Display name |
| emoji | text | Team emoji |
| motto | text | Team motto |

### team_members

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Reference to auth.users |
| team_id | text | Reference to teams.id |
| user_email | text | User's email address |
| joined_at | timestamp | When user joined team |

### card_pools

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| card_id | text | Scryfall card ID |
| card_name | text | Card name |
| card_set | text | Set name |
| card_type | text | Type line |
| rarity | text | Card rarity |
| colors | text[] | Mana colors |
| image_url | text | Card image URL |
| pool_name | text | Pool identifier |
| created_by | uuid | User who added card |

## Next Steps

1. ✅ Database tables created
2. ✅ Admin panel accessible
3. ✅ Team management working
4. ✅ Card management working
5. ⬜ Optional: Implement user management with Supabase Admin API
6. ⬜ Optional: Add role-based permissions
7. ⬜ Optional: Create draft event management
8. ⬜ Optional: Build Pools page to display cards

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Check Supabase logs in the dashboard
3. Verify your environment variables are set correctly
4. Make sure you're signed in with an admin email

## Security Checklist

Before going to production:

- [ ] Enable RLS on all tables
- [ ] Review RLS policies for security
- [ ] Move admin emails to environment variables
- [ ] Implement proper role-based access control
- [ ] Add audit logging for admin actions
- [ ] Set up database backups
- [ ] Review and test all permissions

---

**Last Updated:** $(date)
**Schema Version:** 1.0.0
