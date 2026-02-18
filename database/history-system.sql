-- =============================================================================
-- HISTORY SYSTEM SCHEMA
-- =============================================================================
-- Tables for team/league history pages with historian role editing
-- and update request system for cross-team/league edits.
-- =============================================================================

-- Drop existing objects if re-running (order matters for foreign keys)
DROP TABLE IF EXISTS historian_request_limits CASCADE;
DROP TABLE IF EXISTS history_update_requests CASCADE;
DROP TABLE IF EXISTS history_entries CASCADE;
DROP TABLE IF EXISTS history_sections CASCADE;
DROP FUNCTION IF EXISTS get_user_pending_request_count(UUID);
DROP FUNCTION IF EXISTS get_user_max_pending_requests(UUID);

-- 1. History Sections
-- Titled groupings per team or league
CREATE TABLE history_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('team', 'league')),
  owner_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Consistency check: league = null owner_id, team = non-null
  CONSTRAINT owner_consistency CHECK (
    (owner_type = 'league' AND owner_id IS NULL) OR
    (owner_type = 'team' AND owner_id IS NOT NULL)
  )
);

-- 2. History Entries
-- Rich text (markdown) content blocks within sections
CREATE TABLE history_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES history_sections(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. History Update Requests
-- Pending requests from historians for other teams/league edits
CREATE TABLE history_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('append_entry', 'new_section')),
  -- Target info
  target_owner_type TEXT NOT NULL CHECK (target_owner_type IN ('team', 'league')),
  target_owner_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  -- For append_entry: which section to append to
  target_section_id UUID REFERENCES history_sections(id) ON DELETE CASCADE,
  -- For new_section: the title
  proposed_title TEXT,
  -- The proposed content (markdown)
  proposed_content TEXT NOT NULL,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validate fields based on request_type
  CONSTRAINT request_type_fields CHECK (
    (request_type = 'append_entry' AND target_section_id IS NOT NULL) OR
    (request_type = 'new_section' AND proposed_title IS NOT NULL)
  ),
  -- Target consistency (same as history_sections)
  CONSTRAINT target_owner_consistency CHECK (
    (target_owner_type = 'league' AND target_owner_id IS NULL) OR
    (target_owner_type = 'team' AND target_owner_id IS NOT NULL)
  )
);

-- 4. Historian Request Limits
-- Per-user configurable pending request cap
CREATE TABLE historian_request_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  max_pending_requests INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_history_sections_owner ON history_sections(owner_type, owner_id);
CREATE INDEX idx_history_sections_order ON history_sections(owner_type, owner_id, display_order);
CREATE INDEX idx_history_entries_section ON history_entries(section_id, display_order);
CREATE INDEX idx_history_requests_requester ON history_update_requests(requester_id, status);
CREATE INDEX idx_history_requests_status ON history_update_requests(status);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get count of pending requests for a user
CREATE OR REPLACE FUNCTION get_user_pending_request_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM history_update_requests
  WHERE requester_id = p_user_id
    AND status = 'pending';
$$;

-- Get max pending requests allowed for a user (defaults to 1)
CREATE OR REPLACE FUNCTION get_user_max_pending_requests(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT max_pending_requests FROM historian_request_limits WHERE user_id = p_user_id),
    1
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE history_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE historian_request_limits ENABLE ROW LEVEL SECURITY;

-- History sections: publicly readable
CREATE POLICY "history_sections_select_public" ON history_sections
  FOR SELECT USING (true);

-- History sections: insert/update/delete require auth
CREATE POLICY "history_sections_insert_auth" ON history_sections
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "history_sections_update_auth" ON history_sections
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "history_sections_delete_auth" ON history_sections
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- History entries: publicly readable
CREATE POLICY "history_entries_select_public" ON history_entries
  FOR SELECT USING (true);

-- History entries: insert/update/delete require auth
CREATE POLICY "history_entries_insert_auth" ON history_entries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "history_entries_update_auth" ON history_entries
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "history_entries_delete_auth" ON history_entries
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- History update requests: users can see their own, admins can see all
CREATE POLICY "history_requests_select_own" ON history_update_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- History update requests: authenticated users can insert their own
CREATE POLICY "history_requests_insert_own" ON history_update_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- History update requests: only admins can update (approve/reject)
CREATE POLICY "history_requests_update_admin" ON history_update_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Historian request limits: admins only
CREATE POLICY "historian_limits_select_admin" ON historian_request_limits
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "historian_limits_insert_admin" ON historian_request_limits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "historian_limits_update_admin" ON historian_request_limits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
