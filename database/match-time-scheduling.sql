-- =================================
-- MATCH TIME SCHEDULING SYSTEM
-- =================================
-- Allows Pilots/Captains to propose and confirm match times
-- Allows admins to grant extensions
-- =================================

-- Add scheduled_datetime field to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS scheduled_datetime timestamp with time zone,
ADD COLUMN IF NOT EXISTS scheduled_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scheduled_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS extension_granted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS extension_reason text,
ADD COLUMN IF NOT EXISTS extended_deadline timestamp with time zone;

-- =================================
-- MATCH TIME PROPOSALS TABLE
-- Allows teams to propose match times before confirming
-- =================================
CREATE TABLE IF NOT EXISTS public.match_time_proposals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,

  -- Proposal details
  proposed_datetime timestamp with time zone NOT NULL,
  proposed_by_team_id text REFERENCES public.teams(id) ON DELETE CASCADE,
  proposed_by_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  proposal_message text,

  -- Status tracking
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),

  -- Response from other team
  responded_by_team_id text REFERENCES public.teams(id) ON DELETE SET NULL,
  responded_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  responded_at timestamp with time zone,
  response_message text,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT valid_proposal_teams CHECK (proposed_by_team_id != responded_by_team_id)
);

-- =================================
-- INDEXES
-- =================================
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_datetime ON public.matches(scheduled_datetime);
CREATE INDEX IF NOT EXISTS idx_match_time_proposals_match ON public.match_time_proposals(match_id);
CREATE INDEX IF NOT EXISTS idx_match_time_proposals_status ON public.match_time_proposals(status);
CREATE INDEX IF NOT EXISTS idx_match_time_proposals_teams ON public.match_time_proposals(proposed_by_team_id, responded_by_team_id);

-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================

-- Match Time Proposals: Teams can view proposals for their matches
ALTER TABLE public.match_time_proposals ENABLE ROW LEVEL SECURITY;

-- Teams can view proposals for their matches
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

-- Team Pilots and Captains can create proposals
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

-- Team Pilots and Captains can respond to proposals
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

-- Proposing team can cancel their own proposals
CREATE POLICY "Teams can cancel their own proposals"
  ON public.match_time_proposals FOR UPDATE
  USING (
    proposed_by_user_id = auth.uid()
    AND status = 'pending'
  );

-- Admins can manage all proposals
CREATE POLICY "Admins can manage all proposals"
  ON public.match_time_proposals FOR ALL
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- =================================
-- TRIGGERS
-- =================================

-- Update match when proposal is accepted
CREATE OR REPLACE FUNCTION public.handle_proposal_accepted()
RETURNS trigger AS $$
BEGIN
  -- When a proposal is accepted, update the match
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    UPDATE public.matches
    SET
      scheduled_datetime = NEW.proposed_datetime,
      scheduled_by_user_id = NEW.responded_by_user_id,
      scheduled_confirmed = true,
      updated_at = now()
    WHERE id = NEW.match_id;

    -- Mark all other pending proposals for this match as expired
    UPDATE public.match_time_proposals
    SET
      status = 'expired',
      updated_at = now()
    WHERE match_id = NEW.match_id
    AND id != NEW.id
    AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_proposal_accepted ON public.match_time_proposals;
CREATE TRIGGER on_proposal_accepted
  AFTER UPDATE ON public.match_time_proposals
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION public.handle_proposal_accepted();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_proposal_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_proposal_updated ON public.match_time_proposals;
CREATE TRIGGER on_proposal_updated
  BEFORE UPDATE ON public.match_time_proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_proposal_updated_at();

-- =================================
-- HELPER FUNCTIONS
-- =================================

-- Function to check if user is Pilot or Captain of a team
CREATE OR REPLACE FUNCTION public.is_pilot_or_captain(
  p_user_id uuid,
  p_team_id text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_member_roles tmr
    JOIN public.team_members tm ON tm.id = tmr.team_member_id
    WHERE tm.user_id = p_user_id
    AND tm.team_id = p_team_id
    AND tmr.role IN ('pilot', 'captain')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- COMMENTS
-- =================================

COMMENT ON TABLE public.match_time_proposals IS 'Stores proposals for match times that teams negotiate';
COMMENT ON COLUMN public.matches.scheduled_datetime IS 'The confirmed date/time when teams will play the match';
COMMENT ON COLUMN public.matches.extension_granted IS 'Whether an admin has granted an extension for this match';
COMMENT ON COLUMN public.matches.extended_deadline IS 'New deadline if extension was granted';

-- =================================
-- USAGE EXAMPLES
-- =================================

-- To propose a match time (as Pilot/Captain):
-- INSERT INTO public.match_time_proposals (match_id, proposed_datetime, proposed_by_team_id, proposed_by_user_id, proposal_message)
-- VALUES ('match-uuid', '2025-01-25 19:00:00', 'team-uuid', 'user-uuid', 'How about Friday at 7 PM?');

-- To accept a proposal (as Pilot/Captain of other team):
-- UPDATE public.match_time_proposals
-- SET status = 'accepted', responded_by_team_id = 'other-team-uuid', responded_by_user_id = 'user-uuid', responded_at = now()
-- WHERE id = 'proposal-uuid';

-- To reject a proposal:
-- UPDATE public.match_time_proposals
-- SET status = 'rejected', responded_by_team_id = 'other-team-uuid', responded_by_user_id = 'user-uuid', responded_at = now(), response_message = 'Cannot make that time'
-- WHERE id = 'proposal-uuid';

-- To grant an extension (admin only):
-- UPDATE public.matches
-- SET extension_granted = true, extension_reason = 'Teams requested more time', extended_deadline = '2025-02-01 23:59:59'
-- WHERE id = 'match-uuid';
