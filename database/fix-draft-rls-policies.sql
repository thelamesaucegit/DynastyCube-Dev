-- =================================
-- FIX: Update RLS policies for draft tables to allow unauthenticated access
-- Run this in Supabase SQL Editor AFTER running draft-schema.sql
-- =================================

-- Drop ALL existing policies for draft tables (exact names from draft-schema.sql)
DROP POLICY IF EXISTS "Draft picks are viewable by everyone" ON team_draft_picks;
DROP POLICY IF EXISTS "Draft picks can be added by authenticated users" ON team_draft_picks;
DROP POLICY IF EXISTS "Draft picks can be deleted by authenticated users" ON team_draft_picks;

DROP POLICY IF EXISTS "Public decks are viewable by everyone" ON team_decks;
DROP POLICY IF EXISTS "Decks can be created by authenticated users" ON team_decks;
DROP POLICY IF EXISTS "Decks can be updated by authenticated users" ON team_decks;
DROP POLICY IF EXISTS "Decks can be deleted by authenticated users" ON team_decks;

DROP POLICY IF EXISTS "Deck cards are viewable by everyone" ON deck_cards;
DROP POLICY IF EXISTS "Deck cards can be added by authenticated users" ON deck_cards;
DROP POLICY IF EXISTS "Deck cards can be updated by authenticated users" ON deck_cards;
DROP POLICY IF EXISTS "Deck cards can be deleted by authenticated users" ON deck_cards;

-- =================================
-- TEAM DRAFT PICKS POLICIES
-- =================================

-- Allow SELECT for everyone
CREATE POLICY "Draft picks select"
  ON team_draft_picks FOR SELECT
  USING (true);

-- Allow INSERT for everyone
CREATE POLICY "Draft picks insert"
  ON team_draft_picks FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for everyone
CREATE POLICY "Draft picks update"
  ON team_draft_picks FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for everyone
CREATE POLICY "Draft picks delete"
  ON team_draft_picks FOR DELETE
  USING (true);

-- =================================
-- TEAM DECKS POLICIES
-- =================================

-- Allow SELECT for everyone
CREATE POLICY "Team decks select"
  ON team_decks FOR SELECT
  USING (true);

-- Allow INSERT for everyone
CREATE POLICY "Team decks insert"
  ON team_decks FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for everyone
CREATE POLICY "Team decks update"
  ON team_decks FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for everyone
CREATE POLICY "Team decks delete"
  ON team_decks FOR DELETE
  USING (true);

-- =================================
-- DECK CARDS POLICIES
-- =================================

-- Allow SELECT for everyone
CREATE POLICY "Deck cards select"
  ON deck_cards FOR SELECT
  USING (true);

-- Allow INSERT for everyone
CREATE POLICY "Deck cards insert"
  ON deck_cards FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for everyone
CREATE POLICY "Deck cards update"
  ON deck_cards FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for everyone
CREATE POLICY "Deck cards delete"
  ON deck_cards FOR DELETE
  USING (true);

-- =================================
-- NOTES
-- =================================
-- These policies are permissive to get the application working.
-- In production, you should restrict them to:
-- 1. Only allow users to modify their own team's drafts/decks
-- 2. Add proper authentication checks
-- 3. Use team membership to control access
