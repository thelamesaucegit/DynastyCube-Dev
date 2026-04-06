-- =================================
-- FIX NOTIFICATION TYPES
-- =================================
-- Add 'report_submitted' and 'new_message' to the allowed notification types

-- Drop the existing constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Add new constraint with additional notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  'trade_proposal',
  'trade_accepted',
  'trade_rejected',
  'trade_message',
  'trade_expired',
  'report_submitted',
  'new_message'
));

-- Update comment
COMMENT ON TABLE notifications IS 'User notifications for trades, reports, and messages';
