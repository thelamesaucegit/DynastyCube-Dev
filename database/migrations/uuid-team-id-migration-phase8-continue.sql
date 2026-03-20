-- =============================================================================
-- CONTINUATION: UUID Team ID Migration — Phase 8 onwards
-- =============================================================================
-- Use this script if the full uuid-team-id-migration.sql already ran through
-- Phase 7 (teams.id is now UUID, teams.short_name exists) but failed at Phase 8.
--
-- Safe to run multiple times — uses IF EXISTS / DO blocks throughout.
-- HOW TO RUN: Paste this entire script into the Supabase SQL editor and run.
-- =============================================================================

-- =============================================================================
-- PHASE 6.5 (re-apply): Drop views that depend on any team FK column
-- Needed because a previous partial run may have recreated them in Phase 9.5.
-- They are recreated again in Phase 9.5 below.
-- =============================================================================

DROP VIEW IF EXISTS public.active_trades_view CASCADE;
DROP VIEW IF EXISTS public.team_members_with_roles CASCADE;
DROP VIEW IF EXISTS public.deck_stats CASCADE;
DROP VIEW IF EXISTS public.notification_counts_view CASCADE;
DROP VIEW IF EXISTS public.message_counts_view CASCADE;
DROP VIEW IF EXISTS public.pending_reports_view CASCADE;
DROP VIEW IF EXISTS public.current_season_info CASCADE;
DROP VIEW IF EXISTS public.active_polls_view CASCADE;

-- =============================================================================
-- PHASE 3 (supplement): Backfill _new_team_id for tables omitted from the
-- original Phase 3 — team_draft_queue and auto_draft_log.
-- Join on teams.id (old text PK) and use teams._new_id (UUID) as the value,
-- matching the pattern used in the main migration. IS NULL guard makes this a no-op if already done.
-- =============================================================================

-- team_draft_queue
DO $$
DECLARE
  v_teams_id_type text;
  v_queue_team_id_type text;
  v_new_id_exists boolean;
BEGIN
  SELECT data_type INTO v_teams_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'id';

  SELECT data_type INTO v_queue_team_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'team_draft_queue' AND column_name = 'team_id';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = '_new_id'
  ) INTO v_new_id_exists;

  IF v_queue_team_id_type = 'uuid' THEN
    -- team_draft_queue.team_id already UUID (main migration handled it); nothing to do
    NULL;
  ELSIF v_teams_id_type = 'uuid' THEN
    -- teams.id is UUID but team_draft_queue.team_id is still text; backfill then swap
    ALTER TABLE public.team_draft_queue ADD COLUMN IF NOT EXISTS _new_team_id uuid;
    UPDATE public.team_draft_queue SET _new_team_id = t.id
    FROM public.teams t
    WHERE t.short_name = public.team_draft_queue.team_id
      AND public.team_draft_queue._new_team_id IS NULL;
  ELSIF v_new_id_exists THEN
    -- teams._new_id is the UUID; join on old text id
    ALTER TABLE public.team_draft_queue ADD COLUMN IF NOT EXISTS _new_team_id uuid;
    UPDATE public.team_draft_queue SET _new_team_id = t._new_id
    FROM public.teams t
    WHERE t.id = public.team_draft_queue.team_id
      AND public.team_draft_queue._new_team_id IS NULL;
  -- ELSE: main migration hasn't run yet; it will handle this table
  END IF;
END $$;

-- auto_draft_log
DO $$
DECLARE
  v_teams_id_type text;
  v_log_team_id_type text;
  v_new_id_exists boolean;
BEGIN
  SELECT data_type INTO v_teams_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'id';

  SELECT data_type INTO v_log_team_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'auto_draft_log' AND column_name = 'team_id';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = '_new_id'
  ) INTO v_new_id_exists;

  IF v_log_team_id_type = 'uuid' THEN
    -- auto_draft_log.team_id already UUID (main migration handled it); nothing to do
    NULL;
  ELSIF v_teams_id_type = 'uuid' THEN
    ALTER TABLE public.auto_draft_log ADD COLUMN IF NOT EXISTS _new_team_id uuid;
    UPDATE public.auto_draft_log SET _new_team_id = t.id
    FROM public.teams t
    WHERE t.short_name = public.auto_draft_log.team_id
      AND public.auto_draft_log._new_team_id IS NULL;
  ELSIF v_new_id_exists THEN
    ALTER TABLE public.auto_draft_log ADD COLUMN IF NOT EXISTS _new_team_id uuid;
    UPDATE public.auto_draft_log SET _new_team_id = t._new_id
    FROM public.teams t
    WHERE t.id = public.auto_draft_log.team_id
      AND public.auto_draft_log._new_team_id IS NULL;
  -- ELSE: main migration hasn't run yet; it will handle this table
  END IF;
