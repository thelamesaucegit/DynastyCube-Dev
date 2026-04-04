-- =================================================
-- FIX SPEND_CUBUCKS_ON_DRAFT FUNCTION
-- =================================================
-- Run this in your Supabase SQL Editor to fix the drafting error:
-- "Could not find the function public.spend_cubucks_on_draft"
-- =================================================

-- First, add missing columns if they don't exist
ALTER TABLE card_pools ADD COLUMN IF NOT EXISTS was_drafted boolean DEFAULT false;
ALTER TABLE card_pools ADD COLUMN IF NOT EXISTS times_drafted integer DEFAULT 0;

-- Add to card_season_costs if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'card_season_costs') THEN
    ALTER TABLE card_season_costs ADD COLUMN IF NOT EXISTS was_drafted boolean DEFAULT false;
    ALTER TABLE card_season_costs ADD COLUMN IF NOT EXISTS times_drafted integer DEFAULT 0;
  END IF;
END $$;

-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS spend_cubucks_on_draft(text, integer, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS spend_cubucks_on_draft(text, integer, text, text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.spend_cubucks_on_draft(text, integer, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.spend_cubucks_on_draft(text, integer, text, text, uuid, uuid, uuid);

-- Create the mark_card_drafted function if it doesn't exist
CREATE OR REPLACE FUNCTION mark_card_drafted(
  p_card_pool_id uuid,
  p_season_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(p_season_id, get_active_season());

  -- Update the card_pools table to mark as drafted
  UPDATE card_pools
  SET
    was_drafted = true,
    times_drafted = COALESCE(times_drafted, 0) + 1
  WHERE id = p_card_pool_id;

  -- Update card_season_costs if it exists
  UPDATE card_season_costs
  SET
    was_drafted = true,
    times_drafted = COALESCE(times_drafted, 0) + 1
  WHERE card_pool_id = p_card_pool_id
    AND season_id = v_season_id;
END;
$$;

-- Create the updated spend_cubucks_on_draft function with p_card_pool_id parameter
CREATE OR REPLACE FUNCTION spend_cubucks_on_draft(
  p_team_id text,
  p_amount integer,
  p_card_id text,
  p_card_name text,
  p_draft_pick_id uuid DEFAULT NULL,
  p_season_id uuid DEFAULT NULL,
  p_card_pool_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  -- Use provided season or get active season
  v_season_id := COALESCE(p_season_id, get_active_season());

  -- Check current balance
  SELECT cubucks_balance INTO v_current_balance
  FROM teams
  WHERE id = p_team_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Cubucks. Balance: %, Cost: %', v_current_balance, p_amount;
  END IF;

  -- Update team balance
  UPDATE teams
  SET
    cubucks_balance = cubucks_balance - p_amount,
    cubucks_total_spent = COALESCE(cubucks_total_spent, 0) + p_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO cubucks_transactions (
    team_id,
    season_id,
    transaction_type,
    amount,
    balance_after,
    card_id,
    card_name,
    draft_pick_id,
    description
  ) VALUES (
    p_team_id,
    v_season_id,
    'draft_pick',
    -p_amount,
    v_new_balance,
    p_card_id,
    p_card_name,
    p_draft_pick_id,
    'Drafted ' || p_card_name
  ) RETURNING id INTO v_transaction_id;

  -- Mark card as drafted in this season (if card_pool_id provided)
  IF p_card_pool_id IS NOT NULL THEN
    PERFORM mark_card_drafted(p_card_pool_id, v_season_id);
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION spend_cubucks_on_draft IS 'Spend Cubucks on a draft pick, optionally marking the card as drafted';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ spend_cubucks_on_draft function created successfully!';
  RAISE NOTICE 'Drafting cards should now work correctly.';
END $$;
