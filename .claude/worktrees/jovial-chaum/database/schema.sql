-- =================================
-- DYNASTY CUBE DATABASE SCHEMA
-- =================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================
-- 1. TEAMS TABLE
-- Store team information
-- =================================
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  motto text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default teams
INSERT INTO teams (id, name, emoji, motto) VALUES
  ('shards', 'Alara Shards', '🌟', 'Why not both?'),
  ('ninja', 'Kamigawa Ninja', '⛩', 'Omae wa mou shindeiru.'),
  ('creeps', 'Innistrad Creeps', '🧟', 'Graveyard, Gatekeep, Girlboss'),
  ('demigods', 'Theros Demigods', '🌞', 'The Fates will decide'),
  ('guildpact', 'Ravnica Guildpact', '🔗', 'A Championship is won and lost before ever entering the battlefield'),
  ('changelings', 'Lorwyn Changelings', '👽', 'Expect the unexpected'),
  ('hedrons', 'Zendikar Hedrons', '💠', 'Good Vibes, No Escape'),
  ('dragons', 'Tarkir Dragons', '🐲', 'No cost too great')
ON CONFLICT (id) DO NOTHING;

-- =================================
-- 2. TEAM MEMBERS TABLE
-- Link users to teams
-- =================================
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id);

-- =================================
-- 3. CARD POOLS TABLE
-- Store MTG cards for draft pools
-- =================================
CREATE TABLE IF NOT EXISTS card_pools (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_set text,
  card_type text,
  rarity text,
  colors text[],
  image_url text,
  pool_name text DEFAULT 'default',
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS card_pools_pool_name_idx ON card_pools(pool_name);
CREATE INDEX IF NOT EXISTS card_pools_card_name_idx ON card_pools(card_name);

-- =================================
-- 4. USER ROLES TABLE (Optional)
-- Store user permissions
-- =================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  granted_at timestamp with time zone DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles(user_id);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Teams: Everyone can read, only admins can modify
CREATE POLICY "Teams are viewable by everyone"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Teams are editable by admins only"
  ON teams FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Team Members: Users can see all, admins can modify
CREATE POLICY "Team members are viewable by everyone"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "Team members are editable by admins only"
  ON team_members FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Card Pools: Everyone can read, admins can modify
CREATE POLICY "Card pools are viewable by everyone"
  ON card_pools FOR SELECT
  USING (true);

CREATE POLICY "Card pools are editable by admins only"
  ON card_pools FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- User Roles: Only viewable/editable by service role
CREATE POLICY "User roles are viewable by admins only"
  ON user_roles FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "User roles are editable by admins only"
  ON user_roles FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
