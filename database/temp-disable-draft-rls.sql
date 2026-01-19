-- =================================
-- TEMPORARY: Disable RLS for draft tables
-- Run this in Supabase SQL Editor to quickly get deck creation working
-- WARNING: This removes security - only use for development/testing
-- =================================

-- Disable RLS on draft tables
ALTER TABLE team_draft_picks DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards DISABLE ROW LEVEL SECURITY;

-- Note: To re-enable RLS later, run:
-- ALTER TABLE team_draft_picks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_decks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;
