-- =================================================
-- ADD COMPLETE NOTIFICATION RLS POLICIES
-- =================================================
-- This adds UPDATE and DELETE policies for the notifications table
-- SELECT policy already exists from trades-system.sql

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Add DELETE policy - allows users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add UPDATE policy - allows users to mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verify policies
COMMENT ON POLICY "Users can delete their own notifications" ON notifications
  IS 'Allows authenticated users to delete notifications that belong to them';

COMMENT ON POLICY "Users can update their own notifications" ON notifications
  IS 'Allows authenticated users to update (mark as read) their own notifications';

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added DELETE and UPDATE policies to notifications table';
END $$;
