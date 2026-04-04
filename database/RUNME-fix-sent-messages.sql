-- =================================================
-- FIX SENT MESSAGES NOT SHOWING IN OUTBOX
-- =================================================
-- Run this in your Supabase SQL Editor
-- =================================================

-- Step 1: Check if messages exist (for debugging)
-- Uncomment and replace with your user ID to test:
-- SELECT id, subject, from_user_id, to_user_id, created_at
-- FROM messages
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Step 2: Drop and recreate the view with security_invoker
DROP VIEW IF EXISTS messages_with_user_info;

CREATE VIEW messages_with_user_info
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.from_user_id,
  m.to_user_id,
  m.subject,
  m.message,
  m.is_read,
  m.parent_message_id,
  m.created_at,
  COALESCE(from_user_data.display_name, from_user_data.discord_username, 'Unknown User') as from_user_name,
  COALESCE(from_user_data.email, 'Unknown') as from_user_email,
  COALESCE(to_user_data.display_name, to_user_data.discord_username, 'Unknown User') as to_user_name,
  COALESCE(to_user_data.email, 'Unknown') as to_user_email
FROM messages m
LEFT JOIN public.users from_user_data ON m.from_user_id = from_user_data.id
LEFT JOIN public.users to_user_data ON m.to_user_id = to_user_data.id;

-- Step 3: Grant access to authenticated users
GRANT SELECT ON messages_with_user_info TO authenticated;

-- Step 4: Verify the view has security_invoker enabled
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'messages_with_user_info';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ View recreated with security_invoker = true';
  RAISE NOTICE 'Sent messages should now appear in the outbox';
END $$;
