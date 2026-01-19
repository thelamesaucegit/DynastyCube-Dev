-- =================================
-- SEASON PHASE MANAGEMENT SYSTEM
-- =================================
-- Allows admins to set the current season phase and notify all users

-- =================================
-- 1. ADD SEASON PHASE TO SEASONS TABLE
-- =================================
-- Add phase column to seasons table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'phase'
  ) THEN
    ALTER TABLE seasons
    ADD COLUMN phase text DEFAULT 'preseason'
    CHECK (phase IN ('preseason', 'season', 'playoffs', 'postseason'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'phase_changed_at'
  ) THEN
    ALTER TABLE seasons
    ADD COLUMN phase_changed_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

COMMENT ON COLUMN seasons.phase IS 'Current phase of the season: preseason, season, playoffs, or postseason';
COMMENT ON COLUMN seasons.phase_changed_at IS 'Timestamp of last phase change';

-- =================================
-- 2. UPDATE NOTIFICATION TYPES
-- =================================
-- Add season_phase_change to notification types
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  'trade_proposal',
  'trade_accepted',
  'trade_rejected',
  'trade_message',
  'trade_expired',
  'report_submitted',
  'new_message',
  'season_phase_change'
));

-- =================================
-- 3. FUNCTION TO NOTIFY ALL USERS OF PHASE CHANGE
-- =================================
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
  -- Build notification message
  v_message := 'The season has moved to ' ||
    CASE p_new_phase
      WHEN 'preseason' THEN 'Preseason'
      WHEN 'season' THEN 'Regular Season'
      WHEN 'playoffs' THEN 'Playoffs'
      WHEN 'postseason' THEN 'Post Season'
      ELSE p_new_phase
    END || '!';

  -- Notify all users
  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  SELECT
    id,
    'season_phase_change',
    NULL,
    v_message
  FROM public.users;

  GET DIAGNOSTICS v_notification_count = ROW_COUNT;

  RETURN v_notification_count;
END;
$$;

COMMENT ON FUNCTION notify_users_of_phase_change IS 'Notifies all users when the season phase changes';

-- =================================
-- 4. FUNCTION TO UPDATE SEASON PHASE
-- =================================
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
  -- Get current phase
  SELECT phase INTO v_old_phase
  FROM seasons
  WHERE id = p_season_id;

  IF v_old_phase IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 0;
    RETURN;
  END IF;

  -- Update phase
  UPDATE seasons
  SET
    phase = p_new_phase,
    phase_changed_at = now()
  WHERE id = p_season_id;

  -- Notify users if phase actually changed
  IF v_old_phase != p_new_phase THEN
    v_notifications_sent := notify_users_of_phase_change(p_season_id, v_old_phase, p_new_phase);
  ELSE
    v_notifications_sent := 0;
  END IF;

  RETURN QUERY SELECT true, v_old_phase, p_new_phase, v_notifications_sent;
END;
$$;

COMMENT ON FUNCTION update_season_phase IS 'Updates season phase and notifies all users';

-- =================================
-- 5. TRIGGER TO UPDATE PHASE TIMESTAMP
-- =================================
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

-- =================================
-- 6. VIEW FOR CURRENT SEASON INFO
-- =================================
CREATE OR REPLACE VIEW current_season_info AS
SELECT
  id,
  start_date,
  end_date,
  phase,
  phase_changed_at,
  is_active
FROM seasons
WHERE is_active = true
ORDER BY start_date DESC
LIMIT 1;

COMMENT ON VIEW current_season_info IS 'Information about the current active season';

-- =================================
-- 7. INITIALIZE EXISTING SEASONS
-- =================================
-- Set default phase for any existing seasons that don't have one
UPDATE seasons
SET phase = 'season'
WHERE phase IS NULL;
