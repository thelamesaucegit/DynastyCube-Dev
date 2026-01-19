-- Migration: Fix users table RLS policies
-- Date: 2025-01-17
-- Description: Ensure the users table has proper RLS policies so authenticated users can read profiles

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Allow everyone to read user profiles (needed for displaying names in UI)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      is_admin = (SELECT is_admin FROM public.users WHERE id = auth.uid())
      OR
      (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
    )
  );

-- Verify the policies were created
DO $$
BEGIN
  RAISE NOTICE 'Users table RLS policies have been updated';
  RAISE NOTICE 'Run this query to verify: SELECT * FROM pg_policies WHERE tablename = ''users'';';
END $$;
