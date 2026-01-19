-- =================================
-- FIX: Update RLS policies to allow authenticated users
-- Run this in Supabase SQL Editor
-- =================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Team members are editable by admins only" ON team_members;
DROP POLICY IF EXISTS "Card pools are editable by admins only" ON card_pools;
DROP POLICY IF EXISTS "Teams are editable by admins only" ON teams;

-- Create new policies that allow authenticated users to modify
-- (Application-level checks in adminUtils.ts will handle admin authorization)

-- Teams: Everyone can read, authenticated users can modify
CREATE POLICY "Teams are editable by authenticated users"
  ON teams FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Team Members: Everyone can read, authenticated users can modify
CREATE POLICY "Team members are editable by authenticated users"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Team members can be deleted by authenticated users"
  ON team_members FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Team members can be updated by authenticated users"
  ON team_members FOR UPDATE
  TO authenticated
  USING (true);

-- Card Pools: Everyone can read, authenticated users can modify
CREATE POLICY "Card pools can be inserted by authenticated users"
  ON card_pools FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Card pools can be deleted by authenticated users"
  ON card_pools FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Card pools can be updated by authenticated users"
  ON card_pools FOR UPDATE
  TO authenticated
  USING (true);
