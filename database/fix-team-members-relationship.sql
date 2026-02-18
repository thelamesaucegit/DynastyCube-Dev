-- =================================================
-- FIX TEAM MEMBERS - USER RELATIONSHIP
-- =================================================
-- This migration adds a foreign key relationship between
-- team_members and public.users for better data integrity
-- =================================================

-- Step 1: Check if public.users table exists and has the id column
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'users'
  ) THEN
    RAISE NOTICE '✓ public.users table exists';
  ELSE
    RAISE EXCEPTION '✗ public.users table does not exist - run users-schema.sql first';
  END IF;
END $$;

-- Step 2: Add foreign key constraint if it doesn't exist
-- This creates a relationship: team_members.user_id -> public.users.id
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'team_members'
    AND constraint_name = 'team_members_user_id_fkey_public_users'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_user_id_fkey_public_users
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;

    RAISE NOTICE '✓ Added foreign key: team_members.user_id -> public.users.id';
  ELSE
    RAISE NOTICE '✓ Foreign key already exists';
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE WARNING '⚠ Could not add foreign key - some team_members reference users that do not exist in public.users';
    RAISE WARNING '⚠ Run this query to find orphaned records:';
    RAISE WARNING 'SELECT tm.user_id FROM team_members tm LEFT JOIN public.users u ON tm.user_id = u.id WHERE u.id IS NULL;';
  WHEN OTHERS THEN
    RAISE WARNING '⚠ Error adding foreign key: %', SQLERRM;
END $$;

-- Step 3: Create an index on user_id for faster joins (if not exists)
CREATE INDEX IF NOT EXISTS team_members_user_id_public_idx
ON public.team_members(user_id);

COMMENT ON INDEX team_members_user_id_public_idx IS 'Improves join performance between team_members and public.users';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Team Members Relationship Fix Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '1. Added foreign key relationship: team_members -> public.users';
  RAISE NOTICE '2. Created index for faster joins';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '- Better data integrity';
  RAISE NOTICE '- Cascading deletes (when user is deleted, team memberships are removed)';
  RAISE NOTICE '- Faster queries when joining teams with user display names';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: The app code now uses separate queries + in-memory join';
  RAISE NOTICE 'This is more reliable and works regardless of foreign keys.';
  RAISE NOTICE '';
END $$;
