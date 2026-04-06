-- =================================
-- CUBUCKS DYNAMIC PRICING SYSTEM
-- Cards start at 1 Cubuck
-- +1 if drafted last season
-- -1 if not drafted last season (min 1)
-- =================================

-- =================================
-- 1. CARD SEASON HISTORY TABLE
-- Track card costs per season
-- =================================
CREATE TABLE IF NOT EXISTS card_season_costs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_pool_id uuid REFERENCES card_pools(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,
  cost integer NOT NULL CHECK (cost >= 1),
  was_drafted boolean DEFAULT false,
  times_drafted integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(card_pool_id, season_id)
);

CREATE INDEX IF NOT EXISTS card_season_costs_card_pool_id_idx ON card_season_costs(card_pool_id);
CREATE INDEX IF NOT EXISTS card_season_costs_season_id_idx ON card_season_costs(season_id);
CREATE INDEX IF NOT EXISTS card_season_costs_was_drafted_idx ON card_season_costs(was_drafted);

COMMENT ON TABLE card_season_costs IS 'Track card costs per season for dynamic pricing';
COMMENT ON COLUMN card_season_costs.was_drafted IS 'Whether this card was drafted at least once this season';
COMMENT ON COLUMN card_season_costs.times_drafted IS 'Number of times drafted this season';

-- =================================
-- 2. ENABLE RLS
-- =================================
ALTER TABLE card_season_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card season costs are viewable by everyone"
  ON card_season_costs FOR SELECT
  USING (true);

CREATE POLICY "Card season costs are editable by authenticated users"
  ON card_season_costs FOR ALL
  TO authenticated
  USING (true);

-- =================================
-- 3. INITIALIZE CURRENT SEASON COSTS
-- Set all cards to 1 Cubuck for active season
-- =================================
CREATE OR REPLACE FUNCTION initialize_season_card_costs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_season_id uuid;
  v_card_record RECORD;
BEGIN
  -- Get active season
  SELECT id INTO v_active_season_id
  FROM seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_active_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;

  -- Initialize all cards at 1 Cubuck
  FOR v_card_record IN SELECT id FROM card_pools LOOP
    INSERT INTO card_season_costs (card_pool_id, season_id, cost, was_drafted, times_drafted)
    VALUES (v_card_record.id, v_active_season_id, 1, false, 0)
    ON CONFLICT (card_pool_id, season_id) DO NOTHING;
  END LOOP;

  -- Update card_pools with current costs
  UPDATE card_pools cp
  SET cubucks_cost = csc.cost
  FROM card_season_costs csc
  WHERE cp.id = csc.card_pool_id
    AND csc.season_id = v_active_season_id;

  RAISE NOTICE 'Initialized card costs for season %', v_active_season_id;
END;
$$;

