-- =================================
-- COMPREHENSIVE FIX: Add all missing columns
-- Run this in Supabase SQL Editor
-- =================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fix team_members table
DO $$
BEGIN
  -- Add user_email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'team_members'
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE team_members ADD COLUMN user_email text;
    RAISE NOTICE 'Added user_email column to team_members table';
  END IF;

  -- Add joined_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'team_members'
    AND column_name = 'joined_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN joined_at timestamp with time zone DEFAULT now();
    RAISE NOTICE 'Added joined_at column to team_members table';
  END IF;
END $$;

-- Create indexes for team_members if they don't exist
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id);

-- Fix card_pools table
DO $$
BEGIN
  -- Add pool_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'card_pools'
    AND column_name = 'pool_name'
  ) THEN
    ALTER TABLE card_pools ADD COLUMN pool_name text DEFAULT 'default';
    RAISE NOTICE 'Added pool_name column to card_pools table';
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'card_pools'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE card_pools ADD COLUMN created_by uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Added created_by column to card_pools table';
  END IF;
END $$;

-- Create indexes for card_pools if they don't exist
CREATE INDEX IF NOT EXISTS card_pools_pool_name_idx ON card_pools(pool_name);
CREATE INDEX IF NOT EXISTS card_pools_card_name_idx ON card_pools(card_name);

-- Update any NULL values
UPDATE team_members SET joined_at = now() WHERE joined_at IS NULL;
UPDATE card_pools SET pool_name = 'default' WHERE pool_name IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All missing columns have been added successfully!';
END $$;