END $$;

-- =============================================================================
-- PHASE 8 (supplement): Swap team_draft_queue and auto_draft_log team_id columns
-- =============================================================================

-- team_draft_queue: has two unique constraints that include team_id — drop first.
DO $$
DECLARE v_teams_id_type text;
BEGIN
  SELECT data_type INTO v_teams_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'id';

  IF v_teams_id_type = 'uuid' AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_draft_queue' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.team_draft_queue DROP CONSTRAINT IF EXISTS unique_team_card_queue;
    ALTER TABLE public.team_draft_queue DROP CONSTRAINT IF EXISTS unique_team_position;
    -- CASCADE also drops the dependent indexes idx_draft_queue_team and idx_draft_queue_team_position
    ALTER TABLE public.team_draft_queue DROP COLUMN IF EXISTS team_id CASCADE;
    ALTER TABLE public.team_draft_queue RENAME COLUMN _new_team_id TO team_id;
    -- Re-add FK and unique constraints
    ALTER TABLE public.team_draft_queue DROP CONSTRAINT IF EXISTS team_draft_queue_team_id_fkey;
    ALTER TABLE public.team_draft_queue ADD CONSTRAINT team_draft_queue_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
    ALTER TABLE public.team_draft_queue ADD CONSTRAINT unique_team_card_queue UNIQUE (team_id, card_pool_id);
    ALTER TABLE public.team_draft_queue ADD CONSTRAINT unique_team_position UNIQUE (team_id, position);
    CREATE INDEX IF NOT EXISTS idx_draft_queue_team ON public.team_draft_queue(team_id);
    CREATE INDEX IF NOT EXISTS idx_draft_queue_team_position ON public.team_draft_queue(team_id, position);
  END IF;
END $$;

-- auto_draft_log: no unique constraints on team_id, just an index.
DO $$
DECLARE v_teams_id_type text;
BEGIN
  SELECT data_type INTO v_teams_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'id';

  IF v_teams_id_type = 'uuid' AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auto_draft_log' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.auto_draft_log DROP COLUMN IF EXISTS team_id CASCADE;
    ALTER TABLE public.auto_draft_log RENAME COLUMN _new_team_id TO team_id;
    ALTER TABLE public.auto_draft_log DROP CONSTRAINT IF EXISTS auto_draft_log_team_id_fkey;
    ALTER TABLE public.auto_draft_log ADD CONSTRAINT auto_draft_log_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_auto_draft_log_team ON public.auto_draft_log(team_id);
  END IF;
END $$;

-- =============================================================================
-- PHASE 8: Drop old text FK columns, rename new UUID columns to canonical names
-- Each table is wrapped in a single DO block that checks whether _new_* still
-- exists before touching anything. This makes the script safe to re-run at any
-- point: if a table was already fully migrated in a previous partial run its
-- DO block becomes a no-op.
-- =============================================================================

-- team_members: CASCADE drops the 22 RLS policies and 1 trigger on team_id.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.team_members DROP COLUMN IF EXISTS team_id CASCADE;
    ALTER TABLE public.team_members RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- team_season_stats
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_season_stats' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.team_season_stats DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.team_season_stats RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- team_draft_picks
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_draft_picks' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.team_draft_picks DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.team_draft_picks RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- team_decks
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_decks' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.team_decks DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.team_decks RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- cubucks_transactions
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cubucks_transactions' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.cubucks_transactions DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.cubucks_transactions RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- trades (two FK columns)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = '_new_from_team_id'
  ) THEN
    ALTER TABLE public.trades DROP COLUMN IF EXISTS from_team_id;
    ALTER TABLE public.trades RENAME COLUMN _new_from_team_id TO from_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = '_new_to_team_id'
  ) THEN
    ALTER TABLE public.trades DROP COLUMN IF EXISTS to_team_id;
    ALTER TABLE public.trades RENAME COLUMN _new_to_team_id TO to_team_id;
  END IF;
