-- =================================================================================================
-- MULTI-TYPE VOTING SYSTEM SCHEMA
-- =================================================================================================
-- Description: Extends the voting system to support three vote types:
--   - Individual: Each user = 1 vote, single global winner
--   - Team: Members vote within team, each team gets own result
--   - League: Weighted roles + team aggregation
-- =================================================================================================

-- =================================================================================================
-- 1. MODIFY POLLS TABLE - Add vote_type column
-- =================================================================================================

ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS vote_type text NOT NULL DEFAULT 'individual'
CHECK (vote_type IN ('individual', 'team', 'league'));

COMMENT ON COLUMN public.polls.vote_type IS 'Type of vote: individual (1 person = 1 vote), team (each team gets separate result), league (weighted team representation)';

-- =================================================================================================
-- 2. MODIFY POLL_VOTES TABLE - Add vote_weight and team_id columns
-- =================================================================================================

ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS vote_weight integer NOT NULL DEFAULT 1;

ALTER TABLE public.poll_votes
ADD COLUMN IF NOT EXISTS team_id text REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS poll_votes_team_id_idx ON public.poll_votes(team_id);
CREATE INDEX IF NOT EXISTS poll_votes_weight_idx ON public.poll_votes(vote_weight);

COMMENT ON COLUMN public.poll_votes.vote_weight IS 'Weight of the vote (1 for individual/team, role-based for league)';
COMMENT ON COLUMN public.poll_votes.team_id IS 'Team ID for team/league polls';

-- =================================================================================================
-- 3. NEW TABLE: poll_team_results
-- Stores each team's winning option for team/league polls
-- =================================================================================================

CREATE TABLE IF NOT EXISTS public.poll_team_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  winning_option_id uuid REFERENCES public.poll_options(id) ON DELETE SET NULL,
  total_weighted_votes integer NOT NULL DEFAULT 0,
  calculated_at timestamp with time zone DEFAULT now(),
  UNIQUE(poll_id, team_id)
);

CREATE INDEX IF NOT EXISTS poll_team_results_poll_id_idx ON public.poll_team_results(poll_id);
CREATE INDEX IF NOT EXISTS poll_team_results_team_id_idx ON public.poll_team_results(team_id);

COMMENT ON TABLE public.poll_team_results IS 'Stores each team''s winning option for team/league polls';

-- Enable RLS
ALTER TABLE public.poll_team_results ENABLE ROW LEVEL SECURITY;

-- Everyone can view team results
CREATE POLICY "Anyone can view team results"
  ON public.poll_team_results FOR SELECT
  USING (true);

-- Only system/admin can modify team results
CREATE POLICY "Admins can manage team results"
  ON public.poll_team_results FOR ALL
  USING (public.is_admin());

-- =================================================================================================
-- 4. NEW TABLE: poll_league_results
-- Stores final league result (aggregated team votes)
-- =================================================================================================

CREATE TABLE IF NOT EXISTS public.poll_league_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE UNIQUE,
  winning_option_id uuid REFERENCES public.poll_options(id) ON DELETE SET NULL,
  teams_for_option jsonb NOT NULL DEFAULT '{}',
  calculated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_league_results_poll_id_idx ON public.poll_league_results(poll_id);

COMMENT ON TABLE public.poll_league_results IS 'Stores final league result with team breakdown';
COMMENT ON COLUMN public.poll_league_results.teams_for_option IS 'JSON object mapping option_id to array of team_ids that voted for it';

-- Enable RLS
ALTER TABLE public.poll_league_results ENABLE ROW LEVEL SECURITY;

-- Everyone can view league results
CREATE POLICY "Anyone can view league results"
  ON public.poll_league_results FOR SELECT
  USING (true);

-- Only system/admin can modify league results
CREATE POLICY "Admins can manage league results"
  ON public.poll_league_results FOR ALL
  USING (public.is_admin());

-- =================================================================================================
-- 5. FUNCTION: get_user_vote_weight
-- Returns vote weight based on user's roles in their team
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.get_user_vote_weight(p_user_id uuid, p_team_id text)
RETURNS integer AS $$
DECLARE
  v_weight integer := 1; -- Default weight (no role or historian)
  v_roles text[];
