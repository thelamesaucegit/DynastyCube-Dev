-- =================================================
-- STEP-BY-STEP DIAGNOSTIC AND FIX
-- =================================================
-- Run each section ONE AT A TIME to diagnose and fix
-- =================================================

-- =================================
-- STEP 1: CHECK IF YOU EXIST IN public.users
-- =================================
-- Run this first to see if you have a record

SELECT
  '=== STEP 1: YOUR USER RECORD ===' as step,
  id,
  email,
  display_name,
  discord_username,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- EXPECTED: You should see your email and a display_name
-- IF display_name IS NULL: Continue to Step 2
-- IF YOU DON'T EXIST AT ALL: Continue to Step 3

-- =================================
-- STEP 2: FIX NULL DISPLAY NAMES
-- =================================
-- Run this if Step 1 showed display_name as NULL

UPDATE public.users u
SET display_name = COALESCE(
  u.discord_username,
  au.raw_user_meta_data->>'full_name',
  SPLIT_PART(u.email, '@', 1)
)
FROM auth.users au
WHERE u.id = au.id
  AND (u.display_name IS NULL OR u.display_name = '');

-- Check if it worked
SELECT 'After Fix:' as status, email, display_name
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- =================================
-- STEP 3: CREATE YOUR USER RECORD (if missing)
-- =================================
-- Only run this if you don't exist in public.users

INSERT INTO public.users (id, email, discord_id, discord_username, display_name, avatar_url)
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data->>'provider_id',
  CASE WHEN au.raw_app_meta_data->>'provider' = 'discord'
    THEN au.raw_user_meta_data->>'full_name'
    ELSE NULL
  END,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    SPLIT_PART(au.email, '@', 1)
  ),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
LIMIT 1;

-- Verify it worked
SELECT 'Created User:' as status, email, display_name
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- =================================
-- STEP 4: CHECK RLS POLICIES
-- =================================

SELECT
  '=== STEP 4: RLS POLICIES ===' as step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users';

-- EXPECTED: Should see "Profiles are viewable by everyone" policy
-- IF NO POLICIES: Continue to Step 5

-- =================================
-- STEP 5: FIX RLS POLICIES
-- =================================
-- Run this if Step 4 showed no policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Verify policies are active
SELECT 'Policies Created:' as status, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users';

-- =================================
-- STEP 6: TEST THE QUERY
-- =================================
-- This simulates what your app is doing

SELECT
  '=== STEP 6: SIMULATED APP QUERY ===' as step,
  tm.user_id,
  tm.team_id,
  tm.user_email,
  u.display_name,
  u.discord_username,
  COALESCE(
    u.display_name,
    u.discord_username,
    'Unknown User'
  ) as what_will_show
FROM team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE tm.team_id = 'ninja'
ORDER BY tm.joined_at DESC;

-- EXPECTED: what_will_show should be your name, not "Unknown User"
-- IF "Unknown User": Your display_name is NULL - rerun Step 2

-- =================================
-- STEP 7: MANUAL SET (if all else fails)
-- =================================
-- Replace YOUR_EMAIL and YOUR_NAME

-- UPDATE public.users
-- SET display_name = 'YOUR_NAME'
-- WHERE email = 'YOUR_EMAIL';

-- =================================
-- FINAL VERIFICATION
-- =================================

SELECT
  '=== FINAL CHECK ===' as step,
  u.email,
  u.display_name,
  u.discord_username,
  tm.team_id,
  CASE
    WHEN u.display_name IS NOT NULL THEN '✓ Display name is set'
    WHEN u.discord_username IS NOT NULL THEN '✓ Discord username is set'
    ELSE '✗ BOTH ARE NULL - manually set display_name'
  END as status
FROM public.users u
LEFT JOIN team_members tm ON u.id = tm.user_id
WHERE tm.team_id = 'ninja'
ORDER BY tm.joined_at DESC;

-- =================================
-- SUCCESS MESSAGE
-- =================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'After running the steps above:';
  RAISE NOTICE '1. Check FINAL CHECK results';
  RAISE NOTICE '2. If status shows checkmarks, hard refresh browser';
  RAISE NOTICE '3. If status shows X, manually set display_name in Step 7';
  RAISE NOTICE '';
  RAISE NOTICE 'Hard Refresh:';
  RAISE NOTICE '- Windows/Linux: Ctrl + Shift + R';
  RAISE NOTICE '- Mac: Cmd + Shift + R';
  RAISE NOTICE '';
END $$;