-- =================================
-- 4. SEASON ROLLOVER FUNCTION
-- Calculate new costs based on previous season
-- =================================
CREATE OR REPLACE FUNCTION rollover_card_costs_for_new_season(
  p_new_season_id uuid,
  p_previous_season_id uuid DEFAULT NULL
)
RETURNS TABLE (
  card_id uuid,
  card_name text,
  old_cost integer,
  new_cost integer,
  was_drafted boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev_season_id uuid;
  v_card_record RECORD;
  v_old_cost integer;
  v_new_cost integer;
  v_was_drafted boolean;
  v_times_drafted integer;
BEGIN
  -- Use provided previous season or get the last active one
  IF p_previous_season_id IS NULL THEN
    SELECT id INTO v_prev_season_id
    FROM seasons
    WHERE id != p_new_season_id
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    v_prev_season_id := p_previous_season_id;
  END IF;

  IF v_prev_season_id IS NULL THEN
    RAISE EXCEPTION 'No previous season found';
  END IF;

  -- Process each card
  FOR v_card_record IN
    SELECT
      cp.id as pool_id,
      cp.card_name,
      COALESCE(csc.cost, 1) as prev_cost,
      COALESCE(csc.was_drafted, false) as prev_drafted,
      COALESCE(csc.times_drafted, 0) as prev_times
    FROM card_pools cp
    LEFT JOIN card_season_costs csc
      ON cp.id = csc.card_pool_id
      AND csc.season_id = v_prev_season_id
  LOOP
    v_old_cost := v_card_record.prev_cost;
    v_was_drafted := v_card_record.prev_drafted;

    -- Calculate new cost
    IF v_was_drafted THEN
      -- Card was drafted: increase cost by 1
      v_new_cost := v_old_cost + 1;
    ELSE
      -- Card was NOT drafted: decrease cost by 1 (minimum 1)
      v_new_cost := GREATEST(v_old_cost - 1, 1);
    END IF;

    -- Insert new season cost
    INSERT INTO card_season_costs (
      card_pool_id,
      season_id,
      cost,
      was_drafted,
      times_drafted
    ) VALUES (
      v_card_record.pool_id,
      p_new_season_id,
      v_new_cost,
      false,  -- Reset for new season
      0       -- Reset for new season
    )
    ON CONFLICT (card_pool_id, season_id)
    DO UPDATE SET
      cost = v_new_cost,
      updated_at = now();

    -- Update card_pools current cost
    UPDATE card_pools
    SET cubucks_cost = v_new_cost
    WHERE id = v_card_record.pool_id;

    -- Return info
    card_id := v_card_record.pool_id;
    card_name := v_card_record.card_name;
    old_cost := v_old_cost;
    new_cost := v_new_cost;
    was_drafted := v_was_drafted;
    RETURN NEXT;
  END LOOP;

  RAISE NOTICE 'Rolled over costs from season % to season %', v_prev_season_id, p_new_season_id;
END;
$$;

-- =================================
-- 5. MARK CARD AS DRAFTED
-- Update when a card is drafted
-- =================================
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
  -- Use provided season or get active season
  v_season_id := COALESCE(p_season_id, get_active_season());

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;

  -- Update the season cost record
  UPDATE card_season_costs
  SET
    was_drafted = true,
    times_drafted = times_drafted + 1,
    updated_at = now()
  WHERE card_pool_id = p_card_pool_id
    AND season_id = v_season_id;

  -- If record doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO card_season_costs (
      card_pool_id,
      season_id,
      cost,
      was_drafted,
      times_drafted
    )
    SELECT
      p_card_pool_id,
      v_season_id,
      GREATEST(COALESCE(cubucks_cost, 1), 1),  -- Ensure cost is at least 1
      true,
      1
    FROM card_pools
    WHERE id = p_card_pool_id;
  END IF;
END;
$$;

-- =================================
-- 6. UPDATE SPEND_CUBUCKS_ON_DRAFT
-- Mark card as drafted when purchased
-- =================================
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

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Cubucks. Balance: %, Cost: %', v_current_balance, p_amount;
  END IF;

  -- Update team balance
  UPDATE teams
  SET
    cubucks_balance = cubucks_balance - p_amount,
    cubucks_total_spent = cubucks_total_spent + p_amount
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

  -- Mark card as drafted in this season
  IF p_card_pool_id IS NOT NULL THEN
    PERFORM mark_card_drafted(p_card_pool_id, v_season_id);
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- =================================
-- 7. GET CARD COST FOR SEASON
-- =================================
CREATE OR REPLACE FUNCTION get_card_cost_for_season(
  p_card_pool_id uuid,
  p_season_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_season_id uuid;
  v_cost integer;
BEGIN
  v_season_id := COALESCE(p_season_id, get_active_season());

  SELECT cost INTO v_cost
  FROM card_season_costs
  WHERE card_pool_id = p_card_pool_id
    AND season_id = v_season_id;

  RETURN COALESCE(v_cost, 1);
END;
$$;

-- =================================
-- 8. VIEW: CARD PRICING HISTORY
-- =================================
CREATE OR REPLACE VIEW card_pricing_history AS
SELECT
  cp.id as card_pool_id,
  cp.card_name,
  cp.card_set,
  cp.rarity,
  s.season_number,
  s.season_name,
  csc.cost,
  csc.was_drafted,
  csc.times_drafted,
  csc.created_at
FROM card_pools cp
JOIN card_season_costs csc ON cp.id = csc.card_pool_id
JOIN seasons s ON csc.season_id = s.id
ORDER BY cp.card_name, s.season_number;

-- =================================
-- 9. INITIALIZE SEASON 1
-- Set all existing cards to 1 Cubuck
-- =================================

-- First, ensure all cards have at least cost 1 in card_pools
UPDATE card_pools
SET cubucks_cost = GREATEST(COALESCE(cubucks_cost, 1), 1)
WHERE cubucks_cost IS NULL OR cubucks_cost < 1;

-- Initialize season costs for all cards
SELECT initialize_season_card_costs();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Dynamic pricing system initialized! All cards start at 1 Cubuck.';
END $$;
