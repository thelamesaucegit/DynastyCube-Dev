-- =================================================
-- FIX USERS TABLE RLS POLICY
-- =================================================
-- Fixes "permission denied for table users" error
-- This enables authenticated users to read display names
-- =================================================

-- Step 1: Enable RLS on users table (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies (if they exist) and recreate them
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Step 3: Create SELECT policy - EVERYONE can view all profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);

COMMENT ON POLICY "Profiles are viewable by everyone" ON public.users IS
  'All users can view all profiles - display names are public information';

-- Step 4: Create INSERT policy - Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can insert their own profile" ON public.users IS
  'Users can only create their own profile record';

-- Step 5: Create UPDATE policy - Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      -- Prevent non-admins from changing is_admin
      is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
      OR
      -- Allow admins to change is_admin
      (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
    )
  );

COMMENT ON POLICY "Users can update their own profile" ON public.users IS
  'Users can update their own profile, but cannot grant themselves admin access';

-- Step 6: Verify policies are active
DO $$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ USERS TABLE RLS POLICIES FIXED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Active policies on public.users: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '1. ✓ RLS enabled on public.users table';
  RAISE NOTICE '2. ✓ SELECT policy: Everyone can view profiles';
  RAISE NOTICE '3. ✓ INSERT policy: Users can create their own profile';
  RAISE NOTICE '4. ✓ UPDATE policy: Users can update their own profile';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes the "permission denied for table users" error!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Hard refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '2. Check the messages page - error should be gone';
  RAISE NOTICE '3. Check team pages - display names should appear';
  RAISE NOTICE '';
END $$;

-- Step 7: Show current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY policyname;
