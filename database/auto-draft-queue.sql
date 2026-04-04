-- ============================================================================
-- Auto-Draft Priority Queue System
-- ============================================================================
-- Adds a team_draft_queue table for manual priority overrides
-- and an auto_draft_log table for audit trail of auto-draft executions.
-- ============================================================================

-- ============================================================================
-- TABLE: team_draft_queue
-- Stores manual priority overrides per team. Cards not in this table
-- fall back to the algorithm-computed order (ELO + color affinity).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_draft_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  card_pool_id uuid NOT NULL REFERENCES public.card_pools(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  position integer NOT NULL,
  pinned boolean DEFAULT false,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_team_card_queue UNIQUE (team_id, card_pool_id),
  CONSTRAINT unique_team_position UNIQUE (team_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draft_queue_team ON public.team_draft_queue(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_queue_team_position ON public.team_draft_queue(team_id, position);
CREATE INDEX IF NOT EXISTS idx_draft_queue_card ON public.team_draft_queue(card_id);

-- ============================================================================
-- TABLE: auto_draft_log
-- Audit trail for auto-draft executions, tracking what was picked and why.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auto_draft_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_pool_id uuid,
  pick_source text NOT NULL CHECK (pick_source IN ('algorithm', 'manual_queue')),
  algorithm_details jsonb,
  round_number integer,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_draft_log_team ON public.auto_draft_log(team_id);
CREATE INDEX IF NOT EXISTS idx_auto_draft_log_created ON public.auto_draft_log(created_at DESC);

-- ============================================================================
-- RLS POLICIES: team_draft_queue
-- ============================================================================

ALTER TABLE public.team_draft_queue ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read any team's queue
CREATE POLICY "draft_queue_select_authenticated"
  ON public.team_draft_queue FOR SELECT
  TO authenticated
  USING (true);

-- Team members can insert their own team's queue entries
CREATE POLICY "draft_queue_insert_team_member"
  ON public.team_draft_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_draft_queue.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Team members can update their own team's queue entries
CREATE POLICY "draft_queue_update_team_member"
  ON public.team_draft_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_draft_queue.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Team members can delete their own team's queue entries
CREATE POLICY "draft_queue_delete_team_member"
  ON public.team_draft_queue FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_draft_queue.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: auto_draft_log
-- ============================================================================

ALTER TABLE public.auto_draft_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the log
CREATE POLICY "auto_draft_log_select_authenticated"
  ON public.auto_draft_log FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert log entries (server actions run as authenticated)
CREATE POLICY "auto_draft_log_insert_authenticated"
  ON public.auto_draft_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
