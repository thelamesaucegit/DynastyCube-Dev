-- =============================================
-- DRAFT SESSION SYSTEM
-- Allows admins to schedule, start, and manage
-- drafts with auto-draft timers per pick
-- =============================================

-- =============================================
-- 1. DRAFT SESSIONS TABLE
-- =============================================
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
COMMENT ON COLUMN draft_sessions.status IS 'scheduled = waiting for start_time, active = drafting, paused = suspended, completed = done';
COMMENT ON COLUMN draft_sessions.total_rounds IS 'Number of picks each team gets';
COMMENT ON COLUMN draft_sessions.hours_per_pick IS 'Hours a team has on the clock before auto-draft fires';
COMMENT ON COLUMN draft_sessions.current_pick_deadline IS 'When auto-draft kicks in for the team currently on the clock';
COMMENT ON COLUMN draft_sessions.current_on_clock_team_id IS 'Cached team currently on the clock for quick lookups';

-- Indexes
CREATE INDEX IF NOT EXISTS draft_sessions_season_idx ON draft_sessions(season_id);
CREATE INDEX IF NOT EXISTS draft_sessions_status_idx ON draft_sessions(status);
CREATE INDEX IF NOT EXISTS draft_sessions_deadline_idx ON draft_sessions(current_pick_deadline);

-- =============================================
-- 2. ADD DRAFT NOTIFICATION TYPES
-- =============================================
-- Drop existing constraint and add new one with draft types
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  -- Trade-related
  'trade_proposal',
  'trade_accepted',
  'trade_rejected',
  'trade_message',
  'trade_expired',
  -- Report/messaging
  'report_submitted',
  'new_message',
  -- Season
  'season_phase_change',
  -- Draft
  'draft_started',
  'draft_on_clock',
  'draft_on_deck',
  'draft_completed'
));

-- =============================================
-- 3. ROW LEVEL SECURITY
-- =============================================
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;

-- Everyone can read draft sessions
CREATE POLICY "Draft sessions are viewable by everyone"
  ON draft_sessions FOR SELECT
  USING (true);

-- Only admins can create/update/delete
CREATE POLICY "Draft sessions are manageable by admins"
  ON draft_sessions FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- 4. NOTIFICATION HELPER FUNCTIONS
-- =============================================

-- Notify ALL users (for draft started / draft completed)
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

COMMENT ON FUNCTION notify_all_users_draft IS 'Send a draft notification to every user';

-- Notify captains and brokers of a specific team (for on_clock / on_deck)
-- This uses the team_member_roles table (NOT a role column on team_members)
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

  -- If no captains/brokers found, notify ALL team members as fallback
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

COMMENT ON FUNCTION notify_draft_team_roles IS 'Notify captains/brokers of a team about draft events. Falls back to all team members if no roles assigned.';
