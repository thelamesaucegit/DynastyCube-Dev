-- =================================
-- FINAL NOTIFICATION CONSTRAINT FIX
-- =================================
-- This removes ALL constraints on notification_type and adds one comprehensive constraint
-- that includes all notification types used across the entire system

-- Step 1: Remove ALL existing constraints on the notification_type column
-- This handles both named constraints and inline constraints
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find and drop all check constraints on notification_type
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'notifications'
      AND con.contype = 'c'  -- Check constraint
      AND pg_get_constraintdef(con.oid) LIKE '%notification_type%'
  LOOP
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END LOOP;
END $$;

-- Step 2: Add the comprehensive constraint with ALL notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  -- Trade-related notifications (from trades-system.sql)
  'trade_proposal',
  'trade_accepted',
  'trade_rejected',
  'trade_message',
  'trade_expired',

  -- Report and messaging notifications (from messaging-and-reports.sql)
  'report_submitted',
  'new_message',

  -- Season management notifications (from season-phase-system.sql)
  'season_phase_change'
));

-- Step 3: Update documentation
COMMENT ON TABLE notifications IS 'User notifications for trades, reports, messages, and season updates';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: trade_proposal, trade_accepted, trade_rejected, trade_message, trade_expired, report_submitted, new_message, season_phase_change';

-- Step 4: Verify all rows pass the constraint
DO $$
DECLARE
  v_total_count integer;
  v_invalid_count integer;
  v_invalid_types text;
BEGIN
  -- Count total notifications
  SELECT COUNT(*) INTO v_total_count FROM notifications;

  -- Count invalid notifications
  SELECT COUNT(*) INTO v_invalid_count
  FROM notifications
  WHERE notification_type NOT IN (
    'trade_proposal',
    'trade_accepted',
    'trade_rejected',
    'trade_message',
    'trade_expired',
    'report_submitted',
    'new_message',
    'season_phase_change'
  );

  -- Get list of invalid types
  SELECT string_agg(DISTINCT notification_type, ', ')
  INTO v_invalid_types
  FROM notifications
  WHERE notification_type NOT IN (
    'trade_proposal',
    'trade_accepted',
    'trade_rejected',
    'trade_message',
    'trade_expired',
    'report_submitted',
    'new_message',
    'season_phase_change'
  );

  -- Report results
  RAISE NOTICE 'Total notifications: %', v_total_count;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % notifications with invalid types: %', v_invalid_count, v_invalid_types;
    RAISE WARNING 'You need to update these rows before the constraint can be applied.';
    RAISE WARNING 'Run the diagnostic query to see which rows need fixing.';
  ELSE
    RAISE NOTICE 'SUCCESS: All % notifications have valid types!', v_total_count;
    RAISE NOTICE 'Constraint has been applied successfully.';
  END IF;
END $$;
