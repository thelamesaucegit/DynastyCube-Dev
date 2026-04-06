-- =================================
-- CUBUCKS ECONOMY SYSTEM
-- Currency system for card drafting
-- =================================

-- =================================
-- 1. ADD CUBUCKS TO TEAMS
-- =================================
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS cubucks_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cubucks_total_earned integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cubucks_total_spent integer DEFAULT 0;

COMMENT ON COLUMN teams.cubucks_balance IS 'Current available Cubucks for this team';
COMMENT ON COLUMN teams.cubucks_total_earned IS 'Total Cubucks earned all-time';
COMMENT ON COLUMN teams.cubucks_total_spent IS 'Total Cubucks spent all-time';

-- =================================
-- 2. ADD COSTS TO CARD POOLS
-- =================================
ALTER TABLE card_pools
ADD COLUMN IF NOT EXISTS cubucks_cost integer DEFAULT 0;

COMMENT ON COLUMN card_pools.cubucks_cost IS 'Cost in Cubucks to draft this card';

-- Create index for cost-based queries
CREATE INDEX IF NOT EXISTS card_pools_cubucks_cost_idx ON card_pools(cubucks_cost);

-- =================================
-- 3. SEASONS TABLE
-- Track different seasons/periods
-- =================================
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_number integer NOT NULL UNIQUE,
  season_name text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  cubucks_allocation integer DEFAULT 45, -- Default Cubucks per team (season cap)
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE seasons IS 'Draft seasons/periods';
COMMENT ON COLUMN seasons.cubucks_allocation IS 'Cubucks given to each team at start of season';

-- Create index for active season queries
CREATE INDEX IF NOT EXISTS seasons_is_active_idx ON seasons(is_active);
CREATE INDEX IF NOT EXISTS seasons_season_number_idx ON seasons(season_number);

-- =================================
-- 4. CUBUCKS TRANSACTIONS TABLE
-- Track all Cubucks movements
-- =================================
CREATE TABLE IF NOT EXISTS cubucks_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('allocation', 'draft_pick', 'refund', 'adjustment')),
  amount integer NOT NULL, -- Positive for credits, negative for debits
  balance_after integer NOT NULL,
  card_id text, -- If related to a card draft
  card_name text,
  draft_pick_id uuid REFERENCES team_draft_picks(id) ON DELETE SET NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE cubucks_transactions IS 'Audit log of all Cubucks transactions';
COMMENT ON COLUMN cubucks_transactions.transaction_type IS 'Type: allocation, draft_pick, refund, adjustment';
COMMENT ON COLUMN cubucks_transactions.amount IS 'Positive for earning, negative for spending';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS cubucks_transactions_team_id_idx ON cubucks_transactions(team_id);
CREATE INDEX IF NOT EXISTS cubucks_transactions_season_id_idx ON cubucks_transactions(season_id);
CREATE INDEX IF NOT EXISTS cubucks_transactions_type_idx ON cubucks_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS cubucks_transactions_created_at_idx ON cubucks_transactions(created_at DESC);

-- =================================
-- 5. TEAM SEASON STATS TABLE
-- Track team performance per season
-- =================================
CREATE TABLE IF NOT EXISTS team_season_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,
  starting_cubucks integer DEFAULT 0,
  current_cubucks integer DEFAULT 0,
  cubucks_spent integer DEFAULT 0,
  cards_drafted integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, season_id)
);

COMMENT ON TABLE team_season_stats IS 'Team statistics per season';

-- Create indexes
CREATE INDEX IF NOT EXISTS team_season_stats_team_id_idx ON team_season_stats(team_id);
CREATE INDEX IF NOT EXISTS team_season_stats_season_id_idx ON team_season_stats(season_id);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Enable RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cubucks_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_season_stats ENABLE ROW LEVEL SECURITY;

-- Seasons: Everyone can read
CREATE POLICY "Seasons are viewable by everyone"
  ON seasons FOR SELECT
  USING (true);

CREATE POLICY "Seasons are editable by admins only"
  ON seasons FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'service_role');

-- Transactions: Everyone can read, authenticated can insert (via functions)
CREATE POLICY "Transactions are viewable by everyone"
  ON cubucks_transactions FOR SELECT
  USING (true);

CREATE POLICY "Transactions can be created by authenticated users"
  ON cubucks_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Team season stats: Everyone can read
CREATE POLICY "Team season stats are viewable by everyone"
  ON team_season_stats FOR SELECT
  USING (true);

CREATE POLICY "Team season stats are editable by authenticated users"
  ON team_season_stats FOR ALL
  TO authenticated
  USING (true);

-- =================================
-- HELPER FUNCTIONS
-- =================================

-- Function to get active season
CREATE OR REPLACE FUNCTION get_active_season()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  active_season_id uuid;
BEGIN
  SELECT id INTO active_season_id
  FROM seasons
  WHERE is_active = true
  LIMIT 1;

  RETURN active_season_id;
END;
$$;

-- Function to allocate Cubucks to a team (with season cap enforcement)
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
    RAISE EXCEPTION 'Team is already at or above the season cap of % Cubucks', v_cap;
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
    COALESCE(p_description, 'Cubucks allocation'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- Function to spend Cubucks on a draft pick
CREATE OR REPLACE FUNCTION spend_cubucks_on_draft(
  p_team_id text,
  p_amount integer,
  p_card_id text,
  p_card_name text,
  p_draft_pick_id uuid DEFAULT NULL,
  p_season_id uuid DEFAULT NULL
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

  RETURN v_transaction_id;
END;
$$;

-- =================================
-- INITIAL DATA
-- =================================

-- Create Season 1 if no seasons exist
INSERT INTO seasons (season_number, season_name, start_date, cubucks_allocation, is_active)
SELECT 1, 'Season 1', NOW(), 45, true
WHERE NOT EXISTS (SELECT 1 FROM seasons LIMIT 1);

-- Give all existing teams their starting Cubucks
DO $$
DECLARE
  team_record RECORD;
  season_id uuid;
BEGIN
  -- Get the active season
  SELECT id INTO season_id FROM seasons WHERE is_active = true LIMIT 1;

  IF season_id IS NOT NULL THEN
    -- Allocate to each team that has 0 balance
    FOR team_record IN SELECT id, name FROM teams WHERE cubucks_balance = 0 LOOP
      PERFORM allocate_cubucks_to_team(
        team_record.id,
        45, -- Starting allocation (season cap)
        season_id,
        'Initial Season 1 allocation',
        NULL
      );
      RAISE NOTICE 'Allocated 45 Cubucks to team: %', team_record.name;
    END LOOP;
  END IF;
END $$;
