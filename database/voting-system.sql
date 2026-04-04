-- =================================================================================================
-- VOTING SYSTEM SCHEMA
-- =================================================================================================
-- Description: Community voting system for Dynasty Cube
-- Features:
--   - Polls with multiple options
--   - Single or multiple choice voting
--   - Time-based poll expiration
--   - Real-time results
--   - Admin poll management
-- =================================================================================================

-- =================================================================================================
-- TABLES
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- POLLS TABLE
-- Stores poll questions and configuration
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  allow_multiple_votes boolean DEFAULT false,
  show_results_before_end boolean DEFAULT false,
  total_votes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS polls_is_active_idx ON public.polls(is_active);
CREATE INDEX IF NOT EXISTS polls_ends_at_idx ON public.polls(ends_at);
CREATE INDEX IF NOT EXISTS polls_created_by_idx ON public.polls(created_by);

COMMENT ON TABLE public.polls IS 'Community polls for voting on cube changes and decisions';
COMMENT ON COLUMN public.polls.allow_multiple_votes IS 'If true, users can select multiple options';
COMMENT ON COLUMN public.polls.show_results_before_end IS 'If true, results are visible before voting ends';

-- -------------------------------------------------------------------------------------------------
-- POLL OPTIONS TABLE
-- Stores individual options for each poll
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  option_order integer NOT NULL DEFAULT 0,
  vote_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(poll_id, option_order)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS poll_options_order_idx ON public.poll_options(poll_id, option_order);

COMMENT ON TABLE public.poll_options IS 'Options available for each poll';

-- -------------------------------------------------------------------------------------------------
-- POLL VOTES TABLE
-- Stores individual user votes
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voted_at timestamp with time zone DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_id_idx ON public.poll_votes(user_id);
CREATE INDEX IF NOT EXISTS poll_votes_option_id_idx ON public.poll_votes(option_id);

COMMENT ON TABLE public.poll_votes IS 'Individual votes cast by users';

-- =================================================================================================
-- ROW LEVEL SECURITY POLICIES
-- =================================================================================================

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------------------------------
-- POLLS POLICIES
-- -------------------------------------------------------------------------------------------------

-- Everyone can view active polls
CREATE POLICY "Anyone can view active polls"
  ON public.polls FOR SELECT
  USING (is_active = true OR auth.uid() IS NOT NULL);

-- Only admins can create polls
CREATE POLICY "Admins can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (public.is_admin());

-- Only admins can update polls
CREATE POLICY "Admins can update polls"
  ON public.polls FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete polls
CREATE POLICY "Admins can delete polls"
  ON public.polls FOR DELETE
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- POLL OPTIONS POLICIES
-- -------------------------------------------------------------------------------------------------

-- Everyone can view poll options
CREATE POLICY "Anyone can view poll options"
  ON public.poll_options FOR SELECT
  USING (true);

-- Only admins can create options
CREATE POLICY "Admins can create poll options"
  ON public.poll_options FOR INSERT
  WITH CHECK (public.is_admin());

-- Only admins can update options
CREATE POLICY "Admins can update poll options"
  ON public.poll_options FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete options
CREATE POLICY "Admins can delete poll options"
  ON public.poll_options FOR DELETE
  USING (public.is_admin());

-- -------------------------------------------------------------------------------------------------
-- POLL VOTES POLICIES
-- -------------------------------------------------------------------------------------------------

-- Users can view their own votes
CREATE POLICY "Users can view their own votes"
  ON public.poll_votes FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Authenticated users can cast votes
CREATE POLICY "Authenticated users can vote"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes (to change vote)
CREATE POLICY "Users can delete their own votes"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all votes
CREATE POLICY "Admins can view all votes"
  ON public.poll_votes FOR SELECT
  USING (public.is_admin());

-- =================================================================================================
-- FUNCTIONS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- GET POLL RESULTS FUNCTION
-- Returns vote counts for a poll
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id uuid)
RETURNS TABLE(
  option_id uuid,
  option_text text,
  vote_count bigint,
  percentage numeric
) AS $$
DECLARE
  v_total_votes bigint;
BEGIN
  -- Get total votes for the poll
  SELECT COUNT(*) INTO v_total_votes
  FROM public.poll_votes
  WHERE poll_id = p_poll_id;

  -- Return results with percentages
  RETURN QUERY
  SELECT
    po.id,
    po.option_text,
    COUNT(pv.id)::bigint as vote_count,
    CASE
      WHEN v_total_votes > 0 THEN ROUND((COUNT(pv.id)::numeric / v_total_votes::numeric) * 100, 2)
      ELSE 0
    END as percentage
  FROM public.poll_options po
  LEFT JOIN public.poll_votes pv ON pv.option_id = po.id
  WHERE po.poll_id = p_poll_id
  GROUP BY po.id, po.option_text, po.option_order
  ORDER BY po.option_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_poll_results IS 'Get vote counts and percentages for a poll';