END $$;

-- trade_items
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_items' AND column_name = '_new_offering_team_id'
  ) THEN
    ALTER TABLE public.trade_items DROP COLUMN IF EXISTS offering_team_id;
    ALTER TABLE public.trade_items RENAME COLUMN _new_offering_team_id TO offering_team_id;
  END IF;
END $$;

-- future_draft_picks (three FK columns)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'future_draft_picks' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.future_draft_picks DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.future_draft_picks RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'future_draft_picks' AND column_name = '_new_original_team_id'
  ) THEN
    ALTER TABLE public.future_draft_picks DROP COLUMN IF EXISTS original_team_id;
    ALTER TABLE public.future_draft_picks RENAME COLUMN _new_original_team_id TO original_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'future_draft_picks' AND column_name = '_new_traded_to_team_id'
  ) THEN
    ALTER TABLE public.future_draft_picks DROP COLUMN IF EXISTS traded_to_team_id;
    ALTER TABLE public.future_draft_picks RENAME COLUMN _new_traded_to_team_id TO traded_to_team_id;
  END IF;
END $$;

-- matches (three FK columns)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = '_new_home_team_id'
  ) THEN
    ALTER TABLE public.matches DROP COLUMN IF EXISTS home_team_id;
    ALTER TABLE public.matches RENAME COLUMN _new_home_team_id TO home_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = '_new_away_team_id'
  ) THEN
    ALTER TABLE public.matches DROP COLUMN IF EXISTS away_team_id;
    ALTER TABLE public.matches RENAME COLUMN _new_away_team_id TO away_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = '_new_winner_team_id'
  ) THEN
    ALTER TABLE public.matches DROP COLUMN IF EXISTS winner_team_id;
    ALTER TABLE public.matches RENAME COLUMN _new_winner_team_id TO winner_team_id;
  END IF;
END $$;

-- match_games (three FK columns)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_games' AND column_name = '_new_winner_team_id'
  ) THEN
    ALTER TABLE public.match_games DROP COLUMN IF EXISTS winner_team_id;
    ALTER TABLE public.match_games RENAME COLUMN _new_winner_team_id TO winner_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_games' AND column_name = '_new_reported_by_team_id'
  ) THEN
    ALTER TABLE public.match_games DROP COLUMN IF EXISTS reported_by_team_id;
    ALTER TABLE public.match_games RENAME COLUMN _new_reported_by_team_id TO reported_by_team_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_games' AND column_name = '_new_confirmed_by_team_id'
  ) THEN
    ALTER TABLE public.match_games DROP COLUMN IF EXISTS confirmed_by_team_id;
    ALTER TABLE public.match_games RENAME COLUMN _new_confirmed_by_team_id TO confirmed_by_team_id;
  END IF;
END $$;

-- deck_submissions
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_submissions' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.deck_submissions DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.deck_submissions RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- deadlines
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deadlines' AND column_name = '_new_team_id'
  ) THEN
    ALTER TABLE public.deadlines DROP COLUMN IF EXISTS team_id;
    ALTER TABLE public.deadlines RENAME COLUMN _new_team_id TO team_id;
  END IF;
END $$;

-- draft_sessions
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'draft_sessions' AND column_name = '_new_current_on_clock_team_id'
  ) THEN
    ALTER TABLE public.draft_sessions DROP COLUMN IF EXISTS current_on_clock_team_id;
    ALTER TABLE public.draft_sessions RENAME COLUMN _new_current_on_clock_team_id TO current_on_clock_team_id;
  END IF;
END $$;

-- =============================================================================
-- PHASE 8.5: Recreate RLS policies dropped by CASCADE in Phase 8
-- All 22 policies that referenced team_members.team_id (old text column)
-- are recreated here with the same logic — now backed by the uuid column.
-- NOTE: trigger_maintain_team_member_count was also dropped by CASCADE.
--       It was created directly in Supabase and has no local definition.
--       Recreate it manually in Supabase if it is still needed.
-- =============================================================================

