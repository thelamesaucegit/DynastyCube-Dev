-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can update matches for their teams" ON matches;
DROP POLICY IF EXISTS "Team members can update match results" ON matches;

-- Create a policy that allows authenticated users to update match statistics
-- This is needed for the reportMatchGame function to work
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
WITH CHECK (
  -- User must be a member of either home or away team
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.team_id IN (matches.home_team_id, matches.away_team_id)
  )
);

-- Verify the policy was created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'matches' AND cmd = 'UPDATE';
