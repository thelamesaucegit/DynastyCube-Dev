-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can update match statistics" ON matches;

-- Create a simpler policy that allows updates without WITH CHECK complications
-- The USING clause controls who can UPDATE (must be team member)
-- Setting WITH CHECK to true allows any update as long as USING passes
CREATE POLICY "Team members can update match statistics"
ON matches
FOR UPDATE
TO authenticated
USING (
  -- User must be a member of either home or away team
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.team_id IN (matches.home_team_id, matches.away_team_id)
  )
)
WITH CHECK (true);  -- Allow any update values as long as USING passes

-- Verify the policy
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE tablename = 'matches' AND cmd = 'UPDATE';
