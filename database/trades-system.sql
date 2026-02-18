-- =================================
-- DYNASTY CUBE TRADE SYSTEM
-- =================================
-- Features:
-- - Trade cards between teams
-- - Trade future draft picks
-- - Message system for negotiations
-- - Notification system
-- - Trade deadlines (1-7 days)
-- - Admin controls to enable/disable trades
-- =================================

-- =================================
-- 1. SYSTEM SETTINGS TABLE
-- Store global settings like trade enabled/disabled
-- =================================
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default setting for trades
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('trades_enabled', 'true', 'Enable or disable the trade system globally')
ON CONFLICT (setting_key) DO NOTHING;

-- =================================
-- 2. TRADES TABLE
-- Core trade proposals
-- =================================
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_team_id text REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id text REFERENCES teams(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  deadline timestamp with time zone NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT different_teams CHECK (from_team_id != to_team_id)
);

CREATE INDEX IF NOT EXISTS trades_from_team_idx ON trades(from_team_id);
CREATE INDEX IF NOT EXISTS trades_to_team_idx ON trades(to_team_id);
CREATE INDEX IF NOT EXISTS trades_status_idx ON trades(status);
CREATE INDEX IF NOT EXISTS trades_deadline_idx ON trades(deadline);

COMMENT ON TABLE trades IS 'Trade proposals between teams';
COMMENT ON COLUMN trades.status IS 'pending, accepted, rejected, cancelled, expired';
COMMENT ON COLUMN trades.deadline IS 'When the trade offer expires';

-- =================================
-- 3. TRADE ITEMS TABLE
-- Items being traded (cards or draft picks)
-- =================================
CREATE TABLE IF NOT EXISTS trade_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  offering_team_id text REFERENCES teams(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('card', 'draft_pick')),

  -- For cards
  draft_pick_id uuid REFERENCES team_draft_picks(id) ON DELETE CASCADE,
  card_id text,
  card_name text,

  -- For draft picks
  draft_pick_round integer,
  draft_pick_season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,

  created_at timestamp with time zone DEFAULT now(),

  -- Ensure either card or draft pick is specified
  CONSTRAINT item_specified CHECK (
    (item_type = 'card' AND draft_pick_id IS NOT NULL) OR
    (item_type = 'draft_pick' AND draft_pick_round IS NOT NULL AND draft_pick_season_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS trade_items_trade_idx ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS trade_items_offering_team_idx ON trade_items(offering_team_id);
CREATE INDEX IF NOT EXISTS trade_items_type_idx ON trade_items(item_type);

COMMENT ON TABLE trade_items IS 'Items (cards or draft picks) being traded';
COMMENT ON COLUMN trade_items.item_type IS 'card or draft_pick';
COMMENT ON COLUMN trade_items.draft_pick_round IS 'Round number for future draft picks (e.g., 2 for 2nd round)';

-- =================================
-- 4. TRADE MESSAGES TABLE
-- Message/negotiation system for trades
-- =================================
CREATE TABLE IF NOT EXISTS trade_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_messages_trade_idx ON trade_messages(trade_id);
CREATE INDEX IF NOT EXISTS trade_messages_user_idx ON trade_messages(user_id);
CREATE INDEX IF NOT EXISTS trade_messages_created_at_idx ON trade_messages(created_at DESC);

COMMENT ON TABLE trade_messages IS 'Messages and negotiations for trade proposals';

-- =================================
-- 5. NOTIFICATIONS TABLE
-- Notify captains and brokers about trades
-- =================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('trade_proposal', 'trade_accepted', 'trade_rejected', 'trade_message', 'trade_expired')),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_trade_idx ON notifications(trade_id);

COMMENT ON TABLE notifications IS 'User notifications for trade activities';

-- =================================
-- 6. FUTURE DRAFT PICKS TABLE
-- Track future draft picks that can be traded
-- =================================
CREATE TABLE IF NOT EXISTS future_draft_picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  original_team_id text REFERENCES teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number > 0),
  is_traded boolean DEFAULT false,
  traded_to_team_id text REFERENCES teams(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(original_team_id, season_id, round_number)
);

CREATE INDEX IF NOT EXISTS future_draft_picks_team_idx ON future_draft_picks(team_id);
CREATE INDEX IF NOT EXISTS future_draft_picks_season_idx ON future_draft_picks(season_id);
CREATE INDEX IF NOT EXISTS future_draft_picks_traded_idx ON future_draft_picks(is_traded);

COMMENT ON TABLE future_draft_picks IS 'Future draft picks that can be traded';
COMMENT ON COLUMN future_draft_picks.team_id IS 'Current owner of the pick';
COMMENT ON COLUMN future_draft_picks.original_team_id IS 'Original team that had the pick';

-- =================================
-- 7. HELPER FUNCTIONS
-- =================================