-- trades: "Trades can be created by team members" (from trades-system.sql)
DROP POLICY IF EXISTS "Trades can be created by team members" ON public.trades;
CREATE POLICY "Trades can be created by team members"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    AND public.are_trades_enabled()
  );

-- trades: "Trades can be updated by involved teams" (from trades-system.sql)
DROP POLICY IF EXISTS "Trades can be updated by involved teams" ON public.trades;
CREATE POLICY "Trades can be updated by involved teams"
  ON public.trades FOR UPDATE
  TO authenticated
  USING (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- trades: "Trades are viewable by involved teams" (from production-schema.sql)
DROP POLICY IF EXISTS "Trades are viewable by involved teams" ON public.trades;
CREATE POLICY "Trades are viewable by involved teams"
  ON public.trades FOR SELECT
  USING (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- trades: "Team members can create trades" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can create trades" ON public.trades;
CREATE POLICY "Team members can create trades"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    AND public.are_trades_enabled()
  );

-- trades: "Involved teams can update trades" (from production-schema.sql)
DROP POLICY IF EXISTS "Involved teams can update trades" ON public.trades;
CREATE POLICY "Involved teams can update trades"
  ON public.trades FOR UPDATE
  TO authenticated
  USING (
    from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- trade_messages: "Trade messages can be created by involved teams" (from trades-system.sql)
DROP POLICY IF EXISTS "Trade messages can be created by involved teams" ON public.trade_messages;
CREATE POLICY "Trade messages can be created by involved teams"
  ON public.trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- trade_items: "Trade items are viewable by involved teams" (from production-schema.sql)
DROP POLICY IF EXISTS "Trade items are viewable by involved teams" ON public.trade_items;
CREATE POLICY "Trade items are viewable by involved teams"
  ON public.trade_items FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    ) OR public.is_admin()
  );

-- trade_items: "Trade items can be created with trades" (from production-schema.sql)
DROP POLICY IF EXISTS "Trade items can be created with trades" ON public.trade_items;
CREATE POLICY "Trade items can be created with trades"
  ON public.trade_items FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

-- trade_messages: "Trade messages are viewable by involved teams" (from production-schema.sql)
DROP POLICY IF EXISTS "Trade messages are viewable by involved teams" ON public.trade_messages;
CREATE POLICY "Trade messages are viewable by involved teams"
  ON public.trade_messages FOR SELECT
  USING (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    ) OR public.is_admin()
  );

-- trade_messages: "Team members can send trade messages" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can send trade messages" ON public.trade_messages;
CREATE POLICY "Team members can send trade messages"
  ON public.trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    trade_id IN (
      SELECT id FROM public.trades
      WHERE from_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
         OR to_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- match_games: "Team members can report match games" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can report match games" ON public.match_games;
CREATE POLICY "Team members can report match games"
  ON public.match_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    )
  );

-- match_games: "Team members can update their match games" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can update their match games" ON public.match_games;
CREATE POLICY "Team members can update their match games"
  ON public.match_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = reported_by_team_id
    ) OR public.is_admin()
  );

-- deck_submissions: "Teams can view their own deck submissions" (from production-schema.sql)
DROP POLICY IF EXISTS "Teams can view their own deck submissions" ON public.deck_submissions;
CREATE POLICY "Teams can view their own deck submissions"
  ON public.deck_submissions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    ) OR public.is_admin()
  );

-- deck_submissions: "Team members can submit decks" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can submit decks" ON public.deck_submissions;
CREATE POLICY "Team members can submit decks"
  ON public.deck_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    )
  );

-- deck_submissions: "Team members can update their deck submissions" (from production-schema.sql)
DROP POLICY IF EXISTS "Team members can update their deck submissions" ON public.deck_submissions;
CREATE POLICY "Team members can update their deck submissions"
  ON public.deck_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.team_id = deck_submissions.team_id
    ) OR public.is_admin()
  );

