-- =================================================
-- ADD COMPLETE MESSAGE RLS POLICIES
-- =================================================
-- This adds UPDATE and DELETE policies for the messages table
-- SELECT policy should already exist from messaging-and-reports.sql

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can delete their received messages" ON messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON messages;

-- Add DELETE policy - allows users to delete messages they received
CREATE POLICY "Users can delete their received messages"
  ON messages FOR DELETE
  TO authenticated
  USING (to_user_id = auth.uid());

-- Add UPDATE policy - allows users to mark their received messages as read
CREATE POLICY "Users can update their received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());

-- Verify policies
COMMENT ON POLICY "Users can delete their received messages" ON messages
  IS 'Allows authenticated users to delete messages sent to them';

COMMENT ON POLICY "Users can update their received messages" ON messages
  IS 'Allows authenticated users to update (mark as read) their received messages';

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added DELETE and UPDATE policies to messages table';
  RAISE NOTICE 'Users can now delete and update their received messages';
END $$;