-- Function to create a trade notification for team captains and brokers
CREATE OR REPLACE FUNCTION notify_team_roles(
  p_team_id text,
  p_notification_type text,
  p_trade_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_member RECORD;
BEGIN
  -- Get all captains and brokers for the team
  FOR v_member IN
    SELECT DISTINCT user_id
    FROM team_members
    WHERE team_id = p_team_id
      AND (role = 'captain' OR role = 'broker')
  LOOP
    INSERT INTO notifications (user_id, notification_type, trade_id, message)
    VALUES (v_member.user_id, p_notification_type, p_trade_id, p_message);
  END LOOP;
END;
$$;

-- Function to check if trades are enabled
CREATE OR REPLACE FUNCTION are_trades_enabled()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT setting_value::boolean INTO v_enabled
  FROM system_settings
  WHERE setting_key = 'trades_enabled';

  RETURN COALESCE(v_enabled, false);
END;
$$;

-- Function to expire old trade proposals
CREATE OR REPLACE FUNCTION expire_old_trades()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trade RECORD;
BEGIN
  FOR v_trade IN
    SELECT id, from_team_id, to_team_id
    FROM trades
    WHERE status = 'pending'
      AND deadline < now()
  LOOP
    -- Update trade status
    UPDATE trades
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_trade.id;

    -- Notify both teams
    PERFORM notify_team_roles(
      v_trade.from_team_id,
      'trade_expired',
      v_trade.id,
      'Your trade proposal has expired.'
    );

    PERFORM notify_team_roles(
      v_trade.to_team_id,
      'trade_expired',
      v_trade.id,
      'A trade proposal to your team has expired.'
    );
  END LOOP;
END;
$$;

-- Function to execute a trade (transfer items)
CREATE OR REPLACE FUNCTION execute_trade(p_trade_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_trade RECORD;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;

  IF v_trade.status != 'accepted' THEN
    RAISE EXCEPTION 'Trade must be accepted to execute';
  END IF;

  -- Process each trade item
  FOR v_item IN
    SELECT * FROM trade_items WHERE trade_id = p_trade_id
  LOOP
    IF v_item.item_type = 'card' THEN
      -- Transfer card ownership
      UPDATE team_draft_picks
      SET team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END
      WHERE id = v_item.draft_pick_id;

    ELSIF v_item.item_type = 'draft_pick' THEN
      -- Transfer future draft pick
      UPDATE future_draft_picks
      SET team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END,
      is_traded = true,
      traded_to_team_id = CASE
        WHEN v_item.offering_team_id = v_trade.from_team_id THEN v_trade.to_team_id
        ELSE v_trade.from_team_id
      END,
      trade_id = p_trade_id
      WHERE original_team_id = v_item.offering_team_id
        AND season_id = v_item.draft_pick_season_id
        AND round_number = v_item.draft_pick_round;
    END IF;
  END LOOP;

  -- Mark trade as completed
  UPDATE trades
  SET completed_at = now(),
      updated_at = now()
  WHERE id = p_trade_id;
END;
$$;

-- =================================
-- 8. ROW LEVEL SECURITY
-- =================================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE future_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Trades policies
CREATE POLICY "Trades are viewable by involved teams"
  ON trades FOR SELECT
  USING (
    from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Trades can be created by team members"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (
    from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    AND are_trades_enabled()
  );

CREATE POLICY "Trades can be updated by involved teams"
  ON trades FOR UPDATE
  TO authenticated
  USING (
    from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Trade items policies
CREATE POLICY "Trade items are viewable by involved teams"
  ON trade_items FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM trades
      WHERE from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Trade items can be created with trades"
  ON trade_items FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM trades
      WHERE from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

-- Trade messages policies
CREATE POLICY "Trade messages are viewable by involved teams"
  ON trade_messages FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM trades
      WHERE from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Trade messages can be created by involved teams"
  ON trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM trades
      WHERE from_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Future draft picks policies
CREATE POLICY "Future draft picks are viewable by everyone"
  ON future_draft_picks FOR SELECT
  USING (true);

CREATE POLICY "Future draft picks can be created by authenticated users"
  ON future_draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- System settings policies
CREATE POLICY "System settings are viewable by everyone"
  ON system_settings FOR SELECT
  USING (true);

CREATE POLICY "System settings can be updated by authenticated users"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (true);

-- =================================
-- 9. VIEWS FOR EASY QUERYING
-- =================================

-- View for active trades with team names
CREATE OR REPLACE VIEW active_trades_view AS
SELECT
  t.id,
  t.from_team_id,
  ft.name as from_team_name,
  ft.emoji as from_team_emoji,
  t.to_team_id,
  tt.name as to_team_name,
  tt.emoji as to_team_emoji,
  t.status,
  t.deadline,
  t.created_at,
  t.updated_at,
  EXTRACT(EPOCH FROM (t.deadline - now())) / 3600 as hours_remaining
FROM trades t
JOIN teams ft ON t.from_team_id = ft.id
JOIN teams tt ON t.to_team_id = tt.id
WHERE t.status IN ('pending', 'accepted')
ORDER BY t.created_at DESC;

COMMENT ON VIEW active_trades_view IS 'Active trades with team names and time remaining';

-- View for notification counts per user
CREATE OR REPLACE VIEW notification_counts_view AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM notifications
GROUP BY user_id;

COMMENT ON VIEW notification_counts_view IS 'Notification counts per user';
