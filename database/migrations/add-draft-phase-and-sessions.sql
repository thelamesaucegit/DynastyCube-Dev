-- =============================================================================
-- MIGRATION: Add Draft Phase + Draft Sessions Table
-- Run this in the Supabase SQL Editor in one go.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- =============================================================================
-- STEP 1: Add 'phase' and 'phase_changed_at' columns to seasons table
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'phase'
  ) THEN
    ALTER TABLE seasons
    ADD COLUMN phase text DEFAULT 'preseason';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'phase_changed_at'
  ) THEN
    ALTER TABLE seasons
    ADD COLUMN phase_changed_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- Drop old check constraint (may only have 4 phases) and recreate with 'draft'
ALTER TABLE seasons
DROP CONSTRAINT IF EXISTS seasons_phase_check;

ALTER TABLE seasons
ADD CONSTRAINT seasons_phase_check
  CHECK (phase IN ('preseason', 'draft', 'season', 'playoffs', 'postseason'));

-- Backfill any NULL phases
UPDATE seasons SET phase = 'preseason' WHERE phase IS NULL;

COMMENT ON COLUMN seasons.phase IS 'Current phase: preseason, draft, season, playoffs, postseason';
COMMENT ON COLUMN seasons.phase_changed_at IS 'Timestamp of last phase change';

-- =============================================================================
-- STEP 2: Trigger to auto-update phase_changed_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_season_phase_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    NEW.phase_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seasons_phase_update ON seasons;
CREATE TRIGGER seasons_phase_update
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.phase IS DISTINCT FROM OLD.phase)
  EXECUTE FUNCTION update_season_phase_timestamp();

-- =============================================================================
-- STEP 3: Notification helper for phase changes
-- =============================================================================
CREATE OR REPLACE FUNCTION notify_users_of_phase_change(
  p_season_id uuid,
  p_old_phase text,
  p_new_phase text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message text;
  v_notification_count integer := 0;
BEGIN
  v_message := 'The season has moved to ' ||
    CASE p_new_phase
      WHEN 'preseason'  THEN 'Pre-Season'
      WHEN 'draft'      THEN 'Draft'
      WHEN 'season'     THEN 'Regular Season'
      WHEN 'playoffs'   THEN 'Playoffs'
      WHEN 'postseason' THEN 'Post-Season'
      ELSE p_new_phase
    END || '!';

  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  SELECT id, 'season_phase_change', NULL, v_message
  FROM public.users;

  GET DIAGNOSTICS v_notification_count = ROW_COUNT;
  RETURN v_notification_count;
END;
$$;

-- =============================================================================
-- STEP 4: RPC function to update season phase (called by the app)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_season_phase(
  p_season_id uuid,
  p_new_phase text
)
RETURNS TABLE (
  success boolean,
  old_phase text,
  new_phase text,
  notifications_sent integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_phase text;
  v_notifications_sent integer;
BEGIN
  SELECT phase INTO v_old_phase
  FROM seasons
  WHERE id = p_season_id;

  IF v_old_phase IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 0;
    RETURN;
  END IF;

  UPDATE seasons
  SET phase = p_new_phase, phase_changed_at = now()
  WHERE id = p_season_id;

  IF v_old_phase != p_new_phase THEN
    v_notifications_sent := notify_users_of_phase_change(p_season_id, v_old_phase, p_new_phase);
  ELSE
    v_notifications_sent := 0;
  END IF;

  RETURN QUERY SELECT true, v_old_phase, p_new_phase, v_notifications_sent;
END;
$$;

COMMENT ON FUNCTION update_season_phase IS 'Updates season phase (including draft) and notifies all users';

-- =============================================================================
-- STEP 5: Add season_phase_change notification type (if constraint exists)
-- =============================================================================
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  'trade_proposal', 'trade_accepted', 'trade_rejected', 'trade_message', 'trade_expired',
  'report_submitted', 'new_message',
  'season_phase_change',
  'draft_started', 'draft_on_clock', 'draft_on_deck', 'draft_completed'
));

-- =============================================================================
-- STEP 6: Create draft_sessions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS draft_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'paused', 'completed')),
  total_rounds integer NOT NULL DEFAULT 45,
  hours_per_pick numeric NOT NULL DEFAULT 24,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  current_pick_deadline timestamp with time zone,
  current_on_clock_team_id text REFERENCES teams(id),
  started_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE draft_sessions IS 'Scheduled and active draft sessions with timer configuration';

CREATE INDEX IF NOT EXISTS draft_sessions_season_idx   ON draft_sessions(season_id);
CREATE INDEX IF NOT EXISTS draft_sessions_status_idx   ON draft_sessions(status);
CREATE INDEX IF NOT EXISTS draft_sessions_deadline_idx ON draft_sessions(current_pick_deadline);

-- =============================================================================
-- STEP 7: RLS for draft_sessions
-- =============================================================================
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Draft sessions are viewable by everyone"   ON draft_sessions;
DROP POLICY IF EXISTS "Draft sessions are manageable by admins"   ON draft_sessions;

CREATE POLICY "Draft sessions are viewable by everyone"
  ON draft_sessions FOR SELECT
  USING (true);

CREATE POLICY "Draft sessions are manageable by admins"
  ON draft_sessions FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- STEP 8: Notification helpers for draft events
-- =============================================================================
CREATE OR REPLACE FUNCTION notify_all_users_draft(
  p_notification_type text,
  p_message text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  SELECT id, p_notification_type, NULL, p_message
  FROM public.users;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION notify_draft_team_roles(
  p_team_id text,
  p_notification_type text,
  p_message text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  SELECT DISTINCT tm.user_id, p_notification_type, NULL, p_message
  FROM team_members tm
  INNER JOIN team_member_roles tmr ON tmr.team_member_id = tm.id
  WHERE tm.team_id = p_team_id
    AND tmr.role IN ('captain', 'broker');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Fallback: notify all team members if no captains/brokers found
  IF v_count = 0 THEN
    INSERT INTO notifications (user_id, notification_type, trade_id, message)
    SELECT DISTINCT user_id, p_notification_type, NULL, p_message
    FROM team_members
    WHERE team_id = p_team_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
SELECT 'Migration complete: draft phase + draft_sessions table ready.' AS result;