BEGIN
  -- Get all roles for the user on the team
  SELECT ARRAY_AGG(tmr.role)
  INTO v_roles
  FROM team_members tm
  JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
  WHERE tm.user_id = p_user_id
    AND tm.team_id = p_team_id;

  -- Return default if no roles
  IF v_roles IS NULL THEN
    RETURN 1;
  END IF;

  -- Calculate weight based on highest-weighted role
  -- Captain: 3, Pilot: 2, Broker: 2, Historian/No role: 1
  IF 'captain' = ANY(v_roles) THEN
    v_weight := 3;
  ELSIF 'pilot' = ANY(v_roles) OR 'broker' = ANY(v_roles) THEN
    v_weight := 2;
  ELSE
    v_weight := 1;
  END IF;

  RETURN v_weight;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_vote_weight IS 'Get vote weight for a user based on their team roles (Captain: 3, Pilot/Broker: 2, Historian/None: 1)';

-- =================================================================================================
-- 6. FUNCTION: calculate_team_poll_result
-- Calculates a team's winning option for team/league polls
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.calculate_team_poll_result(p_poll_id uuid, p_team_id text)
RETURNS TABLE(
  winning_option_id uuid,
  winning_option_text text,
  total_weighted_votes bigint
) AS $$
DECLARE
  v_poll_type text;
BEGIN
  -- Get poll type
  SELECT vote_type INTO v_poll_type FROM public.polls WHERE id = p_poll_id;

  -- For individual polls, this function doesn't apply
  IF v_poll_type = 'individual' THEN
    RETURN;
  END IF;

  -- Calculate winning option based on weighted votes
  RETURN QUERY
  SELECT
    po.id,
    po.option_text,
    COALESCE(SUM(pv.vote_weight), 0)::bigint as total_weighted_votes
  FROM public.poll_options po
  LEFT JOIN public.poll_votes pv ON pv.option_id = po.id
    AND pv.poll_id = p_poll_id
    AND pv.team_id = p_team_id
  WHERE po.poll_id = p_poll_id
  GROUP BY po.id, po.option_text
  ORDER BY total_weighted_votes DESC, po.option_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_team_poll_result IS 'Calculate the winning option for a team in a team/league poll';

-- =================================================================================================
-- 7. FUNCTION: calculate_league_poll_result
-- Aggregates team votes for league result (each team = 1 vote)
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.calculate_league_poll_result(p_poll_id uuid)
RETURNS TABLE(
  winning_option_id uuid,
  winning_option_text text,
  teams_voting_for bigint,
  team_breakdown jsonb
) AS $$
DECLARE
  v_poll_type text;
BEGIN
  -- Get poll type
  SELECT vote_type INTO v_poll_type FROM public.polls WHERE id = p_poll_id;

  -- Only for league polls
  IF v_poll_type != 'league' THEN
    RETURN;
  END IF;

  -- Calculate league result: each team's winning option counts as 1 vote
  RETURN QUERY
  WITH team_results AS (
    SELECT ptr.winning_option_id, ptr.team_id
    FROM public.poll_team_results ptr
    WHERE ptr.poll_id = p_poll_id
      AND ptr.winning_option_id IS NOT NULL
  ),
  option_votes AS (
    SELECT
      tr.winning_option_id,
      COUNT(DISTINCT tr.team_id) as team_count,
      jsonb_agg(tr.team_id) as team_ids
    FROM team_results tr
    GROUP BY tr.winning_option_id
  )
  SELECT
    po.id,
    po.option_text,
    COALESCE(ov.team_count, 0)::bigint as teams_voting_for,
    COALESCE(ov.team_ids, '[]'::jsonb) as team_breakdown
  FROM public.poll_options po
  LEFT JOIN option_votes ov ON ov.winning_option_id = po.id
  WHERE po.poll_id = p_poll_id
  ORDER BY teams_voting_for DESC, po.option_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_league_poll_result IS 'Calculate the league-wide winning option by aggregating team votes';