-- match_time_proposals: "Teams can view their match proposals" (from match-time-scheduling.sql)
DROP POLICY IF EXISTS "Teams can view their match proposals" ON public.match_time_proposals;
CREATE POLICY "Teams can view their match proposals"
  ON public.match_time_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_time_proposals.match_id
      AND (
        m.home_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
        OR m.away_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
      )
    )
    OR (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

-- match_time_proposals: "Pilots and Captains can create proposals" (from match-time-scheduling.sql)
DROP POLICY IF EXISTS "Pilots and Captains can create proposals" ON public.match_time_proposals;
CREATE POLICY "Pilots and Captains can create proposals"
  ON public.match_time_proposals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_member_roles tmr
      JOIN public.team_members tm ON tm.id = tmr.team_member_id
      JOIN public.matches m ON m.id = match_time_proposals.match_id
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = match_time_proposals.proposed_by_team_id
      AND tmr.role IN ('pilot', 'captain')
      AND (m.home_team_id = tm.team_id OR m.away_team_id = tm.team_id)
    )
  );

-- match_time_proposals: "Pilots and Captains can respond to proposals" (from match-time-scheduling.sql)
DROP POLICY IF EXISTS "Pilots and Captains can respond to proposals" ON public.match_time_proposals;
CREATE POLICY "Pilots and Captains can respond to proposals"
  ON public.match_time_proposals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_member_roles tmr
      JOIN public.team_members tm ON tm.id = tmr.team_member_id
      JOIN public.matches m ON m.id = match_time_proposals.match_id
      WHERE tm.user_id = auth.uid()
      AND tmr.role IN ('pilot', 'captain')
      AND (
        (m.home_team_id = tm.team_id AND m.away_team_id = match_time_proposals.proposed_by_team_id)
        OR (m.away_team_id = tm.team_id AND m.home_team_id = match_time_proposals.proposed_by_team_id)
      )
    )
    OR (SELECT is_admin FROM public.users WHERE id = auth.uid())
  );

-- matches: "Team members can update match statistics" (from fix_matches_rls_withcheck.sql)
DROP POLICY IF EXISTS "Team members can update match statistics" ON public.matches;
CREATE POLICY "Team members can update match statistics"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.team_id IN (matches.home_team_id, matches.away_team_id)
    )
  )
  WITH CHECK (true);

-- team_draft_queue: "draft_queue_insert_team_member" (from auto-draft-queue.sql)
DROP POLICY IF EXISTS "draft_queue_insert_team_member" ON public.team_draft_queue;
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

-- team_draft_queue: "draft_queue_update_team_member" (from auto-draft-queue.sql)
DROP POLICY IF EXISTS "draft_queue_update_team_member" ON public.team_draft_queue;
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

-- team_draft_queue: "draft_queue_delete_team_member" (from auto-draft-queue.sql)
DROP POLICY IF EXISTS "draft_queue_delete_team_member" ON public.team_draft_queue;
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

