-- ================================================
-- FIX NOTIFICATION DELETE POLICY
-- ================================================
-- This migration adds a DELETE policy for the notifications table
-- so users can delete their own notifications

-- Add DELETE policy for notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Verify the policy was created
COMMENT ON POLICY "Users can delete their own notifications" ON notifications
IS 'Allows authenticated users to delete notifications that belong to them';
