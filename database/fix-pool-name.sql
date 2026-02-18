-- =================================
-- FIX: Add pool_name column to card_pools table
-- Run this in Supabase SQL Editor
-- =================================

-- Add the pool_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'card_pools'
    AND column_name = 'pool_name'
  ) THEN
    ALTER TABLE card_pools ADD COLUMN pool_name text DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS card_pools_pool_name_idx ON card_pools(pool_name);
    RAISE NOTICE 'Added pool_name column to card_pools table';
  ELSE
    RAISE NOTICE 'pool_name column already exists in card_pools table';
  END IF;
END $$;

-- Update existing rows to have 'default' pool_name if NULL
UPDATE card_pools SET pool_name = 'default' WHERE pool_name IS NULL;