-- -------------------------------------------------------------------------------------------------
-- CHECK IF USER HAS VOTED FUNCTION
-- Returns true if user has voted on a poll
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_voted(p_poll_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM public.poll_votes
    WHERE poll_id = p_poll_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.user_has_voted IS 'Check if a user has voted on a specific poll';

-- -------------------------------------------------------------------------------------------------
-- GET USER VOTES FOR POLL FUNCTION
-- Returns option IDs that user voted for
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_votes(p_poll_id uuid, p_user_id uuid)
RETURNS TABLE(option_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT pv.option_id
  FROM public.poll_votes pv
  WHERE pv.poll_id = p_poll_id AND pv.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_votes IS 'Get the option IDs that a user voted for in a poll';

-- =================================================================================================
-- TRIGGERS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- UPDATE VOTE COUNTS TRIGGER
-- Automatically update vote counts when votes are added/removed
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Increment option vote count
    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;

    -- Increment poll total votes
    UPDATE public.polls
    SET total_votes = total_votes + 1
    WHERE id = NEW.poll_id;

    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Decrement option vote count
    UPDATE public.poll_options
    SET vote_count = vote_count - 1
    WHERE id = OLD.option_id;

    -- Decrement poll total votes
    UPDATE public.polls
    SET total_votes = total_votes - 1
    WHERE id = OLD.poll_id;

    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_poll_vote_counts_trigger
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_poll_vote_counts();

COMMENT ON FUNCTION public.update_poll_vote_counts IS 'Automatically update vote counts when votes change';

-- -------------------------------------------------------------------------------------------------
-- UPDATE TIMESTAMP TRIGGER
-- Automatically update updated_at timestamp
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_polls_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_polls_timestamp_trigger
  BEFORE UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_polls_timestamp();

-- =================================================================================================
-- VIEWS
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- ACTIVE POLLS VIEW
-- Shows currently active polls with vote counts
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.active_polls_view AS
SELECT
  p.id,
  p.title,
  p.description,
  p.starts_at,
  p.ends_at,
  p.allow_multiple_votes,
  p.show_results_before_end,
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
         p.allow_multiple_votes, p.show_results_before_end, p.total_votes, p.created_at
ORDER BY
  CASE
    WHEN p.ends_at < now() THEN 2
    WHEN p.starts_at > now() THEN 1
    ELSE 0
  END,
  p.created_at DESC;

COMMENT ON VIEW public.active_polls_view IS 'View of active polls with status and option counts';

-- =================================================================================================
-- SAMPLE DATA (Optional - for testing)
-- =================================================================================================

-- Insert a sample poll (only if no polls exist)
DO $$
DECLARE
  v_admin_id uuid;
  v_poll_id uuid;
BEGIN
  -- Get first admin user
  SELECT id INTO v_admin_id FROM public.users WHERE is_admin = true LIMIT 1;

  IF v_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.polls LIMIT 1) THEN
    -- Create a sample poll
    INSERT INTO public.polls (
      title,
      description,
      created_by,
      ends_at,
      is_active,
      allow_multiple_votes,
      show_results_before_end
    ) VALUES (
      'Welcome to the Voting System!',
      'This is a sample poll to demonstrate the voting system. Select your favorite card type!',
      v_admin_id,
      now() + interval '7 days',
      true,
      false,
      true
    ) RETURNING id INTO v_poll_id;

    -- Create sample options
    INSERT INTO public.poll_options (poll_id, option_text, option_order) VALUES
      (v_poll_id, 'Creature', 1),
      (v_poll_id, 'Instant', 2),
      (v_poll_id, 'Sorcery', 3),
      (v_poll_id, 'Enchantment', 4),
      (v_poll_id, 'Artifact', 5);

    RAISE NOTICE 'Sample poll created successfully!';
  END IF;
END $$;

-- =================================================================================================
-- SUCCESS MESSAGE
-- =================================================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Voting System Schema Installed Successfully!';
  RAISE NOTICE '=================================================================================================';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  - Community polls with multiple options';
  RAISE NOTICE '  - Single or multiple choice voting';
  RAISE NOTICE '  - Time-based poll expiration';
  RAISE NOTICE '  - Real-time vote counting';
  RAISE NOTICE '  - Admin poll management';
  RAISE NOTICE '  - Secure RLS policies';
  RAISE NOTICE '=================================================================================================';
END $$;
