-- Check admin users and recent notifications
-- Run this to diagnose notification issues

-- 1. Check who is marked as admin in public.users
SELECT
  id,
  email,
  is_admin,
  created_at
FROM public.users
WHERE is_admin = true;

-- 2. Check recent notifications
SELECT
  id,
  user_id,
  notification_type,
  message,
  is_read,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if notify_admins_of_report function exists
SELECT
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'notify_admins_of_report';

-- 4. Check recent reports
SELECT
  id,
  report_type,
  title,
  status,
  created_at,
  reporter_user_id
FROM reports
ORDER BY created_at DESC
LIMIT 5;
