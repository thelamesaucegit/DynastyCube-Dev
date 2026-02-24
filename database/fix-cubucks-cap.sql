-- =====================================================
-- FIX: Cubucks Cap — Set to 45, enforce in stored proc
-- =====================================================
-- The original system had a default of 1000 Cubucks per
-- team with no cap enforcement. This migration:
-- 1. Updates the active season allocation to 45
-- 2. Replaces the allocate_cubucks_to_team function with
--    a version that enforces the season cap
-- 3. Resets all team balances that exceed the new cap
-- =====================================================

-- Step 1: Update the active season's allocation to 45
UPDATE seasons
SET cubucks_allocation = 45,
    updated_at = NOW()
WHERE is_active = true;

-- Step 2: Replace the allocation function with cap enforcement
CREATE OR REPLACE FUNCTION allocate_cubucks_to_team(
  p_team_id text,
  p_amount integer,
  p_season_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_cap integer;
  v_effective_amount integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  -- Use provided season or get active season
  v_season_id := COALESCE(p_season_id, get_active_season());

  -- Get the season cap
  SELECT cubucks_allocation INTO v_cap
  FROM seasons
  WHERE id = v_season_id;

  -- Get current balance
  SELECT cubucks_balance INTO v_current_balance
  FROM teams
  WHERE id = p_team_id;

  -- Enforce cap: clamp the allocation so balance doesn't exceed the cap
  v_effective_amount := p_amount;
  IF v_cap IS NOT NULL AND v_current_balance + p_amount > v_cap THEN
    v_effective_amount := GREATEST(0, v_cap - v_current_balance);
  END IF;

  -- If nothing to allocate, skip
  IF v_effective_amount <= 0 THEN
    RAISE EXCEPTION 'Team is already at or above the season cap of % Çubucks', v_cap;
  END IF;

  -- Update team balance
  UPDATE teams
  SET
    cubucks_balance = cubucks_balance + v_effective_amount,
    cubucks_total_earned = cubucks_total_earned + v_effective_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO cubucks_transactions (
    team_id,
    season_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_team_id,
    v_season_id,
    'allocation',
    v_effective_amount,
    v_new_balance,
    COALESCE(p_description, 'Çubucks allocation'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- Step 3: Reset all teams that are above the 45 cap
-- This sets their balance to 45 and logs an adjustment transaction
DO $$
DECLARE
  team_record RECORD;
  v_season_id uuid;
  v_new_earned integer;
BEGIN
  -- Get the active season
  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;

  FOR team_record IN
    SELECT id, name, cubucks_balance, cubucks_total_earned, cubucks_total_spent
    FROM teams
    WHERE cubucks_balance > 45
  LOOP
    -- Calculate what total_earned should be so the math stays consistent
    v_new_earned := 45 + team_record.cubucks_total_spent;

    -- Reset the balance
    UPDATE teams
    SET cubucks_balance = 45,
        cubucks_total_earned = v_new_earned
    WHERE id = team_record.id;

    -- Log the adjustment
    INSERT INTO cubucks_transactions (
      team_id, season_id, transaction_type, amount, balance_after, description
    ) VALUES (
      team_record.id,
      v_season_id,
      'adjustment',
      45 - team_record.cubucks_balance,
      45,
      'Balance reset to season cap (45). Was ' || team_record.cubucks_balance || '.'
    );

    RAISE NOTICE 'Reset team % from % to 45 Çubucks', team_record.name, team_record.cubucks_balance;
  END LOOP;
END $$;
