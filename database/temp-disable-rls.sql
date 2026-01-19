-- =================================
-- TEMPORARY FIX: Disable RLS for testing
-- ⚠️ WARNING: Only use this for development/testing!
-- ⚠️ Re-enable RLS before going to production!
-- =================================

-- Disable RLS on tables
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_pools DISABLE ROW LEVEL SECURITY;

-- Note: This allows anyone to read/write to these tables
-- Use fix-rls-policies.sql instead for a proper security setup
