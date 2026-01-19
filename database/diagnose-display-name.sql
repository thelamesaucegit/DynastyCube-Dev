-- =================================================
-- DIAGNOSE DISPLAY NAME ISSUE
-- =================================================
-- This script helps debug why "Unknown User" is showing
-- instead of the actual display name
-- =================================================

-- Step 1: Check if you exist in public.users
SELECT
  '=== YOUR USER RECORD IN public.users ===' as check_type,
  id,
  email,
  display_name,
  discord_username,
  discord_id,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Check team memberships
SELECT
  '=== YOUR TEAM MEMBERSHIPS ===' as check_type,
  tm.id,
  tm.user_id,
  tm.team_id,
  tm.user_email,
  tm.joined_at,
  t.name as team_name
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
ORDER BY tm.joined_at DESC
LIMIT 5;

-- Step 3: Check if user_id matches between tables
SELECT
  '=== CHECKING ID MATCH ===' as check_type,
  tm.user_id as team_member_user_id,
  u.id as public_users_id,
  CASE
    WHEN tm.user_id = u.id THEN '✓ IDs MATCH'
    ELSE '✗ IDs DO NOT MATCH'
  END as match_status,
  u.display_name,
  u.discord_username,
  tm.user_email
FROM team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE tm.team_id = 'ninja'  -- Kamigawa Ninja
ORDER BY tm.joined_at DESC;

-- Step 4: Check for orphaned team members (no matching user in public.users)
SELECT
  '=== ORPHANED TEAM MEMBERS ===' as check_type,
  tm.user_id,
  tm.user_email,
  tm.team_id,
  CASE
    WHEN u.id IS NULL THEN '⚠️ NO MATCHING USER IN public.users'
    ELSE '✓ User exists'
  END as status
FROM team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE u.id IS NULL;

-- Step 5: What would the query return?
SELECT
  '=== SIMULATED QUERY RESULT ===' as check_type,
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  u.display_name,
  u.discord_username,
  COALESCE(
    u.display_name,
    u.discord_username,
    'Unknown User'
  ) as displayed_name,
  CASE
    WHEN u.display_name IS NOT NULL THEN 'Using display_name'
    WHEN u.discord_username IS NOT NULL THEN 'Using discord_username'
    ELSE 'Showing Unknown User (both are NULL!)'
  END as name_source
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE tm.team_id = 'ninja'
ORDER BY tm.joined_at DESC;

-- Step 6: Check auth.users metadata
SELECT
  '=== AUTH.USERS METADATA ===' as check_type,
  id,
  email,
  raw_user_meta_data->>'full_name' as oauth_full_name,
  raw_user_meta_data->>'provider_id' as provider_id,
  raw_app_meta_data->>'provider' as provider,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- =================================
-- DIAGNOSIS SUMMARY
-- =================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DISPLAY NAME DIAGNOSIS COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Check the query results above to find the issue:';
  RAISE NOTICE '';
  RAISE NOTICE '1. YOUR USER RECORD - Do you exist in public.users?';
  RAISE NOTICE '   - If YES: Check if display_name and discord_username are NULL';
  RAISE NOTICE '   - If NO: Run the user creation trigger or manual insert';
  RAISE NOTICE '';
  RAISE NOTICE '2. TEAM MEMBERSHIPS - Are you in the ninja team?';
  RAISE NOTICE '   - Should show your team_members record';
  RAISE NOTICE '';
  RAISE NOTICE '3. ID MATCH - Do the IDs match?';
  RAISE NOTICE '   - team_member_user_id should equal public_users_id';
  RAISE NOTICE '   - If not matching: Data inconsistency issue';
  RAISE NOTICE '';
  RAISE NOTICE '4. ORPHANED MEMBERS - Any members without users?';
  RAISE NOTICE '   - These will always show as "Unknown User"';
  RAISE NOTICE '   - Fix: Create matching public.users records';
  RAISE NOTICE '';
  RAISE NOTICE '5. SIMULATED QUERY - What name would be displayed?';
  RAISE NOTICE '   - Shows exactly what getTeamsWithMembers() would return';
  RAISE NOTICE '   - Check the "displayed_name" and "name_source" columns';
  RAISE NOTICE '';
  RAISE NOTICE '6. AUTH METADATA - What did OAuth provide?';
  RAISE NOTICE '   - Shows what name came from Discord/Google';
  RAISE NOTICE '   - If oauth_full_name is NULL, that is the problem!';
  RAISE NOTICE '';
END $$;
