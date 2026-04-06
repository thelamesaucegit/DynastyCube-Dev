-- =================================================
-- QUICK FIX - MY DISPLAY NAME
-- =================================================
-- This script ensures YOUR display name is populated
-- Run this if you're seeing "Unknown User" on team pages
-- =================================================

-- Step 1: Update display_name from auth metadata for users who don't have one
UPDATE public.users u
SET
  display_name = COALESCE(
    u.display_name,  -- Keep existing if set
    u.discord_username,  -- Use Discord username if available
    au.raw_user_meta_data->>'full_name',  -- Get from OAuth
    SPLIT_PART(u.email, '@', 1)  -- Fallback to email username
  ),
  discord_username = COALESCE(
    u.discord_username,  -- Keep existing if set
    CASE
      WHEN au.raw_app_meta_data->>'provider' = 'discord'
      THEN au.raw_user_meta_data->>'full_name'
      ELSE NULL
    END
  )
FROM auth.users au
WHERE u.id = au.id
  AND (u.display_name IS NULL OR u.display_name = '');

-- Step 2: Show what was updated
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.users
  WHERE display_name IS NOT NULL AND display_name != '';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DISPLAY NAME FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Users with display names: %', v_count;
  RAISE NOTICE '';
END $$;

-- Step 3: Show current display names
SELECT
  'Current Display Names:' as info,
  email,
  display_name,
  discord_username
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Verify team members now have names
SELECT
  'Team Members (Ninja):' as info,
  tm.user_email,
  COALESCE(
    u.display_name,
    u.discord_username,
    'Still Unknown!'
  ) as will_display_as
FROM team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE tm.team_id = 'ninja'
ORDER BY tm.joined_at DESC;

-- =================================
-- SUCCESS MESSAGE
-- =================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'If you still see "Unknown User":';
  RAISE NOTICE '1. Check if you exist in public.users (run diagnose-display-name.sql)';
  RAISE NOTICE '2. Manually set your display name:';
  RAISE NOTICE '   UPDATE public.users SET display_name = ''YourName'' WHERE email = ''your@email.com'';';
  RAISE NOTICE '3. Check browser console for errors';
  RAISE NOTICE '4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)';
  RAISE NOTICE '';
END $$;
