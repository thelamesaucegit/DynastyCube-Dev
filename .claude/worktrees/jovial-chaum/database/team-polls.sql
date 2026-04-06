-- =================================================================================================
-- TEAM-SCOPED POLLS MIGRATION
-- =================================================================================================
-- Description: Adds team_id column to polls table to support team-specific voting
-- Features:
--   - Team-scoped polls visible only to team members
--   - Captain-only poll creation/management
--   - Reuses existing voting infrastructure
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- ADD team_id COLUMN TO polls TABLE
-- Nullable: NULL = global poll, set = team-scoped poll
-- -------------------------------------------------------------------------------------------------
ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS team_id text REFERENCES public.teams(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS polls_team_id_idx ON public.polls(team_id);

COMMENT ON COLUMN public.polls.team_id IS 'Team ID for team-scoped polls. NULL = global poll.';

-- -------------------------------------------------------------------------------------------------
-- HELPER FUNCTION: Check if current user is captain of a given team
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_captain(p_team_id text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.team_member_roles tmr ON tm.id = tmr.team_member_id
    WHERE tm.user_id = auth.uid()
      AND tm.team_id = p_team_id
      AND tmr.role = 'captain'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_team_captain IS 'Check if the current authenticated user is a captain of the specified team';

-- -------------------------------------------------------------------------------------------------
-- HELPER FUNCTION: Check if current user is a member of a given team
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.team_id = p_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_team_member IS 'Check if the current authenticated user is a member of the specified team';

-- -------------------------------------------------------------------------------------------------
-- RLS POLICIES FOR TEAM POLLS
-- These coexist with existing admin policies via PostgreSQL OR logic
-- -------------------------------------------------------------------------------------------------

-- Captains can create team-scoped polls
CREATE POLICY "Captains can create team polls"
  ON public.polls FOR INSERT
  WITH CHECK (
    team_id IS NOT NULL
    AND public.is_team_captain(team_id)
  );

-- Captains can update their team's polls
CREATE POLICY "Captains can update team polls"
  ON public.polls FOR UPDATE
  USING (
    team_id IS NOT NULL
    AND public.is_team_captain(team_id)
  );

-- Captains can delete their team's polls
CREATE POLICY "Captains can delete team polls"
  ON public.polls FOR DELETE
  USING (
    team_id IS NOT NULL
    AND public.is_team_captain(team_id)
  );

-- -------------------------------------------------------------------------------------------------
-- RLS POLICIES FOR TEAM POLL OPTIONS
-- -------------------------------------------------------------------------------------------------

-- Captains can create options for their team polls
CREATE POLICY "Captains can create team poll options"
  ON public.poll_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND p.team_id IS NOT NULL
        AND public.is_team_captain(p.team_id)
    )
  );

-- Captains can delete options for their team polls
CREATE POLICY "Captains can delete team poll options"
  ON public.poll_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_id
        AND p.team_id IS NOT NULL
        AND public.is_team_captain(p.team_id)
    )
  );

-- -------------------------------------------------------------------------------------------------
-- UPDATE active_polls_view TO INCLUDE team_id
-- Must DROP first because adding a new column changes the view's column list
-- -------------------------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.active_polls_view;

CREATE VIEW public.active_polls_view AS
SELECT
  p.id,
  p.title,
  p.description,
  p.starts_at,
  p.ends_at,
  p.allow_multiple_votes,
  p.show_results_before_end,
  p.vote_type,
  p.total_votes,
  p.created_at,
  p.team_id,
  CASE
    WHEN p.ends_at < now() THEN 'ended'
    WHEN p.starts_at > now() THEN 'upcoming'
    ELSE 'active'
  END as status,
  COUNT(DISTINCT po.id) as option_count
FROM public.polls p
LEFT JOIN public.poll_options po ON po.poll_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.title, p.description, p.starts_at, p.ends_at,
         p.allow_multiple_votes, p.show_results_before_end, p.vote_type,
         p.total_votes, p.created_at, p.team_id
ORDER BY
  CASE
    WHEN p.ends_at < now() THEN 2
    WHEN p.starts_at > now() THEN 1
    ELSE 0
  END,
  p.created_at DESC;

COMMENT ON VIEW public.active_polls_view IS 'View of active polls with status, option counts, and team_id';

-- Re-grant permissions that were lost when the view was dropped
GRANT SELECT ON public.active_polls_view TO anon;
GRANT SELECT ON public.active_polls_view TO authenticated;

-- =================================================================================================
-- SUCCESS MESSAGE
-- =================================================================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Team Polls Migration Applied Successfully!';
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - Added team_id column to polls table';
  RAISE NOTICE '  - Created is_team_captain() helper function';
  RAISE NOTICE '  - Created is_team_member() helper function';
  RAISE NOTICE '  - Added RLS policies for captain poll management';
  RAISE NOTICE '  - Updated active_polls_view to include team_id';
  RAISE NOTICE '=================================================================================================';
END $$;
