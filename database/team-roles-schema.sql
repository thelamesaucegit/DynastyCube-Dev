-- =================================
-- DYNASTY CUBE TEAM ROLES SCHEMA
-- =================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================
-- TEAM MEMBER ROLES TABLE
-- Store role assignments for team members
-- =================================
CREATE TABLE IF NOT EXISTS team_member_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(team_member_id, role) -- A member can only have each role once
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS team_member_roles_team_member_id_idx ON team_member_roles(team_member_id);
CREATE INDEX IF NOT EXISTS team_member_roles_role_idx ON team_member_roles(role);

-- =================================
-- ROLE CHANGE HISTORY TABLE
-- Track role assignment changes for audit purposes
-- =================================
CREATE TABLE IF NOT EXISTS team_role_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('captain', 'broker', 'historian', 'pilot')),
  action text NOT NULL CHECK (action IN ('assigned', 'removed')),
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamp with time zone DEFAULT now(),
  notes text
);

-- Create index for history queries
CREATE INDEX IF NOT EXISTS team_role_history_team_member_id_idx ON team_role_history(team_member_id);
CREATE INDEX IF NOT EXISTS team_role_history_performed_at_idx ON team_role_history(performed_at DESC);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Enable RLS on tables
ALTER TABLE team_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_role_history ENABLE ROW LEVEL SECURITY;

-- Team Member Roles: Everyone can read, everyone can modify (for now)
CREATE POLICY "Team member roles are viewable by everyone"
  ON team_member_roles FOR SELECT
  USING (true);

CREATE POLICY "Team member roles can be assigned by everyone"
  ON team_member_roles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Team member roles can be updated by everyone"
  ON team_member_roles FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Team member roles can be removed by everyone"
  ON team_member_roles FOR DELETE
  USING (true);

-- Role History: Everyone can read, everyone can insert
CREATE POLICY "Role history is viewable by everyone"
  ON team_role_history FOR SELECT
  USING (true);

CREATE POLICY "Role history can be created by everyone"
  ON team_role_history FOR INSERT
  WITH CHECK (true);

-- =================================
-- HELPER FUNCTIONS
-- =================================

-- Function to check if a user has a specific role on a team
CREATE OR REPLACE FUNCTION user_has_team_role(
  p_user_id uuid,
  p_team_id text,
  p_role text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM team_members tm
    JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
      AND tmr.role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all roles for a user on a team
CREATE OR REPLACE FUNCTION get_user_team_roles(
  p_user_id uuid,
  p_team_id text
)
RETURNS text[] AS $$
DECLARE
  user_roles text[];
BEGIN
  SELECT ARRAY_AGG(tmr.role)
  INTO user_roles
  FROM team_members tm
  JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
  WHERE tm.user_id = p_user_id
    AND tm.team_id = p_team_id;

  RETURN COALESCE(user_roles, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- HELPFUL VIEWS
-- =================================

-- View to see all team members with their roles
CREATE OR REPLACE VIEW team_members_with_roles AS
SELECT
  tm.id as member_id,
  tm.user_id,
  tm.user_email,
  tm.team_id,
  tm.joined_at,
  COALESCE(
    ARRAY_AGG(tmr.role ORDER BY tmr.role) FILTER (WHERE tmr.role IS NOT NULL),
    ARRAY[]::text[]
  ) as roles,
  COALESCE(
    ARRAY_AGG(tmr.assigned_at ORDER BY tmr.role) FILTER (WHERE tmr.assigned_at IS NOT NULL),
    ARRAY[]::timestamp with time zone[]
  ) as role_assigned_dates
FROM team_members tm
LEFT JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
GROUP BY tm.id, tm.user_id, tm.user_email, tm.team_id, tm.joined_at;

-- =================================
-- NOTES
-- =================================
-- Role Descriptions:
--
-- CAPTAIN: Has full administrative control over the team
--   - Can assign/remove all roles
--   - Can add/remove team members
--   - Makes final decisions on all team matters
--
-- BROKER: Handles draft picks and trades
--   - Can make draft selections for the team
--   - Can initiate and complete trades with other teams
--   - Manages team's card pool
--
-- HISTORIAN: Records and maintains team history
--   - Documents match results
--   - Maintains team records and statistics
--   - Writes team narratives and stories
--
-- PILOT: Plays matches with team decks
--   - Represents team in competitive matches
--   - Uses team's constructed decks
--   - Reports match results
--
-- Notes:
-- - Multiple members can have the same role
-- - One member can have multiple roles
-- - Roles can be assigned/removed at any time by captains
-- - All role changes are logged in team_role_history