-- =============================================================================
-- PHASE 9: Re-add FK constraints (now uuid → uuid)
-- =============================================================================

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.team_season_stats DROP CONSTRAINT IF EXISTS team_season_stats_team_id_fkey;
ALTER TABLE public.team_season_stats ADD CONSTRAINT team_season_stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.team_draft_picks DROP CONSTRAINT IF EXISTS team_draft_picks_team_id_fkey;
ALTER TABLE public.team_draft_picks ADD CONSTRAINT team_draft_picks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.team_decks DROP CONSTRAINT IF EXISTS team_decks_team_id_fkey;
ALTER TABLE public.team_decks ADD CONSTRAINT team_decks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.cubucks_transactions DROP CONSTRAINT IF EXISTS cubucks_transactions_team_id_fkey;
ALTER TABLE public.cubucks_transactions ADD CONSTRAINT cubucks_transactions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_from_team_id_fkey;
ALTER TABLE public.trades ADD CONSTRAINT trades_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_to_team_id_fkey;
ALTER TABLE public.trades ADD CONSTRAINT trades_to_team_id_fkey FOREIGN KEY (to_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.trade_items DROP CONSTRAINT IF EXISTS trade_items_offering_team_id_fkey;
ALTER TABLE public.trade_items ADD CONSTRAINT trade_items_offering_team_id_fkey FOREIGN KEY (offering_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.future_draft_picks DROP CONSTRAINT IF EXISTS future_draft_picks_team_id_fkey;
ALTER TABLE public.future_draft_picks ADD CONSTRAINT future_draft_picks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.future_draft_picks DROP CONSTRAINT IF EXISTS future_draft_picks_original_team_id_fkey;
ALTER TABLE public.future_draft_picks ADD CONSTRAINT future_draft_picks_original_team_id_fkey FOREIGN KEY (original_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.future_draft_picks DROP CONSTRAINT IF EXISTS future_draft_picks_traded_to_team_id_fkey;
ALTER TABLE public.future_draft_picks ADD CONSTRAINT future_draft_picks_traded_to_team_id_fkey FOREIGN KEY (traded_to_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_home_team_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_away_team_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_winner_team_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.match_games DROP CONSTRAINT IF EXISTS match_games_winner_team_id_fkey;
ALTER TABLE public.match_games ADD CONSTRAINT match_games_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.match_games DROP CONSTRAINT IF EXISTS match_games_reported_by_team_id_fkey;
ALTER TABLE public.match_games ADD CONSTRAINT match_games_reported_by_team_id_fkey FOREIGN KEY (reported_by_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.match_games DROP CONSTRAINT IF EXISTS match_games_confirmed_by_team_id_fkey;
ALTER TABLE public.match_games ADD CONSTRAINT match_games_confirmed_by_team_id_fkey FOREIGN KEY (confirmed_by_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.deck_submissions DROP CONSTRAINT IF EXISTS deck_submissions_team_id_fkey;
ALTER TABLE public.deck_submissions ADD CONSTRAINT deck_submissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.deadlines DROP CONSTRAINT IF EXISTS deadlines_team_id_fkey;
ALTER TABLE public.deadlines ADD CONSTRAINT deadlines_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.draft_sessions DROP CONSTRAINT IF EXISTS draft_sessions_current_on_clock_team_id_fkey;
ALTER TABLE public.draft_sessions ADD CONSTRAINT draft_sessions_current_on_clock_team_id_fkey FOREIGN KEY (current_on_clock_team_id) REFERENCES public.teams(id);

-- =============================================================================
-- PHASE 9.5: Recreate views (now backed by UUID columns, same SQL)
-- =============================================================================

CREATE OR REPLACE VIEW public.team_members_with_roles AS
SELECT
  tm.id as member_id,
  tm.user_id,
  tm.user_email,
  u.display_name as user_display_name,
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
FROM public.team_members tm
LEFT JOIN public.users u ON tm.user_id = u.id
LEFT JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
GROUP BY tm.id, tm.user_id, tm.user_email, u.display_name, tm.team_id, tm.joined_at;

CREATE OR REPLACE VIEW public.deck_stats AS
SELECT
  d.id as deck_id,
  d.deck_name,
  d.team_id,
  COUNT(dc.id) as card_count,
  SUM(dc.quantity) as total_cards,
  AVG(tdp.cmc) as avg_cmc
FROM public.team_decks d
LEFT JOIN public.deck_cards dc ON d.id = dc.deck_id
LEFT JOIN public.team_draft_picks tdp ON dc.draft_pick_id = tdp.id
GROUP BY d.id, d.deck_name, d.team_id;

CREATE OR REPLACE VIEW public.active_trades_view AS
SELECT
  t.id,
  t.from_team_id,
  ft.name as from_team_name,
  ft.emoji as from_team_emoji,
  t.to_team_id,
  tt.name as to_team_name,
  tt.emoji as to_team_emoji,
  t.status,
  t.deadline,
  t.created_at,
  t.updated_at,
  EXTRACT(EPOCH FROM (t.deadline - now())) / 3600 as hours_remaining
FROM public.trades t
JOIN public.teams ft ON t.from_team_id = ft.id
JOIN public.teams tt ON t.to_team_id = tt.id
WHERE t.status IN ('pending', 'accepted')
ORDER BY t.created_at DESC;

CREATE OR REPLACE VIEW public.notification_counts_view AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM public.notifications
GROUP BY user_id;

CREATE OR REPLACE VIEW public.message_counts_view AS
SELECT
  to_user_id as user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM public.messages
GROUP BY to_user_id;

-- =============================================================================
-- PHASE 10: Re-add composite UNIQUE constraints (now on uuid columns)
-- =============================================================================

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_user_id_team_id_key;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_team_id_key UNIQUE (user_id, team_id);

ALTER TABLE public.team_season_stats DROP CONSTRAINT IF EXISTS team_season_stats_team_id_season_id_key;
ALTER TABLE public.team_season_stats ADD CONSTRAINT team_season_stats_team_id_season_id_key UNIQUE (team_id, season_id);

-- team_draft_picks: use a partial unique index excluding 'skipped-pick',
-- since a team can legitimately have multiple skipped picks in one draft.
ALTER TABLE public.team_draft_picks DROP CONSTRAINT IF EXISTS team_draft_picks_team_id_card_id_key;
DROP INDEX IF EXISTS public.team_draft_picks_team_id_card_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS team_draft_picks_team_id_card_id_key
  ON public.team_draft_picks (team_id, card_id)
  WHERE card_id != 'skipped-pick';

ALTER TABLE public.future_draft_picks DROP CONSTRAINT IF EXISTS future_draft_picks_original_team_id_season_id_round_number_key;
ALTER TABLE public.future_draft_picks ADD CONSTRAINT future_draft_picks_original_team_id_season_id_round_number_key UNIQUE (original_team_id, season_id, round_number);

ALTER TABLE public.deck_submissions DROP CONSTRAINT IF EXISTS unique_current_team_week;
ALTER TABLE public.deck_submissions ADD CONSTRAINT unique_current_team_week UNIQUE (team_id, week_id, is_current);

-- =============================================================================
-- PHASE 11: Re-add CHECK constraints (now on uuid columns)
-- =============================================================================

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS different_teams;
ALTER TABLE public.trades ADD CONSTRAINT different_teams CHECK (from_team_id != to_team_id);

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS different_teams;
ALTER TABLE public.matches ADD CONSTRAINT different_teams CHECK (home_team_id != away_team_id);

-- =============================================================================
-- PHASE 12: Recreate stored functions with uuid parameter types
-- =============================================================================

CREATE OR REPLACE FUNCTION public.allocate_cubucks_to_team(
  p_team_id uuid,
  p_amount integer,
  p_season_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_new_balance integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(p_season_id, public.get_active_season());

  UPDATE public.teams
  SET
    cubucks_balance = cubucks_balance + p_amount,
    cubucks_total_earned = cubucks_total_earned + p_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  INSERT INTO public.cubucks_transactions (
    team_id, season_id, transaction_type, amount, balance_after, description, created_by
  ) VALUES (
    p_team_id, v_season_id, 'allocation', p_amount, v_new_balance,
    COALESCE(p_description, 'Cubucks allocation'), p_created_by
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.spend_cubucks_on_draft(
  p_team_id uuid,
  p_amount integer,
  p_card_id text,
  p_card_name text,
  p_draft_pick_id uuid DEFAULT NULL,
  p_season_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(p_season_id, public.get_active_season());

  SELECT cubucks_balance INTO v_current_balance
  FROM public.teams WHERE id = p_team_id;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Cubucks. Balance: %, Cost: %', v_current_balance, p_amount;
  END IF;

  UPDATE public.teams
  SET
    cubucks_balance = cubucks_balance - p_amount,
    cubucks_total_spent = cubucks_total_spent + p_amount
  WHERE id = p_team_id
  RETURNING cubucks_balance INTO v_new_balance;

  INSERT INTO public.cubucks_transactions (
    team_id, season_id, transaction_type, amount, balance_after,
    card_id, card_name, draft_pick_id, description
  ) VALUES (
    p_team_id, v_season_id, 'draft_pick', -p_amount, v_new_balance,
    p_card_id, p_card_name, p_draft_pick_id, 'Drafted ' || p_card_name
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_has_team_role(
  p_user_id uuid,
  p_team_id uuid,
  p_role text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
      AND tmr.role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_team_roles(
  p_user_id uuid,
  p_team_id uuid
)
RETURNS text[] AS $$
DECLARE
  user_roles text[];
BEGIN
  SELECT ARRAY_AGG(tmr.role)
  INTO user_roles
  FROM public.team_members tm
  JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
  WHERE tm.user_id = p_user_id
    AND tm.team_id = p_team_id;

  RETURN COALESCE(user_roles, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
  'teams.id type' AS check_name,
  data_type AS result
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'id'

UNION ALL

SELECT
  'teams.short_name exists',
  CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'short_name'

UNION ALL

SELECT
  'team_members.team_id type',
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'team_id'

UNION ALL

SELECT
  'team count preserved',
  COUNT(*)::text
FROM public.teams;
