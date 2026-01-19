-- =================================
-- FIX SEASONS RLS POLICIES
-- =================================
-- The original policy checked for 'service_role' which users don't have
-- This updates it to check the is_admin column in the users table

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Seasons are editable by admins only" ON seasons;
DROP POLICY IF EXISTS "Admins can insert seasons" ON seasons;
DROP POLICY IF EXISTS "Admins can update seasons" ON seasons;
DROP POLICY IF EXISTS "Admins can delete seasons" ON seasons;

-- Create correct admin policy for INSERT
CREATE POLICY "Admins can insert seasons"
  ON seasons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Create correct admin policy for UPDATE
CREATE POLICY "Admins can update seasons"
  ON seasons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Create correct admin policy for DELETE
CREATE POLICY "Admins can delete seasons"
  ON seasons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );
