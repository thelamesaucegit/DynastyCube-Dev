-- =================================
-- ROBUST NOTIFICATION CONSTRAINT FIX
-- =================================
-- This script safely fixes the notification_type constraint by:
-- 1. Identifying all existing notification types
-- 2. Cleaning up or migrating invalid types
-- 3. Applying the correct constraint

-- Step 1: Display current notification types for review
DO $$
DECLARE
  v_types text;
BEGIN
  SELECT string_agg(DISTINCT notification_type, ', ')
  INTO v_types
  FROM notifications;

  RAISE NOTICE 'Current notification types in database: %', v_types;
END $$;

-- Step 2: Handle common typos or variations (if any)
-- Uncomment and modify if you find typos in the diagnostic query
-- UPDATE notifications SET notification_type = 'trade_proposal' WHERE notification_type = 'trade_propose';
-- UPDATE notifications SET notification_type = 'new_message' WHERE notification_type = 'message';

-- Step 3: Option A - Delete rows with unknown notification types (CAREFUL!)
-- Uncomment if you want to delete invalid notifications
-- DELETE FROM notifications
-- WHERE notification_type NOT IN (
--   'trade_proposal',
--   'trade_accepted',
--   'trade_rejected',
--   'trade_message',
--   'trade_expired',
--   'report_submitted',
--   'new_message',
--   'season_phase_change'
-- );

-- Step 3: Option B - Update unknown types to a default value
-- Uncomment if you want to preserve notifications but mark them differently
-- UPDATE notifications
-- SET notification_type = 'new_message'
-- WHERE notification_type NOT IN (
--   'trade_proposal',
--   'trade_accepted',
--   'trade_rejected',
--   'trade_message',
--   'trade_expired',
--   'report_submitted',
--   'new_message',
--   'season_phase_change'
-- );

-- Step 4: Drop the existing constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Step 5: Add the comprehensive constraint with ALL known types
ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  -- Trade-related notifications
  'trade_proposal',
  'trade_accepted',
  'trade_rejected',
  'trade_message',
  'trade_expired',

  -- Report and messaging notifications
  'report_submitted',
  'new_message',

  -- Season management notifications
  'season_phase_change'

  -- Add any additional types found in Step 1 here
  -- For example, if you find 'draft_started', add it:
  -- , 'draft_started'
));

-- Step 6: Update table comments
COMMENT ON TABLE notifications IS 'User notifications for trades, reports, messages, and season updates';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: trade_proposal, trade_accepted, trade_rejected, trade_message, trade_expired, report_submitted, new_message, season_phase_change';

-- Step 7: Verify the fix
DO $$
DECLARE
  v_invalid_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_invalid_count
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

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Still have % notifications with invalid types!', v_invalid_count;
  ELSE
    RAISE NOTICE 'All notification types are valid. Constraint applied successfully.';
  END IF;
END $$;
