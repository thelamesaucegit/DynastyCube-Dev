-- =================================
-- DIAGNOSE NOTIFICATION TYPES
-- =================================
-- Find all notification types currently in the database
-- This helps us identify what types are causing the constraint violation

-- 1. List all unique notification types in the database
SELECT
  notification_type,
  COUNT(*) as count
FROM notifications
GROUP BY notification_type
ORDER BY count DESC;

-- 2. Find notification types that would violate our constraint
SELECT
  notification_type,
  COUNT(*) as count
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
)
GROUP BY notification_type;

-- 3. Show sample rows with unknown notification types
SELECT *
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
)
LIMIT 10;
