-- =============================================================================
-- COMPREHENSIVE FIX: RLS Policies + Team Members View
-- Run this entire script in Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. FIX USERS TABLE RLS POLICIES
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== Fixing Users Table RLS Policies ===';
END $$;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create new policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DO $$
BEGIN
  RAISE NOTICE '✓ Users table RLS policies updated';
END $$;

-- =============================================================================
-- 2. FIX TEAM MEMBERS WITH ROLES VIEW
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== Fixing Team Members With Roles View ===';
END $$;

-- Drop existing view (with CASCADE to handle dependencies)
DROP VIEW IF EXISTS public.team_members_with_roles CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✓ Dropped old view';
END $$;

-- Create new view with COALESCE fallback logic
CREATE VIEW public.team_members_with_roles AS
SELECT
  tm.id as member_id,
  tm.user_id,
  tm.user_email,
  COALESCE(u.display_name, u.discord_username, tm.user_email) as user_display_name,
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
FROM public.team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
LEFT JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
GROUP BY tm.id, tm.user_id, tm.user_email, u.display_name, u.discord_username, tm.team_id, tm.joined_at;

COMMENT ON VIEW public.team_members_with_roles IS 'Team members with roles - uses display_name, falls back to discord_username, then email';

DO $$
BEGIN
  RAISE NOTICE '✓ Created new view with COALESCE logic';
END $$;

-- =============================================================================
-- 3. VERIFY CHANGES
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== Verification ===';
END $$;

-- Check policies
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users';

  RAISE NOTICE '✓ Found % policies on users table', policy_count;

  IF policy_count < 3 THEN
    RAISE WARNING '⚠ Expected 3 policies, found %', policy_count;
  END IF;
END $$;

-- Test the view
DO $$
DECLARE
  test_email text := 'amonteallen@gmail.com';
  test_display_name text;
BEGIN
  SELECT user_display_name INTO test_display_name
  FROM public.team_members_with_roles
  WHERE user_email = test_email
  LIMIT 1;

  IF test_display_name IS NOT NULL THEN
    RAISE NOTICE '✓ View test successful - display name: %', test_display_name;
  ELSE
    RAISE WARNING '⚠ No team member found for email: %', test_email;
  END IF;
END $$;

-- Show view definition
DO $$
BEGIN
  RAISE NOTICE '=== View Definition ===';
  RAISE NOTICE '%', pg_get_viewdef('public.team_members_with_roles', true);
END $$;

-- =============================================================================
-- 4. FINAL SUMMARY
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== All Done! ===';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Restart your Next.js dev server: npm run dev';
  RAISE NOTICE '2. Hard refresh your browser: Ctrl+Shift+R';
  RAISE NOTICE '3. Check the Team Roles page';
END $$;
