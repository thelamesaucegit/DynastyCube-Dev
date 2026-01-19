-- First, let's see ALL policies on matches
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'matches'
ORDER BY cmd, policyname;

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'matches';

-- Let's try disabling RLS temporarily to test
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;

-- After running this, test recording a game
-- Then run this to re-enable it:
-- ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