-- =================================================================================================
-- 8. FUNCTION: get_poll_results_by_type
-- Returns results formatted by poll type
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.get_poll_results_by_type(p_poll_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_poll_type text;
  v_result jsonb;
BEGIN
  -- Get poll type
  SELECT vote_type INTO v_poll_type FROM public.polls WHERE id = p_poll_id;

  IF v_poll_type = 'individual' THEN
    -- Return standard results
    SELECT jsonb_build_object(
      'type', 'individual',
      'results', (
        SELECT jsonb_agg(jsonb_build_object(
          'option_id', r.option_id,
          'option_text', r.option_text,
          'vote_count', r.vote_count,
          'percentage', r.percentage
        ))
        FROM public.get_poll_results(p_poll_id) r
      )
    ) INTO v_result;

  ELSIF v_poll_type = 'team' THEN
    -- Return team-by-team results
    SELECT jsonb_build_object(
      'type', 'team',
      'team_results', (
        SELECT jsonb_agg(jsonb_build_object(
          'team_id', ptr.team_id,
          'team_name', t.name,
          'team_emoji', t.emoji,
          'winning_option_id', ptr.winning_option_id,
          'winning_option_text', po.option_text,
          'total_weighted_votes', ptr.total_weighted_votes
        ))
        FROM public.poll_team_results ptr
        JOIN public.teams t ON t.id = ptr.team_id
        LEFT JOIN public.poll_options po ON po.id = ptr.winning_option_id
        WHERE ptr.poll_id = p_poll_id
      )
    ) INTO v_result;

  ELSIF v_poll_type = 'league' THEN
    -- Return league result with team breakdown
    SELECT jsonb_build_object(
      'type', 'league',
      'league_result', (
        SELECT jsonb_build_object(
          'winning_option_id', plr.winning_option_id,
          'winning_option_text', po.option_text,
          'teams_for_option', plr.teams_for_option
        )
        FROM public.poll_league_results plr
        LEFT JOIN public.poll_options po ON po.id = plr.winning_option_id
        WHERE plr.poll_id = p_poll_id
      ),
      'team_results', (
        SELECT jsonb_agg(jsonb_build_object(
          'team_id', ptr.team_id,
          'team_name', t.name,
          'team_emoji', t.emoji,
          'winning_option_id', ptr.winning_option_id,
          'winning_option_text', po.option_text,
          'total_weighted_votes', ptr.total_weighted_votes
        ))
        FROM public.poll_team_results ptr
        JOIN public.teams t ON t.id = ptr.team_id
        LEFT JOIN public.poll_options po ON po.id = ptr.winning_option_id
        WHERE ptr.poll_id = p_poll_id
      ),
      'all_options', (
        SELECT jsonb_agg(jsonb_build_object(
          'option_id', po.id,
          'option_text', po.option_text,
          'teams_voting', (
            SELECT jsonb_agg(jsonb_build_object(
              'team_id', t.id,
              'team_name', t.name,
              'team_emoji', t.emoji
            ))
            FROM public.poll_team_results ptr2
            JOIN public.teams t ON t.id = ptr2.team_id
            WHERE ptr2.poll_id = p_poll_id AND ptr2.winning_option_id = po.id
          )
        ) ORDER BY po.option_order)
        FROM public.poll_options po
        WHERE po.poll_id = p_poll_id
      )
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_poll_results_by_type IS 'Get poll results formatted according to poll type';

-- =================================================================================================
-- 9. FUNCTION: recalculate_poll_results
-- Recalculates team and league results after a vote
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.recalculate_poll_results(p_poll_id uuid, p_team_id text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_poll_type text;
  v_team_record RECORD;
  v_winning_option_id uuid;
  v_total_votes bigint;
  v_league_winner uuid;
  v_teams_for_option jsonb;
BEGIN
  -- Get poll type
  SELECT vote_type INTO v_poll_type FROM public.polls WHERE id = p_poll_id;

  -- For individual polls, nothing to recalculate
  IF v_poll_type = 'individual' THEN
    RETURN;
  END IF;

  -- For team/league polls, recalculate team results
  IF p_team_id IS NOT NULL THEN
    -- Recalculate just this team
    SELECT tr.winning_option_id, tr.total_weighted_votes
    INTO v_winning_option_id, v_total_votes
    FROM public.calculate_team_poll_result(p_poll_id, p_team_id) tr;

    -- Upsert team result
    INSERT INTO public.poll_team_results (poll_id, team_id, winning_option_id, total_weighted_votes, calculated_at)
    VALUES (p_poll_id, p_team_id, v_winning_option_id, COALESCE(v_total_votes, 0), now())
    ON CONFLICT (poll_id, team_id)
    DO UPDATE SET
      winning_option_id = EXCLUDED.winning_option_id,
      total_weighted_votes = EXCLUDED.total_weighted_votes,
      calculated_at = EXCLUDED.calculated_at;
  ELSE
    -- Recalculate all teams
    FOR v_team_record IN
      SELECT DISTINCT team_id FROM public.poll_votes WHERE poll_id = p_poll_id AND team_id IS NOT NULL
    LOOP
      SELECT tr.winning_option_id, tr.total_weighted_votes
      INTO v_winning_option_id, v_total_votes
      FROM public.calculate_team_poll_result(p_poll_id, v_team_record.team_id) tr;

      INSERT INTO public.poll_team_results (poll_id, team_id, winning_option_id, total_weighted_votes, calculated_at)
      VALUES (p_poll_id, v_team_record.team_id, v_winning_option_id, COALESCE(v_total_votes, 0), now())
      ON CONFLICT (poll_id, team_id)
      DO UPDATE SET
        winning_option_id = EXCLUDED.winning_option_id,
        total_weighted_votes = EXCLUDED.total_weighted_votes,
        calculated_at = EXCLUDED.calculated_at;
    END LOOP;
  END IF;

  -- For league polls, also recalculate the league result
  IF v_poll_type = 'league' THEN
    -- Calculate winning option (most teams voting for it)
    SELECT ptr.winning_option_id, jsonb_object_agg(
      ptr.winning_option_id::text,
      (SELECT jsonb_agg(ptr2.team_id)
       FROM public.poll_team_results ptr2
       WHERE ptr2.poll_id = p_poll_id AND ptr2.winning_option_id = ptr.winning_option_id)
    )
    INTO v_league_winner, v_teams_for_option
    FROM public.poll_team_results ptr
    WHERE ptr.poll_id = p_poll_id AND ptr.winning_option_id IS NOT NULL
    GROUP BY ptr.winning_option_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Build full teams_for_option mapping
    SELECT jsonb_object_agg(
      po.id::text,
      COALESCE(
        (SELECT jsonb_agg(ptr.team_id)
         FROM public.poll_team_results ptr
         WHERE ptr.poll_id = p_poll_id AND ptr.winning_option_id = po.id),
        '[]'::jsonb
      )
    )
    INTO v_teams_for_option
    FROM public.poll_options po
    WHERE po.poll_id = p_poll_id;

    -- Upsert league result
    INSERT INTO public.poll_league_results (poll_id, winning_option_id, teams_for_option, calculated_at)
    VALUES (p_poll_id, v_league_winner, COALESCE(v_teams_for_option, '{}'::jsonb), now())
    ON CONFLICT (poll_id)
    DO UPDATE SET
      winning_option_id = EXCLUDED.winning_option_id,
      teams_for_option = EXCLUDED.teams_for_option,
      calculated_at = EXCLUDED.calculated_at;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.recalculate_poll_results IS 'Recalculate team and league poll results after a vote';

-- =================================================================================================
-- 10. UPDATE ACTIVE POLLS VIEW - Include vote_type
-- =================================================================================================

DROP VIEW IF EXISTS public.active_polls_view;

CREATE OR REPLACE VIEW public.active_polls_view AS
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
         p.allow_multiple_votes, p.show_results_before_end, p.vote_type, p.total_votes, p.created_at
ORDER BY
  CASE
    WHEN p.ends_at < now() THEN 2
    WHEN p.starts_at > now() THEN 1
    ELSE 0
  END,
  p.created_at DESC;

COMMENT ON VIEW public.active_polls_view IS 'View of active polls with status, option counts, and vote type';

-- =================================================================================================
-- 11. FUNCTION: get_user_team_for_voting
-- Helper to get user's team_id for team/league voting
-- =================================================================================================

CREATE OR REPLACE FUNCTION public.get_user_team_for_voting(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_team_id text;
BEGIN
  SELECT tm.team_id INTO v_team_id
  FROM public.team_members tm
  WHERE tm.user_id = p_user_id
  LIMIT 1;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_team_for_voting IS 'Get the team_id for a user for voting purposes';

-- =================================================================================================
-- SUCCESS MESSAGE
-- =================================================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Multi-Type Voting System Schema Installed Successfully!';
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'New features enabled:';
  RAISE NOTICE '  - Individual polls (1 person = 1 vote)';
  RAISE NOTICE '  - Team polls (each team gets separate result)';
  RAISE NOTICE '  - League polls (weighted role-based voting with team aggregation)';
  RAISE NOTICE '';
  RAISE NOTICE 'Vote weights for league polls:';
  RAISE NOTICE '  - Captain: 3';
  RAISE NOTICE '  - Pilot: 2';
  RAISE NOTICE '  - Broker: 2';
  RAISE NOTICE '  - Historian/No role: 1';
  RAISE NOTICE '=================================================================================================';
END $$;
