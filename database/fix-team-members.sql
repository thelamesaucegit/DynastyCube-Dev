-- =================================
-- FIX: Add user_email column to team_members table
-- Run this in Supabase SQL Editor
-- =================================

-- Add the user_email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'team_members'
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE team_members ADD COLUMN user_email text;
    RAISE NOTICE 'Added user_email column to team_members table';
  ELSE
    RAISE NOTICE 'user_email column already exists in team_members table';
  END IF;
END $$;

-- Update existing rows to populate user_email from auth.users if possible
-- (This requires reading from auth.users which may need service role permissions)
-- For now, just ensure the column exists
