# Node.js Upgrade Guide

## Current Issues

Your development server is showing two types of errors:

1. **Node.js deprecation warnings** - Node.js 18 is deprecated by Supabase
2. **RLS permission errors** - "permission denied for table users"

## Step 1: Upgrade Node.js

### Using NVM (Recommended)

```bash
# Install Node.js 20 (LTS)
nvm install 20

# Use Node.js 20
nvm use 20

# Set Node.js 20 as default
nvm alias default 20

# Verify the version
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### Without NVM

Download and install Node.js 20 from: https://nodejs.org/

## Step 2: Reinstall Dependencies

```bash
# Remove old node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall with Node.js 20
npm install
```

## Step 3: Fix Database RLS Policies

Run the following SQL migrations in your Supabase SQL Editor:

### 3a. Fix Users Table Policies

```bash
# Copy and run this file in Supabase SQL Editor
cat database/migrations/fix_users_rls_policy.sql
```

Or run directly in Supabase SQL Editor:

```sql
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Allow everyone to read user profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### 3b. Update Team Members View (for display names)

```bash
# Copy and run this file in Supabase SQL Editor
cat database/migrations/update_team_members_view_display_name.sql
```

## Step 4: Restart Development Server

```bash
npm run dev
```

## Verification

After completing these steps, you should see:

✅ No Node.js deprecation warnings
✅ Development server starts successfully
✅ No "permission denied for table users" errors
✅ User display names show correctly in team roles

## Troubleshooting

### Still seeing Node.js warnings?

```bash
# Check your Node.js version
node -v

# If it's still v18, restart your terminal and try again
```

### Still seeing RLS errors?

1. Go to Supabase Dashboard → SQL Editor
2. Run: `SELECT * FROM pg_policies WHERE tablename = 'users';`
3. Verify you see 3 policies: "Profiles are viewable by everyone", "Users can insert their own profile", "Users can update their own profile"
4. If policies are missing, re-run the migration SQL

### Can't install Node.js 20?

If you're on an older system, Node.js 20.18.1 is the recommended LTS version.
Minimum requirement: Node.js 20.0.0

## Files Updated

- `package.json` - Added engines field requiring Node.js >=20.0.0
- `.nvmrc` - Created with Node.js 20.18.1
- `database/migrations/fix_users_rls_policy.sql` - RLS policy fix
- `database/migrations/update_team_members_view_display_name.sql` - Display name fix
- `database/production-schema.sql` - Updated view definition

## Additional Notes

The `team_members_with_roles` view now includes `user_display_name` from the users table for improved security (displaying names instead of emails).
