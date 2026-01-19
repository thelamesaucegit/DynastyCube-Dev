-- =================================
-- FIX NOTIFICATION TYPE CONSTRAINT
-- =================================
-- Comprehensive fix that includes ALL notification types used across the system
-- This resolves conflicts between fix-notification-types.sql and season-phase-system.sql

-- Drop the existing constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Add new constraint with ALL notification types
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
));

-- Update comment
COMMENT ON TABLE notifications IS 'User notifications for trades, reports, messages, and season updates';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: trade_proposal, trade_accepted, trade_rejected, trade_message, trade_expired, report_submitted, new_message, season_phase_change';
