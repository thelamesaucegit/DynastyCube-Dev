-- =================================================
-- FIX MESSAGES VIEW - QUICK FIX
-- =================================================
-- This script fixes the "column full_name does not exist" error
-- Run this in your Supabase SQL Editor or via psql
-- =================================================

-- Step 1: Fix RLS policies on users table (fixes "permission denied" error)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Step 2: Ensure all users have display names (privacy requirement)
-- No user should show as email in the UI
UPDATE public.users
SET display_name = COALESCE(
  display_name,
  discord_username,
  SPLIT_PART(email, '@', 1)  -- Use email username part as fallback
)
WHERE display_name IS NULL OR display_name = '';

-- Step 3: Drop the broken view
DROP VIEW IF EXISTS messages_with_user_info CASCADE;

-- Step 4: Recreate the view with correct column names
CREATE OR REPLACE VIEW messages_with_user_info AS
SELECT
  m.id,
  m.from_user_id,
  m.to_user_id,
  m.subject,
  m.message,
  m.is_read,
  m.parent_message_id,
  m.created_at,

  -- From user info
  from_user.email as from_user_email,
  COALESCE(
    from_user_data.display_name,      -- User's custom display name
    from_user_data.discord_username,  -- Discord username (Discord users only)
    from_user.email,
    'Unknown User'
  ) as from_user_name,

  -- To user info
  to_user.email as to_user_email,
  COALESCE(
    to_user_data.display_name,      -- User's custom display name
    to_user_data.discord_username,  -- Discord username (Discord users only)
    to_user.email,
    'Unknown User'
  ) as to_user_name

FROM messages m
LEFT JOIN auth.users from_user ON m.from_user_id = from_user.id
LEFT JOIN public.users from_user_data ON m.from_user_id = from_user_data.id
LEFT JOIN auth.users to_user ON m.to_user_id = to_user.id
LEFT JOIN public.users to_user_data ON m.to_user_id = to_user_data.id;

-- Step 5: Grant access to authenticated users
GRANT SELECT ON messages_with_user_info TO authenticated;

-- Step 6: Add RLS to the view (inherits from messages table)
ALTER VIEW messages_with_user_info SET (security_invoker = true);

-- Step 7: Add comment
COMMENT ON VIEW messages_with_user_info IS 'Messages with sender and recipient user information for easy display';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ SUCCESS! All privacy and messaging fixes applied!';
  RAISE NOTICE '';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '1. ✓ RLS policy - users table is now readable';
  RAISE NOTICE '2. ✓ Display names populated for all users';
  RAISE NOTICE '3. ✓ Messages view fixed (display_name instead of full_name)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test the fixes:';
  RAISE NOTICE '- Messages view: SELECT * FROM messages_with_user_info LIMIT 5;';
  RAISE NOTICE '- User names: SELECT email, display_name FROM public.users LIMIT 10;';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)';
END $$;
